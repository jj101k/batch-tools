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

    /**
     * @see LoadSelectionBuffer#isFull
     */
    get isFull() {
        return this.loadSelectionBuffer.isFull
    }

    /**
     *
     */
    get items() {
        return this.loadSelectionBuffer.items
    }

    get [Symbol.toStringTag]() {
        return "LoadBuffer"
    }

    public readonly catch: Promise<Map<K, R>>["catch"]

    public readonly finally: Promise<Map<K, R>>["finally"]

    public readonly then: Promise<Map<K, R>>["then"]

    /**
     *
     * @param then
     * @param loadSelectionBuffer
     */
    constructor(then: (items: I[]) => Promise<Map<K, R>>, protected loadSelectionBuffer = new LoadSelectionBuffer<I>()) {
        this.promise = loadSelectionBuffer.then(then)

        this.catch = this.promise.catch
        this.finally = this.promise.finally
        this.then = this.promise.then
    }

    /**
     * This will stop the actions which would resolve the promise. This does
     * nothing if the promise is already resolved or aborted.
     *
     * @returns true if the action did anything.
     */
    abort() {
        return this.loadSelectionBuffer.abort()
    }

    /**
     * Adds an item to the batch.
     *
     * @param item
     * @returns A promise resolving with the item's resultant value or, if
     * removed, undefined.
     */
    abstract include(item: I): Promise<R | undefined>

    /**
     * Removes an item from the batch. The relevant promises will still be
     * triggered, but with undefined values.
     *
     * Removing then re-adding the same item has no effect.
     *
     * @param item
     * @returns
     */
    remove(item: I): boolean {
        return this.loadSelectionBuffer.delete(item)
    }
}