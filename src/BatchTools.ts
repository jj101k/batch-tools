interface PartialPromise<P> {
    promise: Promise<P>
    remaining: number
}

export enum BatchState {
    INITIAL,
    WAITING,
    SENT,
    FINISHED
}

interface BatchSendCondition {
    limit?: number
    timeoutMs?: number
}

/**
 * This represents a single batch of actions to take. It can be finished either
 * when it's full or when a certain time has elapsed.
 */
class Batch<T, U> {
    private resolve: ((value: any) => any) | null = null
    private backlog: T[] = []

    private currentAction: Promise<U[]> | null = null

    private _state: BatchState = BatchState.INITIAL

    constructor(private func: (...ts: T[]) => Promise<U[]>, private sendCondition: BatchSendCondition = {}) {

    }

    get state() {
        return this._state
    }

    private set state(v) {
        if(v < this._state) {
            throw new Error("State may only move forwards")
        }
        this._state = v
    }

    private start() {
        if(!this.currentAction) {
            this.currentAction = (
                async () => {
                    this.state = BatchState.WAITING
                    await new Promise(resolve => this.resolve = resolve)
                    try {
                        return await this.func(...this.backlog)
                    } finally {
                        this.state = BatchState.FINISHED
                    }
                }
            )()
            if(this.sendCondition.timeoutMs !== undefined) {
                setTimeout(() => this.finish(), this.sendCondition.timeoutMs)
            }
        }
        return this.currentAction
    }

    add(...ts: T[]): PartialPromise<U[]> {
        if(this.state > BatchState.WAITING) {
            return {
                promise: Promise.resolve([]),
                remaining: ts.length,
            }
        }
        const offset = this.backlog.length

        let remainingLength: number
        if(this.sendCondition.limit) {
            remainingLength = this.sendCondition.limit - this.backlog.length
            if(ts.length < remainingLength) {
                this.backlog.push(...ts)
            } else {
                this.backlog.push(...ts.slice(0, remainingLength))
                this.finish()
            }
        } else {
            remainingLength = 0
            this.backlog.push(...ts)
        }
        return {
            promise: this.start().then(results => results.slice(offset, offset + ts.length)),
            remaining: remainingLength,
        }
    }

    finish() {
        if(this.state < BatchState.SENT) {
            if(!this.resolve) {
                throw new Error("Too early to finish")
            }
            this.state = BatchState.SENT
            this.resolve(null)
        }
    }
}

export class BatchTools<T, U> {
    private readonly batches: Batch<T, U>[] = []

    private activeBatch: Batch<T, U> | null = null

    constructor(private func: (...ts: T[]) => Promise<U[]>, private sendCondition: BatchSendCondition = {}) {

    }

    async callMulti(...ts: T[]): Promise<U[]> {
        if(!this.activeBatch) {
            this.activeBatch = new Batch(this.func, this.sendCondition)
        }
        const promises: Promise<U[]>[] = []
        while(ts.length) {
            const result = this.activeBatch.add(...ts)
            promises.push(result.promise)
            ts = ts.slice(ts.length - result.remaining)
            if(this.activeBatch.state >= BatchState.SENT) {
                this.batches.push(this.activeBatch)
                this.activeBatch = new Batch(this.func, this.sendCondition)
            }
        }
        const out: U[] = []
        for(const promise of promises) {
            out.push(...(await promise))
        }
        return out
    }

    async call(t: T): Promise<U> {
        return (await this.callMulti(t))[0]
    }
}