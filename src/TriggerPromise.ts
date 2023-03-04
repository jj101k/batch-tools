import { Cancelled } from "./Errors"

/**
 * This is a lightweight wrapper around a promise to give you something which
 * won't run immediately but will on request.
 */
export class TriggerPromise<T> implements Promise<T> {
    /**
     *
     */
    private promise: Promise<T>

    /**
     *
     */
    private reject!: (error?: any) => void

    /**
     *
     */
    private resolve!: (value: any) => void

    /**
     *
     */
    get [Symbol.toStringTag]() {
        return "TriggerPromise"
    }

    /**
     *
     * @param action The action to be performed on activate
     */
    constructor(action: () => Promise<T> | T) {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject
            this.resolve = resolve
        }).then(action)
    }

    /**
     * Do the work.
     */
    activate() {
        this.resolve(null)
    }

    /**
     * Give up on the work.
     */
    cancel() {
        this.reject(new Cancelled())
    }

    /**
     *
     * @param onrejected
     * @returns
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult> {
        return this.promise.catch(onrejected)
    }

    /**
     *
     * @param onfinish
     * @returns
     */
    finally(onfinish: () => any) {
        return this.promise.finally(onfinish)
    }

    /**
     *
     * @param onfulfilled
     * @param onrejected
     * @returns
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected)
    }
}