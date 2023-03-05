import { BatchToolsSingle } from "./BatchToolsSingle"

/**
 * @see BatchToolsSingle
 *
 * Here, you can ask for multiple items to be handled, and get a promise
 * resolving when all are done. If they end up split across multiple batches
 * (only applicable where there's a batch limit), you won't see results until
 * the last one. If any fail, the whole thing fails.
 */
export class BatchTools<T, U> extends BatchToolsSingle<T, U> {
    /**
     * Adds multiple items to one or more batches. Returns when done.
     *
     * Important note: this will only be done when all of them are, which means
     * you'll probably have to wait for the timeout.
     *
     * @param items
     * @returns
     */
    async callMulti(...items: T[]): Promise<U[]> {
        const out: U[] = []
        for(const promise of this.getBatchPromises(...items)) {
            out.push(...(await promise))
        }
        return out
    }
}