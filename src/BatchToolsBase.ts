import { Batch } from "./Batch"
import { BatchSendCondition } from "./BatchSendCondition"
import { BatchState } from "./BatchState"
import { LimitExceeded } from "./Errors"

/**
 *
 */
export class BatchToolsBase<T, U> {
    /**
     * Batches which are no longer active, ie ready to send or later.
     */
    private batches: Batch<T, U>[] = []

    private activeBatch: Batch<T, U> | null = null

    /**
     *
     * @returns
     */
    private activeOrNewBatch() {
        if(!this.activeBatch?.canAdd) {
            if(this.activeBatch) {
                this.batches.push(this.activeBatch)
            }
            this.activeBatch = new Batch(
                this.func,
                this.sendCondition,
                this.batches.length + 1 > this.parallelLimit
            )
        }
        return this.activeBatch
    }

    /**
     * Enables batches up to the parallel limit.
     */
    private enableBatches() {
        // Clean out any no-longer-interesting batches.
        this.batches = this.batches.filter(batch => batch.state < BatchState.Sent)

        if(this.batches.length <= this.parallelLimit) {
            for(const batch of this.batches) {
                batch.delay = false
            }
            if(this.batches.length < this.parallelLimit && this.activeBatch) {
                this.activeBatch.delay = false
            }
        } else {
            for(const batch of this.batches.slice(0, this.parallelLimit)) {
                batch.delay = false
            }
        }
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
     * @param parallelLimit
     */
    constructor(private func: (...ts: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {},
        private parallelLimit = Infinity
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
                if(this.parallelLimit == Infinity) {
                    promises.push(result.promise)
                } else {
                    promises.push(result.promise.finally(() => this.enableBatches()))
                }
                ts = ts.slice(ts.length - result.remaining)
            } else {
                throw new LimitExceeded("Internal error: batch could not accept any new items")
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