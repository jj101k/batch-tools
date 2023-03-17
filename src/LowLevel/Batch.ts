import { Cancelled, InvalidState } from "../Errors"
import { LoadSelectionBuffer } from "../LoadSelectionBuffer"
import { BatchSendCondition } from "./BatchSendCondition"
import { BatchState } from "./BatchState"
import { ExtensiblePromise } from "./ExtensiblePromise"

/**
 * Some work handled by a promise, some not.
 */
interface PartialPromise<P> {
    /**
     * The promise used
     */
    promise: Promise<P>
    /**
     * The amount of work which could not be handled. This is guaranteed to be
     * at the end of the list.
     */
    remaining: number
}

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
export class Batch<T, U> extends ExtensiblePromise<U[]> {
    /**
     *
     */
    private _intState: BatchState = BatchState.Initial

    /**
     *
     */
    private selectionBuffer: LoadSelectionBuffer<T>

    /**
     * The internal state. Unlike the external view of the same, this is
     * writeable.
     */
    private get intState() {
        return this._intState
    }

    /**
     *
     */
    private set intState(v) {
        if (v == this._intState) {
            return // Nothing to do
        } else if (v < this._intState) {
            throw new InvalidState("State may only move forwards")
        }
        this._intState = v
    }

    /**
     *
     */
    protected promise: Promise<U[]>

    /**
     * True if add() will do anything, ie if this batch is unsent and still has capacity.
     */
    get canAdd() {
        return this.selectionBuffer.canAdd
    }

    /**
     * Whether the batch has been delayed. This can be set to false at any time,
     * and will send the batch if it's already met its criteria. Setting this to
     * true after the batch is sent has no effect.
     */
    get delay() {
        return this.selectionBuffer.defer
    }

    /**
     *
     */
    set delay(v) {
        this.selectionBuffer.defer = v
        if (this.intState == BatchState.ReadyToSend && !v) {
            this.intState = BatchState.Sent
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
        if(this.intState < BatchState.ReadyToSend && this.selectionBuffer.ready) {
            return BatchState.ReadyToSend
        }
        return this.intState
    }

    /**
     *
     * @param func The worker which will handle the batch when ready
     * @param sendCondition
     * @param delay If concurrently true, the batch will not be finished even
     * after triggering its condition. For size-limited batches, that means it
     * will not permit further additions; for time-limited batches, this makes
     * it effectively condition-limited. Set "delay" to false when no longer
     * needed.
     */
    constructor(func: (...ts: T[]) => Promise<U[]>,
        sendCondition: BatchSendCondition = {}, delay = false
    ) {
        super()
        this.selectionBuffer = new LoadSelectionBuffer<T>(sendCondition.timeoutMs ?? null, sendCondition.limit, delay)
        this.promise = this.selectionBuffer.then(
            async backlog => {
                this._intState = BatchState.Sent
                this.debugLog("Selection resolved with buffer", backlog)
                const results = await func(...backlog)
                if(this.intState == BatchState.Aborted) {
                    throw new Error("Aborted")
                }
                return results
            }
        ).finally(() => {
            this.debugLog("Post-resolve")
            this.intState = BatchState.Finished
        })
    }

    /**
     * Stops the process.
     */
    abort() {
        if(this.intState < BatchState.Finished) {
            this.debugLog("Aborting buffer")
            this._intState = BatchState.Aborted
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
    add(...items: T[]): PartialPromise<U[]> {
        this.debugLog("Add")
        if (this.intState > BatchState.ReadyToSend) {
            this.debugLog("Cannot add")
            return {
                promise: Promise.resolve([]),
                remaining: items.length,
            }
        }

        this.intState = BatchState.Waiting

        const offset = this.selectionBuffer.size
        const promise = this.promise.then(results => {
            if(this.intState == BatchState.Aborted) {
                throw new Cancelled()
            }
            return results.slice(offset, offset + items.length)
        })

        const remainingLength = this.selectionBuffer.add(...items)
        this.debugLog(`Loaded with ${remainingLength} remaining`)
        return {
            promise,
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
