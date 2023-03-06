import { BatchState } from "./BatchState"
import { BatchSendCondition } from "./BatchSendCondition"
import { InvalidState } from "./Errors"
import { TriggerPromise } from "./TriggerPromise"

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
     * The objects to operate on. This will generally increase then become
     * static.
     */
    private backlog: T[] = []

    /**
     *
     */
    private debug = false

    /**
     * Whether to delay sending the batch once it meets its criteria.
     */
    private _delay: boolean

    /**
     *
     */
    private _intState: BatchState = BatchState.Initial

    /**
     *
     */
    private triggerPromise: TriggerPromise<U[]>

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

        if (v == BatchState.ReadyToSend && !this.delay) {
            this._intState = BatchState.Sent
        }

        if (this._intState == BatchState.Sent) {
            this.debugLog("Resolve")
            this.triggerPromise.activate()
        }
    }

    /**
     *
     * @param message
     */
    private debugLog(message: string) {
        if (this.debug) {
            console.log(message)
        }
    }

    /**
     * True if add() will do anything, ie if this batch is unsent and still has capacity.
     */
    get canAdd() {
        return this.intState < BatchState.Sent && (this.sendCondition.limit ?? Infinity) > this.backlog.length
    }

    /**
     * Whether the batch has been delayed. This can be set to false at any time,
     * and will send the batch if it's already met its criteria. Setting this to
     * true after the batch is sent has no effect.
     */
    get delay() {
        return this._delay
    }

    /**
     *
     */
    set delay(v) {
        this._delay = v
        if (this.intState == BatchState.ReadyToSend && !v) {
            this.intState = BatchState.Sent
        }
    }

    /**
     * How much work is in the batch
     */
    get size() {
        return this.backlog.length
    }

    /**
     *
     */
    get state() {
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
        private sendCondition: BatchSendCondition = {}, delay = false
    ) {
        this._delay = delay
        this.triggerPromise = new TriggerPromise(() => func(...this.backlog)).finally(() => {
            this.debugLog("Post-resolve")
            this.intState = BatchState.Finished
        })
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
        if (this.intState == BatchState.Initial && this.sendCondition.timeoutMs !== undefined) {
            setTimeout(() => {
                this.debugLog("Time out")
                this.finish()
            }, this.sendCondition.timeoutMs)
        }
        this.intState = BatchState.Waiting

        const offset = this.backlog.length
        const promise = this.triggerPromise.then(results => results.slice(offset, offset + items.length))

        let remainingLength: number
        if (this.sendCondition.limit) {
            const space = this.sendCondition.limit - this.backlog.length
            this.debugLog(`${items.length} compare ${space}`)
            if (items.length < space) {
                remainingLength = 0
                this.backlog.push(...items)
            } else {
                remainingLength = items.length - space
                this.debugLog("Over")
                this.backlog.push(...items.slice(0, space))
                this.finish()
            }
        } else {
            remainingLength = 0
            this.backlog.push(...items)
        }
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
        if (this.intState < BatchState.ReadyToSend) {
            this.intState = BatchState.ReadyToSend
        }
        return this.triggerPromise
    }
}
