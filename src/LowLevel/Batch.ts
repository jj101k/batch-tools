import { Cancelled, InvalidState } from "../Errors"
import { LoadSelectionBuffer } from "../LoadSelectionBuffer"
import { BatchSendCondition } from "./BatchSendCondition"
import { BatchState } from "./BatchState"

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
 */
export class Batch<T, U> {
    /**
     *
     */
    private debug = false

    /**
     *
     */
    private id: number | null = null

    /**
     *
     */
    private _intState: BatchState = BatchState.Initial

    /**
     *
     */
    private resultsPromise: Promise<U[]>

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
     * @param message
     * @param otherContent
     */
    private debugLog(message: any, ...otherContent: any[]) {
        if (this.debug) {
            if(this.id === null) {
                this.id = Math.floor(Math.random() * 1000)
            }
            console.log(this.id, message, ...otherContent)
        }
    }

    /**
     * True if add() will do anything, ie if this batch is unsent and still has capacity.
     */
    get canAdd() {
        return this.intState < BatchState.Sent && !this.selectionBuffer.isFull
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
        this.selectionBuffer = new LoadSelectionBuffer<T>(sendCondition.timeoutMs ?? null, sendCondition.limit, delay)
        this.resultsPromise = this.selectionBuffer.then(
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
        const promise = this.resultsPromise.then(results => {
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
     * @returns
     */
    finish() {
        return this.selectionBuffer.finish()
    }
}
