/**
 * This is a lightweight wrapper around a promise to give you something which
 * won't run immediately but will on request.
 */
export class TriggerPromise<T> implements PromiseLike<T> {
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
        this.reject(new Error("Cancelled"))
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
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): PromiseLike<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected)
    }
}