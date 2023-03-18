import { BatchFitDetector } from "../BatchFitDetector"

/**
 * The theme here is "turn O(n) actions in quick succession into as few as we
 * can manage". The main mitigation is to set a timeout before sending all of
 * them as a batch. It's not the fewest number of calls possible, but it's O(1).
 * Technologically, this allows you to spam individual calls from, for example,
 * a UI framework and let it get collated into an individual batch.
 *
 * You might have limits on your batches also, eg. your back end might support
 * only 25 items per batch. There's a limit option to express that, and items
 * past the limit won't be accepted. Once the limit is hit, it'll send
 * immediately because there isn't any reduction in calls by delaying further -
 * the delay is only for reducing calls. You don't have to use a delay with
 * this, but it's wise because otherwise the partial batch at the end won't get
 * sent.
 *
 * TL;DR: You probably want to set timeoutMs here.
 */
export interface BatchSendCondition<I> {
    /**
     *
     */
    fits?: BatchFitDetector<I>
    /**
     * You almost certainly want to set this, otherwise you may need to send
     * batches manually. A good number might be 50(ms).
     */
    timeoutMs?: number
}
