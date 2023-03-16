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
 *
 * As a promise, this is triggered when selection is complete; this has no
 * bearing on when actions which were in turn triggered by the selection were
 * completed.
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
    private _ready = false

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
     */
    private conditionallyResolve() {
        this._ready = true
        if(!this.defer) {
            this.debugLog("Resolve")
            this.resolveOnce()
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
    get defer() {
        return this._defer
    }

    set defer(v) {
        const o = this._defer
        this._defer = v
        if(o && !v && this.ready) {
            this.debugLog("Resolve - defer flag cleared")
            this.resolveOnce()
        }
    }

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
    get ready() {
        return this._ready
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
     * @param defer
     */
    constructor(
        private delayMs: number | null = 50,
        private bufferCapacity = Infinity,
        private _defer = false
    ) {
        super()
        this.debugLog({delayMs, bufferCapacity, _defer})

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
                this.conditionallyResolve()
            }, this.delayMs)
        }
        if (!this.isFull) {
            this.pendingItems.add(item)
            this.debugLog("Added", item, this.pendingItems.size)
            if (this.pendingItems.size >= this.bufferCapacity) {
                this.debugLog("Resolve on buffer fill")
                this.conditionallyResolve()
            }
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
        this.conditionallyResolve()
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