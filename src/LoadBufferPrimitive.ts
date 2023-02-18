import { LoadBuffer } from "./LoadBuffer"

/**
 * @see LoadBuffer
 *
 * This class operates on primitives, eg. IDs.
 */
export class LoadBufferPrimitive<K extends string | number, R> extends LoadBuffer<K, R> {
    /**
     * Adds an item to the batch.
     *
     * @param item
     * @returns A promise resolving with the item's resultant value
     */
    include(item: K) {
        this.loadSelectionBuffer.add(item)
        return this.promise.then(v => v.get(item))
    }
}