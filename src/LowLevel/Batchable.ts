import { ExtensiblePromise } from "./ExtensiblePromise"

/**
 *
 */
export interface Batchable<I, O = I> extends ExtensiblePromise<O[]> {
    /**
     *
     */
    readonly canAdd: boolean
    /**
     *
     */
    delay: boolean
    /**
     *
     */
    readonly size: number
    /**
     *
     */
    abort(): void

    /**
     *
     * @param items
     */
    add(...items: I[]): any

    /**
     *
     */
    finish(): void
}