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
     * @returns
     */
    private activeOrNewBatch() {
        if(!this.activeBatch || this.activeBatch.state >= BatchState.Sent) {
            if(this.activeBatch) {
                this.batches.push(this.activeBatch)
            }
            this.activeBatch = new Batch(
                this.func,
                this.sendCondition
            )
        }
        return this.activeBatch
    }

    /**
     *
     */
    get activeBatchSize() {
        return this.activeBatch?.size
    }

    /**
     *
     * @param func
     * @param sendCondition
     */
    constructor(private func: (...ts: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {},
    ) {

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
        const promises: Promise<U[]>[] = []
        while(ts.length) {
            const batch = this.activeOrNewBatch()
            const result = batch.add(...ts)
            if(result.remaining < ts.length) {
                promises.push(result.promise)
                ts = ts.slice(ts.length - result.remaining)
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