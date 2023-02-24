import { BatchToolsBase } from "./BatchToolsBase"

/**
 *
 */
export class BatchTools<T, U> extends BatchToolsBase<T, U> {
    /**
     * Adds multiple items to one or more batches. Returns when done.
     *
     * Important note: this will only be done when all of them are, which means
     * you'll probably have to wait for the timeout.
     *
     * @param ts
     * @returns
     */
    async callMulti(...ts: T[]): Promise<U[]> {
        const out: U[] = []
        for(const promise of this.getBatchPromises(...ts)) {
            out.push(...(await promise))
        }
        return out
    }
}