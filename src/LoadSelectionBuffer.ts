import { InvalidState } from "./Errors"
import { ExtensiblePromise } from "./LowLevel/ExtensiblePromise"
import { TriggerPromise } from "./LowLevel/TriggerPromise"

/**
 * @see Batch which does something similar
 *
 * This provides a loading buffer which will hang around for `delayMs` milliseconds
 * before resolving with the accumulated array of values.
 *
 * This class only handles assembling the set of items to work on. To do the
 * work (and get the results), you'll want to chain a .then() or await it.
 *
 * If you need to operate on non-primitive objects, use LoadSelectionBufferAny.
 */
export class LoadSelectionBuffer<I> extends ExtensiblePromise<I[]> {
    /**
     *
     */
    private aborted = false

    /**
     *
     */
    private debug = false

    /**
     *
     */
    private resolved = false

    /**
     *
     */
    private timeout: NodeJS.Timeout | null = null

    /**
     * @throws
     */
    private assertIsWritable() {
        if (this.aborted) {
            throw new InvalidState(`Selection can no longer be modified after being aborted`)
        } else if (this.resolved) {
            throw new InvalidState(`Selection can no longer be modified after being resolved`)
        }
    }

    /**
     *
     * @param message
     * @param otherContent
     */
    private debugLog(message: any, ...otherContent: any[]) {
        if (this.debug) {
            console.log(message, ...otherContent)
        }
    }

    /**
     *
     */
    private resolveOnce() {
        if (!this.resolved) {
            this.resolved = true
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            this.debugLog("Resolving", this.pendingItems)
            this.promise.activate()
        }
    }

    /**
     *
     */
    protected pendingItems = new Set<I>()

    protected promise: TriggerPromise<I[]>

    /**
     *
     */
    get isFull() {
        return this.size >= this.bufferCapacity
    }

    /**
     *
     */
    get items() {
        return this.pendingItems.values()
    }

    /**
     *
     */
    get size() {
        return this.pendingItems.size
    }

    /**
     *
     * @param delayMs
     * @param bufferCapacity
     */
    constructor(
        delayMs: number = 50,
        private bufferCapacity = Infinity
    ) {
        super()
        this.debugLog({delayMs, bufferCapacity})

        this.promise = new TriggerPromise(() => [...this.items])
        this.timeout = setTimeout(() => this.resolveOnce(), delayMs)
    }

    /**
     * This will stop the actions which would resolve the promise. This does
     * nothing if the promise is already resolved or aborted.
     *
     * @returns true if the action did anything.
     */
    abort() {
        if(this.resolved && !this.aborted) {
            this.aborted = true
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            this.pendingItems.clear()
            return true
        } else {
            return false
        }
    }

    /**
     * Adds an item to the batch.
     *
     * @param item
     * @throws
     * @returns
     */
    add(item: I) {
        this.assertIsWritable()
        this.pendingItems.add(item)
        if (this.pendingItems.size >= this.bufferCapacity) {
            this.resolveOnce()
        }
        return this
    }

    /**
     *
     * @param item
     * @throws
     * @returns
     */
    delete(item: I) {
        this.assertIsWritable()
        return this.pendingItems.delete(item)
    }

    /**
     *
     * @returns
     */
    finish() {
        return this.promise.activate()
    }

    /**
     *
     * @param item
     * @returns
     */
    has(item: I) {
        return this.pendingItems.has(item)
    }
}