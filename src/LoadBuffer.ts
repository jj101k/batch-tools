/**
 * This is a promise used by a load buffer - always returns a map
 */
export type LoadBufferPromise<K, T> = Promise<Map<K, T>>

/**
 * This provides a loading buffer which will hang around for `delayMs` milliseconds
 * before invoking `then` with the accumulated keys
 */

export class LoadBuffer<K, T> {
    /**
     *
     */
    private readonly promise: LoadBufferPromise<K, T>

    /**
     *
     */
    private toLoad: K[] = []

    /**
     *
     * @param delayMs
     * @returns
     */
    private async init(delayMs: number) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return this.toLoad
    }

    /**
     *
     * @param then
     * @param delayMs
     */
    constructor(
        then: (keys: K[]) => LoadBufferPromise<K, T>,
        delayMs: number = 50
    ) {
        this.promise = this.init(delayMs).then(then)
    }

    /**
     * Adds a key to the batch.
     *
     * @param key
     * @returns A promise resolving when the batch is complete
     */
    push(key: K) {
        this.toLoad.push(key)
        return this.promise
    }
}
