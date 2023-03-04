import { BatchState } from "./BatchState"
import { BatchSendCondition } from "./BatchSendCondition"
import { InvalidState } from "./Errors"

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
     * The action to fulfill the backlog. Once this is set, the batch handling
     * is in progress.
     */
    private currentAction: Promise<U[]> | null = null

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
     * This will trigger the action after it's been started.
     */
    private resolve: ((value: any) => any) | null = null

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
            if (!this.currentAction) {
                throw new InvalidState("Internal error: batch cannot be finished before it's started")
            }
            if (!this.resolve) {
                throw new InvalidState("Too early to finish")
            }
            this.debugLog("Resolve")
            this.resolve(null)
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
     * This should only be called once.
     *
     * @returns
     */
    private async performAction() {
        this.intState = BatchState.Waiting
        await new Promise(resolve => this.resolve = resolve)
        try {
            this.debugLog("Resolved")
            return await this.func(...this.backlog)
        } finally {
            this.debugLog("Post-resolve")
            this.intState = BatchState.Finished
        }
    }

    /**
     *
     * @returns
     */
    private start() {
        if (!this.currentAction) {
            this.debugLog("Setup")
            this.currentAction = this.performAction()
            if (this.sendCondition.timeoutMs !== undefined) {
                setTimeout(() => {
                    this.debugLog("Time out")
                    this.finish()
                }, this.sendCondition.timeoutMs)
            }
        }
        return this.currentAction
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
    constructor(private func: (...ts: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {}, delay = false
    ) {
        this._delay = delay
    }

    /**
     * Adds some items to the batch
     *
     * @param ts
     * @returns A promise resolving to the completed work, and a number of
     * unhandled items
     */
    add(...ts: T[]): PartialPromise<U[]> {
        if (this.intState > BatchState.ReadyToSend) {
            return {
                promise: Promise.resolve([]),
                remaining: ts.length,
            }
        }
        const offset = this.backlog.length
        const promise = this.start().then(results => results.slice(offset, offset + ts.length))

        let remainingLength: number
        if (this.sendCondition.limit) {
            const space = this.sendCondition.limit - this.backlog.length
            this.debugLog(`${ts.length} compare ${space}`)
            if (ts.length < space) {
                remainingLength = 0
                this.backlog.push(...ts)
            } else {
                remainingLength = ts.length - space
                this.debugLog("Over")
                this.backlog.push(...ts.slice(0, space))
                this.finish()
            }
        } else {
            remainingLength = 0
            this.backlog.push(...ts)
        }
        return {
            promise,
            remaining: remainingLength,
        }
    }

    /**
     * Finish collecting the batch, and send it. This applies when you have no
     * automatic send conditions.
     */
    finish() {
        if (this.intState < BatchState.ReadyToSend) {
            this.intState = BatchState.ReadyToSend
        }
    }
}
