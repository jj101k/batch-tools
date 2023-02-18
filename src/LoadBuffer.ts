import { LoadSelectionBuffer } from "./LoadSelectionBuffer"

/**
 * This provides a loading buffer which will hang around for `delayMs`
 * milliseconds before resolving with the result. This is intended for
 * multiplexing what would otherwise be many separate calls together.
 *
 * This wraps the underlying promise
 */
export abstract class LoadBuffer<K, R, I = K> implements Promise<Map<K, R>> {
    /**
     *
     */
    protected promise: Promise<Map<K, R>>

    get [Symbol.toStringTag]() {
        return "LoadBuffer"
    }

    public readonly catch: Promise<Map<K, R>>["catch"]

    public readonly finally: Promise<Map<K, R>>["finally"]

    public readonly then: Promise<Map<K, R>>["then"]

    /**
     *
     * @param then
     * @param loadBuffer
     */
    constructor(then: (items: I[]) => Promise<Map<K, R>>, protected loadBuffer = new LoadSelectionBuffer<I>()) {
        this.promise = loadBuffer.then(then)

        this.catch = this.promise.catch
        this.finally = this.promise.finally
        this.then = this.promise.then
    }

    /**
     * Adds an item to the batch.
     *
     * @param item
     * @returns A promise resolving with the item's resultant value
     */
    abstract include(item: I): Promise<R | undefined>
}