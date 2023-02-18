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
    private resolveOnce() {
        if (!this.resolved) {
            this.resolved = true
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
            setTimeout(() => this.resolveOnce(), delayMs)
        })
    }

    /**
     * Adds an item to the batch.
     *
     * @param item
     */
    add(item: I) {
        if (this.resolved) {
            throw new Error(`Object can no longer be loaded after being resolved`)
        }
        this.items.add(item)
        if (this.items.size >= this.bufferCapacity) {
            this.resolveOnce()
        }
        return this
    }
}