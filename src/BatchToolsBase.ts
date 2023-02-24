import { Batch } from "./Batch"
import { BatchSendCondition } from "./BatchSendCondition"
import { BatchState } from "./BatchState"

/**
 *
 */
export class BatchToolsBase<T, U> {
    private readonly batches: Batch<T, U>[] = []

    private activeBatch: Batch<T, U> | null = null

    /**
     *
     */
    get activeBatchSize() {
        return this.activeBatch?.size
    }

    constructor(private func: (...ts: T[]) => Promise<U[]>, private sendCondition: BatchSendCondition = {}) {

    }

    /**
     * Adds multiple items to one or more batches. Returns when done.
     *
     * Important note: this will only be done when all of them are, which means
     * you'll probably have to wait for the timeout.
     *
     * @param ts
     * @returns
     */
    protected getBatchPromises(...ts: T[]): Promise<U[]>[] {
        if(!this.activeBatch) {
            this.activeBatch = new Batch(this.func, this.sendCondition)
        }
        const promises: Promise<U[]>[] = []
        while(ts.length) {
            const result = this.activeBatch.add(...ts)
            if(result.remaining < ts.length) {
                promises.push(result.promise)
                ts = ts.slice(ts.length - result.remaining)
            }
            if(this.activeBatch.state >= BatchState.SENT) {
                this.batches.push(this.activeBatch)
                this.activeBatch = new Batch(this.func, this.sendCondition)
            }
        }
        return promises
    }

    /**
     *
     * @param t
     * @returns
     */
    async call(t: T): Promise<U> {
        const promises = this.getBatchPromises(t)
        const result = await promises[0]
        return result[0]
    }

    /**
     * Use this to send the current batch immediately.
     */
    send() {
        if(this.activeBatch) {
            this.activeBatch.finish()
            this.batches.push(this.activeBatch)
        }
        this.activeBatch = new Batch(this.func, this.sendCondition)
    }
}