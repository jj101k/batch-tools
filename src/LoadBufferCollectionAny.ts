import { LoadBuffer } from "./LoadBuffer"
import { LoadBufferAny } from "./LoadBufferAny"
import { PseudoMap } from "./PseudoMap"
import { LoadBufferCollection } from "./LoadBufferCollection"

/**
 * A load buffer collection with any type of object.
 */

export class LoadBufferCollectionAny<K extends string | number, R, I> extends LoadBufferCollection<I, R> {
    protected items = new PseudoMap<K, LoadBuffer<I, R>, I>(this.getKey);

    protected createLoadBuffer(): LoadBuffer<I, R> {
        return new LoadBufferAny(this.getKey, this.then)
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
