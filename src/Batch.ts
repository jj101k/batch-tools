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

    constructor(private func: (...ts: T[]) => Promise<U[]>, private sendCondition: BatchSendCondition = {}) {
    }

    get state() {
        return this._state
    }

    private set state(v) {
        if (v < this._state) {
            throw new Error("State may only move forwards")
        }
        this._state = v

        if(v == BatchState.Sent) {
            if (!this.resolve) {
                throw new Error("Too early to finish")
            }
            this.debugLog("Resolve")
            this.resolve(null)
        }
    }

    private start() {
        if (!this.currentAction) {
            this.debugLog("Setup")
            this.currentAction = (
                async () => {
                    this.state = BatchState.Waiting
                    await new Promise(resolve => this.resolve = resolve)
                    try {
                        this.debugLog("Resolved")
                        return await this.func(...this.backlog)
                    } finally {
                        this.debugLog("Post-resolve")
                        this.state = BatchState.Finished
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
        if (this.state > BatchState.Waiting) {
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
     *
     */
    finish() {
        if (!this.currentAction) {
            throw new Error("Internal error: batch cannot be finished before it's started")
        }
        this.debugLog("Finish?")
        if (this.state < BatchState.Sent) {
            this.debugLog("Finish")
            this.state = BatchState.Sent
        }
    }
}
