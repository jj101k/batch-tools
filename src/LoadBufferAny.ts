import { LoadBuffer } from "./LoadBuffer"
import { LoadSelectionBufferAny } from "./LoadSelectionBufferAny"

/**
 * @see LoadBuffer
 *
 * This class operates on non-primitives which can be converted to primitives.
 */
export class LoadBufferAny<I, K extends string | number, R> extends LoadBuffer<I, R> {
    /**
     *
     * @param getKey
     * @param then Note that this must return a map of items to results, eg. a PseudoMap.
     * @param loadBuffer
     */
    constructor(getKey: (item: I) => K, then: (items: I[]) => Promise<Map<I, R>>,
        loadBuffer = new LoadSelectionBufferAny(getKey)
    ) {
        super(then, loadBuffer)
        this.promise = loadBuffer.then(then)
    }
}
