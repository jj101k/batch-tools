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
    private id: number | null = null

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
            if(this.id === null) {
                this.id = Math.floor(Math.random() * 1000)
            }
            console.log(this.id, message, ...otherContent)
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
        private delayMs: number | null = 50,
        private bufferCapacity = Infinity,
    ) {
        super()
        this.debugLog({delayMs, bufferCapacity})

        this.promise = new TriggerPromise(() => [...this.items])
    }

    /**
     * This will stop the actions which would resolve the promise. This does
     * nothing if the promise is already resolved or aborted.
     *
     * @returns true if the action did anything.
     */
    abort() {
        if(!this.resolved && !this.aborted) {
            this.debugLog("Abort")
            this.aborted = true
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            this.pendingItems.clear()
            return true
        } else {
            this.debugLog("No abort, already resolved or aborted")
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
        if(!this.timeout && this.delayMs !== null) {
            this.timeout = setTimeout(() => {
                this.debugLog("Resolve on timeout")
                this.resolveOnce()
            }, this.delayMs)
        }
        this.pendingItems.add(item)
        this.debugLog("Added", item, this.pendingItems.size)
        if (this.pendingItems.size >= this.bufferCapacity) {
            this.debugLog("Resolve on buffer fill")
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
        this.debugLog("Resolve on finish")
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