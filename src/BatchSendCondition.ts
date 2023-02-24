/**
 * You probably want to set timeoutMs here.
 */

export interface BatchSendCondition {
    limit?: number
    /**
     * You almost certainly want to set this, otherwise you may need to send
     * batches manually.
     */
    timeoutMs?: number
}
