import { LoadBuffer } from "./LoadBuffer"
import { PseudoMap } from "./PseudoMap"
import { LoadBufferCollection } from "./LoadBufferCollection"
import { LoadSelectionBufferAny } from "./LoadSelectionBufferAny"

/**
 * @see LoadBufferCollection
 *
 * A load buffer collection with any type of object.
 */

export class LoadBufferCollectionAny<K extends string | number, R, I> extends LoadBufferCollection<I, R> {
    protected items = new PseudoMap<K, LoadBuffer<I, R>, I>(this.getKey);

    protected createLoadBuffer(): LoadBuffer<I, R> {
        return new LoadBuffer(this.handler, new LoadSelectionBufferAny(this.getKey))
    }

    /**
     *
     * @param getKey
     * @param then Note that this must return a map of items to results, eg. a PseudoMap.
     */
    constructor(private getKey: (item: I) => K, then: (items: I[]) => Promise<Map<I, R>>) {
        super(then)
    }
}
