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
    private get readyToSend() {
        return this.intState >= BatchState.ReadyToSend
    }

    /**
     *
     */
    private set readyToSend(v) {
        if(!v) {
            throw new Error("Marking unready to send is not supported")
        }
        if(this.intState < BatchState.ReadyToSend) {
            this.intState = BatchState.ReadyToSend
        }
    }

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
     * @param delay If concurrently true, the batch will not be finished even
     * after triggering its condition. For size-limited batches, that means it
     * will not permit further additions; for time-limited batches, this makes
     * it effectively condition-limited. Call finish() to move on.
     */
    constructor(private func: (...ts: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {}, private delay = false
    ) {
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
                    this.readyToSend = true
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
                this.readyToSend = true
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
     *
     */
    finish() {
        this.debugLog("Finish?")
        if (this.intState < BatchState.Sent) {
            this.debugLog("Finish")
            this.intState = BatchState.Sent
        }
    }
}
