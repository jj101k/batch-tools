/**
 * An expression that some work is promised to be done via a method, and some is
 * _not_, ie you need to make separate arrangements (eg. a new object) for some
 * of the work.
 */
export interface PartialPromise<P extends Array<any>> {
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
