import { Batch } from "./LowLevel/Batch"
import { BatchSendCondition } from "./LowLevel/BatchSendCondition"
import { BatchState } from "./LowLevel/BatchState"
import { LimitExceeded } from "./Errors"

/**
 * @see Batch for lower-level functionality.
 *
 * This lets you take O(n) work items which come in sporadically, and either
 * turn it into O(1) batches of work items (no limit) or a fairly small number
 * of batches of work items (with limit). Mainly this is useful for where you
 * want to have individual information requests for a UI but want batched GETs
 * to reduce network traffic or workload.
 *
 * This class only handles single items, if you want to load several see
 * BatchTools and BatchToolsIterable.
 */
export class BatchToolsSingle<T, U> {
    /**
     * Batches which are no longer accepting entries, ie ready to send or later.
     * This includes ones which are simply not finished yet.
     */
    private batches: Batch<T, U>[] = []

    /**
     *
     */
    private debug = false

    /**
     *
     */
    private id: number | null = null

    /**
     * The batch which is currently (or most recently) accepting entries. By the
     * time of any given call, this might no longer be accepting entries, so
     * this will get checked often.
     */
    private lastActiveBatch: Batch<T, U> | null = null

    /**
     * A batch to which items can currently be added. Unlike lastActiveBatch,
     * this is guaranteed.
     */
    private get activeBatch() {
        if(!this.lastActiveBatch?.canAdd) {
            if(this.lastActiveBatch) {
                this.debugLog("Pushing non-add active batch")
                this.batches.push(this.lastActiveBatch)
            }
            this.lastActiveBatch = new Batch(
                this.func,
                this.sendCondition,
                this.batches.length + 1 > this.parallelLimit
            )
        }
        return this.lastActiveBatch
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
     * Enables batches until the pool is full (up to the limit on simultaneous
     * batches). The batches might not be sent, but they will be candidates for
     * sending.
     *
     * This relies on batches reaching their natural send candidacy in order.
     */
    private enableBatches() {
        // Clean out any no-longer-interesting batches.
        this.batches = this.batches.filter(batch => batch.state < BatchState.Finished)

        if(this.batches.length > 0) {
            this.debugLog(`Considering enable at ${this.batches.length} of ${this.parallelLimit}`)
        }

        if(this.batches.length <= this.parallelLimit) {
            for(const batch of this.batches) {
                batch.delay = false
            }
            if(this.batches.length < this.parallelLimit && this.lastActiveBatch) {
                this.lastActiveBatch.delay = false
            }
        } else {
            for(const batch of this.batches.slice(0, this.parallelLimit)) {
                batch.delay = false
            }
        }
    }

    /**
     * Adds multiple items to one or more batches. Returns when done.
     *
     * Important note: this will only be done when all of them are, which means
     * you'll probably have to wait for the timeout.
     *
     * @param items
     * @returns An array of promises to be handled as appropriate.
     */
    protected getBatchPromises(...items: T[]) {
        const promises: Promise<U[]>[] = []
        while(items.length) {
            const batch = this.activeBatch
            const result = batch.add(...items)
            if(result.remaining < items.length) {
                if(this.parallelLimit == Infinity) {
                    promises.push(result.promise)
                } else {
                    promises.push(result.promise.finally(() => this.enableBatches()))
                }
                items = items.slice(items.length - result.remaining)
            } else {
                throw new LimitExceeded("Internal error: batch could not accept any new items")
            }
        }
        return promises
    }

    /**
     * For debugging/testing. This indicates how many items were in the last
     * batch. This may be removed in future.
     */
    get lastActiveBatchSize() {
        return this.lastActiveBatch?.size
    }

    /**
     *
     * @param func The action to be performed
     * @param sendCondition
     * @param parallelLimit How many batches to have runnable at once
     */
    constructor(private func: (...items: T[]) => Promise<U[]>,
        private sendCondition: BatchSendCondition = {},
        private parallelLimit = Infinity
    ) {

    }

    /**
     *
     */
    abort() {
        this.debugLog("Abort, stopping all batches")
        for(const batch of this.batches) {
            batch.abort()
        }
        this.batches = []
        this.lastActiveBatch?.abort()
        this.lastActiveBatch = null
    }

    /**
     * Handle one item. This will put it in a batch behind the scenes, and in
     * effect is the same as calling func(item) but with different timing.
     *
     * This should be your primary entry point.
     *
     * @param item
     * @returns
     */
    async call(item: T): Promise<U> {
        const promises = this.getBatchPromises(item)
        const result = await promises[0]
        return result[0]
    }

    /**
     * Use this to send the current batch immediately. You might do this earlier
     * than a timeout if you want to send as early as possible and know all the
     * work has already been loaded.
     */
    send() {
        if(this.lastActiveBatch) {
            this.debugLog("Send - finish")
            this.lastActiveBatch.finish()
            this.batches.push(this.lastActiveBatch)
        } else {
            this.debugLog("Send - nothing to send")
        }
        this.lastActiveBatch = new Batch(this.func, this.sendCondition)
    }
}