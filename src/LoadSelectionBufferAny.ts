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
     * @param delay
     */
    constructor(
        getKey: (item: I) => K,
        sendCondition?: BatchSendCondition<I>,
        delay = false
    ) {
        super(sendCondition, delay)
        this.pendingItems = new PseudoSet(new PseudoMap(getKey))
    }
}
