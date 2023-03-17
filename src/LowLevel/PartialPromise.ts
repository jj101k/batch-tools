/**
 * Some work handled by a promise, some not.
 */
export interface PartialPromise<P> {
    /**
     * The promise used
     */
    promise: Promise<P>
    /**
     * The amount of work which could not be handled. This is guaranteed to be
     * at the end of the list.
     */
    remaining: number
}
