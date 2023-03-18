import { InvalidState } from "./Errors"
import { Batchable } from "./LowLevel/Batchable"
import { BatchSendCondition } from "./LowLevel/BatchSendCondition"
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
export class LoadSelectionBuffer<I> extends ExtensiblePromise<I[]> implements Batchable<I> {
    /**
     *
     */
    private aborted = false

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
     *
     */
    private get delayMs() {
        return this.sendCondition.timeoutMs ?? null
    }

    /**
     *
     */
    private get isFull() {
        if(this.sendCondition.fitsItems) {
            return this.sendCondition.fitsItems([...this.pendingItems]) <= this.pendingItems.size
        } else if(this.sendCondition.maxItems !== undefined) {
            return this.size + 1 > this.sendCondition.maxItems
        } else {
            return false
        }
    }

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
        if(!this.delay) {
            this.debugLog("Resolve")
            this.resolveOnce()
        }
    }

    /**
     *
     * @param items
     */
    private loadableItems(items: I[]) {
        if(this.sendCondition.fitsItems) {
            const fitCount = this.sendCondition.fitsItems([...this.pendingItems, ...items])
            return items.slice(0, fitCount - this.pendingItems.size)
        } else if(this.sendCondition.maxItems !== undefined) {
            return items.slice(0, this.sendCondition.maxItems - this.pendingItems.size)
        } else {
            return items
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
    get canAdd() {
        return !this.resolved && !this.aborted && !this.isFull
    }

    /**
     *
     */
    get delay() {
        return this._delay
    }

    set delay(v) {
        const o = this._delay
        this._delay = v
        if(o && !v && this.ready) {
            this.debugLog("Resolve - defer flag cleared")
            this.resolveOnce()
        }
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
     * @param sendCondition
     * @param delay
     */
    constructor(
        private sendCondition: BatchSendCondition<I> = {timeoutMs: 50},
        private _delay = false
    ) {
        super()
        this.debugLog({sendCondition, delay: _delay})

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
     * Adds items to the batch.
     *
     * @param items
     * @throws
     * @returns The number of items which could not be loaded
     */
    add(...items: I[]) {
        this.assertIsWritable()
        if(!this.timeout && this.delayMs !== null) {
            this.timeout = setTimeout(() => {
                this.debugLog("Resolve on timeout")
                this.conditionallyResolve()
            }, this.delayMs)
        }
        const loadableItems = this.loadableItems(items)
        for(const item of loadableItems) {
            this.pendingItems.add(item)
            this.debugLog("Added", item, this.pendingItems.size)
        }
        if (this.isFull) {
            this.debugLog("Resolve on buffer fill")
            this.conditionallyResolve()
        }
        return items.length - loadableItems.length
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