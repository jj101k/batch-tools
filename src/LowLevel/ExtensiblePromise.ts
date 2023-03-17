import { Debuggable } from "./Debuggable"

/**
 * This is a lightweight wrapper around a promise to allow you to effectively
 * extend it, because Promise itself is not extensible unless you have the same
 * constructor.
 */
export abstract class ExtensiblePromise<T> extends Debuggable implements Promise<T> {
    /**
     * Usable by the subclass if needed.
     */
    protected abstract promise: Promise<T>

    /**
     *
     */
    get [Symbol.toStringTag]() {
        return "ExtensiblePromise"
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
        this.promise.finally(onfinish)
        return this
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