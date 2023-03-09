import { Cancelled } from "../Errors"
import { ExtensiblePromise } from "./ExtensiblePromise"

/**
 * This is a lightweight wrapper around a promise to give you something which
 * won't run immediately but will on request.
 */
export class TriggerPromise<T> extends ExtensiblePromise<T> {
    /**
     *
     */
    protected promise: Promise<T>

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
        super()
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
}