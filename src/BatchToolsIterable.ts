import { BatchToolsSingle } from "./BatchToolsSingle"

/**
 * This is a variation on BatchTools which supports returning the results in the
 * underlying batched groups. You can use this if you expect to fill a
 * limited-size buffer immediately and want those first results ASAP rather than
 * after a timeout.
 */
export class BatchToolsIterable<T, U> extends BatchToolsSingle<T, U> {
    /**
     * Adds multiple items to one or more batches. Returns an iterator which
     * will resolve with each batch.
     *
     * @param ts
     * @returns
     */
    async *callMultiIterableBatch(...ts: T[]): AsyncIterable<U[]> {
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
    async *callMultiIterableSingle(...ts: T[]): AsyncIterable<U> {
        for(const promise of this.getBatchPromises(...ts)) {
            for(const v of await promise) {
                yield v
            }
        }
    }
}