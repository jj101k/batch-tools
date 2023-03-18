import { LoadSelectionBuffer } from "./LoadSelectionBuffer"
import { PseudoMap } from "./PseudoMap"
import { PseudoSet } from "./LowLevel/PseudoSet"
import { BatchSendCondition } from "./LowLevel/BatchSendCondition"

/**
 * @see LoadSelectionBuffer
 *
 * This is the same as LoadSelectionBuffer but supports non-primitive objects.
 */
export class LoadSelectionBufferAny<K extends string | number, I> extends LoadSelectionBuffer<I> {
    /**
     *
     */
    protected pendingItems: PseudoSet<I>

    /**
     *
     * @param getKey
     * @param sendCondition
     */
    constructor(
        getKey: (item: I) => K,
        sendCondition?: BatchSendCondition,
    ) {
        super(sendCondition)
        this.pendingItems = new PseudoSet(new PseudoMap(getKey))
    }
}
