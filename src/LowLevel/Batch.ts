import { Errors, ExtensiblePromise } from "@jdframe/core"
import { Batchable, BatchSendCondition, SelectionBuffer, SelectionErrors } from "@jdframe/selection-buffer"
import { BatchState } from "./BatchState"
import { PartialPromise } from "./PartialPromise"

/**
 * This represents a single batch of actions to take. It can be finished either
 * when it's full or when a certain time has elapsed.
 *
 * Generally this would be part of code to reduce O(n) HTTP requests to O(1)
 * using a batch-handling endpoint at the other end, or at least to reduce that
 * number somewhat. You aren't likely to want to use this directly.
 *
 * For promise-style usage, this will be resolved when the results come back,
 * but it's not guaranteed that this will be before all the results are handled
 * by the caller.
 */
export class Batch<I, O> extends ExtensiblePromise<O[]> implements Batchable<I, O> {
    /**
     *
     */
    private selectionBuffer: SelectionBuffer<I>

    /**
     *
     */
    private storedInternalState: BatchState = BatchState.Initial

    /**
     * The internal state. Unlike the external view of the same, this is
     * writeable, but may only move forward.
     *
     * This will implicitly move forward if the selection buffer is ready and
     * the current state is not yet ready-to-send.
     */
    private get internalState() {
        if(this.storedInternalState < BatchState.ReadyToSend && this.selectionBuffer.ready) {
            this.storedInternalState = BatchState.ReadyToSend
        }
        return this.storedInternalState
    }

    /**
     *
     */
    private set internalState(v) {
        if (v == this.storedInternalState) {
            return // Nothing to do
        } else if (v < this.storedInternalState) {
            throw new SelectionErrors.InvalidState("State may only move forwards")
        }
        this.storedInternalState = v
    }

    /**
     *
     * @param offset
     * @param length
     * @returns
     */
    private async slicePromise(offset: number, length: number) {
        const results = await this.promise
        if(this.internalState == BatchState.Aborted) {
            throw new Errors.Cancelled()
        }
        return results.slice(offset, offset + length)
    }

    /**
     * A promise which will resolve with the full set of batch results
     */
    protected promise: Promise<O[]>

    /**
     * True if add() will do anything, ie if this batch is unsent and still has capacity.
     */
    get canAdd() {
        return this.selectionBuffer.canAdd
    }

    /**
     * Whether the batch has been delayed. Setting this to false will send the
     * batch if it's already met its criteria. Setting this to true after the
     * batch is sent has no effect.
     */
    get delay() {
        return this.selectionBuffer.delay
    }

    /**
     *
     */
    set delay(v) {
        this.selectionBuffer.delay = v
        if (this.internalState == BatchState.ReadyToSend && !v) {
            this.internalState = BatchState.Sent
        }
    }

    /**
     * How much work is in the batch
     */
    get size() {
        return this.selectionBuffer.size
    }

    /**
     *
     */
    get state() {
        return this.internalState
    }

    /**
     *
     * @param worker The worker which will handle the batch when ready
     * @param sendCondition If not set, it should be immediately a candidate to send
     * @param delay If concurrently true, the batch will not be finished even
     * after triggering its condition. For size-limited batches, that means it
     * will not permit further additions; for time-limited batches, this makes
     * it effectively condition-limited. Set "delay" to false when no longer
     * needed.
     */
    constructor(worker: (...ts: I[]) => Promise<O[]>,
        sendCondition?: BatchSendCondition<I>, delay = false
    ) {
        super()

        this.selectionBuffer = new SelectionBuffer<I>(sendCondition, delay)

        this.promise = this.selectionBuffer.then(async backlog => {
            this.storedInternalState = BatchState.Sent
            this.debugLog("Selection resolved with buffer", backlog)
            const results = await worker(...backlog)
            if(this.internalState == BatchState.Aborted) {
                throw new Error("Aborted")
            }
            return results
        }).finally(() => {
            this.debugLog("Post-resolve")
            this.internalState = BatchState.Finished
        })
    }

    /**
     * Stops the process.
     */
    abort() {
        if(this.internalState < BatchState.Finished) {
            this.debugLog("Aborting buffer")
            this.storedInternalState = BatchState.Aborted
            this.selectionBuffer.abort()
        }
    }

    /**
     * Adds some items to the batch
     *
     * @param items
     * @returns A promise resolving to the completed work, and a number of
     * unhandled items
     */
    add(...items: I[]): PartialPromise<O[]> {
        this.debugLog("Add")
        if (this.internalState > BatchState.ReadyToSend) {
            this.debugLog("Cannot add")
            return {
                promise: Promise.resolve([]),
                remaining: items.length,
            }
        }

        this.internalState = BatchState.Waiting

        // TODO adjust this to use a sparse array to detect removed items

        const offset = this.selectionBuffer.size

        const remainingLength = this.selectionBuffer.add(...items)
        this.debugLog(`Loaded with ${remainingLength} remaining`)
        return {
            promise: this.slicePromise(offset, items.length),
            remaining: remainingLength,
        }
    }

    /**
     * Finish collecting the batch, and send it. This applies when you have no
     * automatic send conditions.
     *
     * @returns A promise which will be resolved when the results are in.
     */
    finish() {
        this.selectionBuffer.finish()
        return this.promise
    }
}
