import { LoadSelectionBuffer } from "./LoadSelectionBuffer"
import { PseudoSet } from "./PseudoSet"

/**
 * @see LoadSelectionBuffer
 *
 * This is the same as LoadSelectionBuffer but supports non-primitive objects.
 */
export class LoadSelectionBufferAny<K extends string | number, I> extends LoadSelectionBuffer<I> {
    /**
     *
     */
    protected pendingItems: PseudoSet<I, K>

    /**
     *
     * @param delayMs
     * @param bufferCapacity
     */
    constructor(
        getKey: (item: I) => K,
        delayMs: number = 50,
        bufferCapacity = Infinity
    ) {
        super(delayMs, bufferCapacity)
        this.pendingItems = new PseudoSet(getKey)
    }
}
