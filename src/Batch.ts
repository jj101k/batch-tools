import { BatchState } from "./BatchState"
import { BatchSendCondition } from "./BatchSendCondition"

/**
 * A promise that handles some of the work given
 */
interface PartialPromise<P> {
    /**
     * The promise used
     */
    promise: Promise<P>
    /**
     * The amount of work which could not be handled
     */
    remaining: number
}

/**
 * This represents a single batch of actions to take. It can be finished either
 * when it's full or when a certain time has elapsed.
 */
export class Batch<T, U> {
    /**
     *
     */
    private debug = false;

    private resolve: ((value: any) => any) | null = null;
    private backlog: T[] = [];

    private currentAction: Promise<U[]> | null = null;

    private _state: BatchState = BatchState.Initial;

    /**
     *
     */
    private get intState() {
        return this._state
    }

    /**
     *
     */
    private set intState(v) {
        if(v == this._state) {
            return // Nothing to do
        } else if (v < this._state) {
            throw new Error("State may only move forwards")
        }
        this._state = v

        if(v == BatchState.ReadyToSend && !this.delay) {
            this._state = BatchState.Sent
        }

        if(this._state == BatchState.Sent) {
            if (!this.currentAction) {
                throw new Error("Internal error: batch cannot be finished before it's started")
            }
            if (!this.resolve) {
                throw new Error("Too early to finish")
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
     *
     */
    get size() {
        return this.backlog.length
    }

    /**
     *
     * @param func
     * @param sendCondition
     * @param _delay If concurrently true, the batch will not be finished even
     * after triggering its condition. For size-limited batches, that means it
     * will not permit further additions; for time-limited batches, this makes
     * it effectively condition-limited. Set "delay" to false when no longer
     * needed.
     */
    constructor(private func: (...ts: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {}, private _delay = false
    ) {
    }

    /**
     *
     */
    get delay() {
        return this._delay
    }

    /**
     *
     */
    set delay(v) {
        this._delay = v
        if(this.intState == BatchState.ReadyToSend && !v) {
            this.intState = BatchState.Sent
        }
    }

    get state() {
        return this.intState
    }

    private start() {
        if (!this.currentAction) {
            this.debugLog("Setup")
            this.currentAction = (
                async () => {
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
            )()
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
     *
     * @param ts
     * @returns
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
     * automatic send conditions, as well as where you've asked for a delay.
     */
    finish() {
        if(this.intState < BatchState.ReadyToSend) {
            this.intState = BatchState.ReadyToSend
        }
    }
}
