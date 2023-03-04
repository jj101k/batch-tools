import { InvalidState } from "./Errors"

/**
 * This provides a loading buffer which will hang around for `delayMs` milliseconds
 * before resolving with the accumulated array of values.
 *
 * This class only handles assembling the set of items to work on. To do the
 * work (and get the results), you'll want LoadBuffer.
 *
 * If you need to operate on non-primitive objects, use LoadSelectionBufferAny.
 */
export class LoadSelectionBuffer<I> extends Promise<I[]> {
    /**
     *
     */
    private aborted = false

    /**
     *
     */
    private resolve: (value: I[]) => void = (value) => {
        // Can't happen unless someone messes with the Promise constructor
        throw new InvalidState("Internal error: resolved too early")
    };

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
    private resolveOnce() {
        if (!this.resolved) {
            this.resolved = true
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            this.resolve([...this.pendingItems.values()])
        }
    }

    /**
     *
     */
    protected pendingItems = new Set<I>()

    /**
     *
     */
    get isFull() {
        return this.pendingItems.size >= this.bufferCapacity
    }

    /**
     *
     */
    get items() {
        return this.pendingItems.values()
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
        super((resolve) => {
            this.resolve = resolve
            this.timeout = setTimeout(() => this.resolveOnce(), delayMs)
        })
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
}