/**
 * This is for a batch system which accepts items of type I and promises to
 * return results of type O.
 */
export interface Batchable<I, O> {
    /**
     * Halts all operations in progress, emitting errors as appropriate.
     * Primarily of interest for testing.
     *
     * @returns false if already aborted
     */
    abort(): boolean

    /**
     * Adds an item to be handled
     *
     * @param item
     * @returns A promise resolving with the item's resultant value
     */
    include(item: I): Promise<O>
}