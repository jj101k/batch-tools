import { LimitExceeded } from "./Errors"
import { Batch } from "./LowLevel/Batch"
import { BatchSendCondition } from "./LowLevel/BatchSendCondition"
import { BatchState } from "./LowLevel/BatchState"
import { Debuggable } from "./LowLevel/Debuggable"
import { MultiBatchable } from "./MultiBatchable"

/**
 * @see Batch for lower-level functionality.
 *
 * This lets you take O(n) work items which come in sporadically, and either
 * turn it into O(1) batches of work items (no limit) or a fairly small number
 * of batches of work items (with limit). Mainly this is useful for where you
 * want to have individual information requests for a UI but want batched GETs
 * to reduce network traffic or workload.
 *
 * Here, you can ask for multiple items to be handled, and get a promise
 * resolving when all are done. If they end up split across multiple batches
 * (only applicable where there's a batch limit), you won't see results until
 * the last one. If any fail, the whole thing fails.
 *
 * This also supports returning the results in the underlying batched groups.
 * You can use this if you expect to fill a  limited-size buffer immediately and
 * want those first results ASAP rather than after a timeout.
 */
export class BatchTools<I, O> extends Debuggable implements MultiBatchable<I, O> {
    /**
     * Batches which are no longer accepting entries, ie ready to send or later.
     * This includes ones which are simply not finished yet.
     */
    private batches: Batch<I, O>[] = []

    /**
     * The batch which is currently (or most recently) accepting entries. By the
     * time of any given call, this might no longer be accepting entries, so
     * this will get checked often.
     */
    private lastActiveBatch: Batch<I, O> | null = null

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
                this.handler,
                this.sendCondition,
                this.batches.length + 1 > this.parallelLimit
            )
        }
        return this.lastActiveBatch
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
    protected getBatchPromises(...items: I[]) {
        const promises: Promise<O[]>[] = []
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
     * @param handler Somewhat like .then() but can be called many times
     * @param sendCondition
     * @param parallelLimit How many batches to have runnable at once
     */
    constructor(private handler: (...items: I[]) => Promise<O[]>,
        private sendCondition?: BatchSendCondition<I>,
        private parallelLimit = Infinity
    ) {
        super()
    }

    abort() {
        this.debugLog("Abort, stopping all batches")
        for(const batch of this.batches) {
            batch.abort()
        }
        this.batches = []
        this.lastActiveBatch?.abort()
        this.lastActiveBatch = null
        return true
    }

    /**
     * Adds multiple items to one or more batches. Returns when done.
     *
     * Important note: this will only be done when all of them are, which means
     * you'll probably have to wait for the timeout.
     *
     * @param items
     * @returns
     */
    async callMulti(...items: I[]): Promise<O[]> {
        const out: O[] = []
        for(const promise of this.getBatchPromises(...items)) {
            out.push(...(await promise))
        }
        return out
    }

    /**
     * Adds multiple items to one or more batches. Returns an iterator which
     * will resolve with each batch.
     *
     * @param ts
     * @returns
     */
    async *callMultiIterableBatch(...ts: I[]): AsyncIterable<O[]> {
        for(const promise of this.getBatchPromises(...ts)) {
            yield await promise
        }
    }

    /**
     * Adds multiple items to one or more batches. Returns an iterator which
     * will resolve with each individual item.
     *
     * You almost certainly _do_not_want_ this for large datasets, because the
     * execution context will be kicked out between each iteration - assume
     * it'll add 10ms per loop iteration.
     *
     * @param ts
     * @returns
     */
    async *callMultiIterableSingle(...ts: I[]): AsyncIterable<O> {
        for(const promise of this.getBatchPromises(...ts)) {
            for(const v of await promise) {
                yield v
            }
        }
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
    async include(item: I): Promise<O> {
        const [promise] = this.getBatchPromises(item)
        const result = await promise
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
        this.lastActiveBatch = new Batch(this.handler, this.sendCondition)
    }
}