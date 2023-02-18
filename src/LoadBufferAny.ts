import { LoadBuffer } from "./LoadBuffer"
import { LoadSelectionBufferAny } from "./LoadSelectionBufferAny"

/**
 * @see LoadBuffer
 *
 * This class operates on non-primitives which can be converted to primitives.
 */
export class LoadBufferAny<I, K extends string | number, R> extends LoadBuffer<K, R, I> {
    /**
     *
     * @param getKey
     * @param then
     * @param loadBuffer
     */
    constructor(private getKey: (item: I) => K, then: (items: I[]) => Promise<Map<K, R>>,
        loadBuffer = new LoadSelectionBufferAny(getKey)
    ) {
        super(then, loadBuffer)
        this.promise = loadBuffer.then(then)
    }

    /**
     * Adds an item to the batch.
     *
     * @param item
     * @returns A promise resolving with the item's resultant value
     */
    include(item: I) {
        this.loadBuffer.add(item)
        const k = this.getKey(item)
        return this.promise.then(v => v.get(k))
    }
}
