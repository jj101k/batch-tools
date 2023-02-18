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
        throw new Error("Internal error: resolved too early")
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
            throw new Error(`Selection can no longer be modified after being aborted`)
        } else if (this.resolved) {
            throw new Error(`Selection can no longer be modified after being resolved`)
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
            this.resolve([...this.items.values()])
        }
    }

    /**
     *
     */
    protected items = new Set<I>()

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
     * @throws
     */
    abort() {
        if(this.resolved) {
            throw new Error("Cannot abort - already resolved")
        }
        if(!this.aborted) {
            this.aborted = true
            if(this.timeout) {
                clearTimeout(this.timeout)
                this.timeout = null
            }
            this.items.clear()
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
        this.items.add(item)
        if (this.items.size >= this.bufferCapacity) {
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
        return this.items.delete(item)
    }
}