import { LoadBuffer } from "./LoadBuffer"

/**
 * @see BatchTools which does something similar
 *
 * This applies where your load buffers have a meaningful size limit. If they
 * don't, you can just use LoadBuffer.
 *
 * This wraps multiple load buffers so that they can be sent serially or with
 * limited parallelism.
 *
 * This can safely be filled, allowed to drain, then refilled. For that reason
 * it doesn't have a promise interface.
 *
 * This class operates on primitives, eg. IDs, there is a class
 * LoadBufferCollectionAny if you want to operate on raw objects.
 */
export abstract class LoadBufferCollection<K, R> {
    /**
     *
     */
    private buffers: LoadBuffer<K, R>[] = []

    /**
     *
     */
    protected get currentLoadBuffer() {
        // FIXME race: it may have resolved
        const lastLoadBuffer = this.buffers[this.buffers.length - 1]
        if(!lastLoadBuffer || lastLoadBuffer.isFull) {
            const buffer = this.createLoadBuffer()
            buffer.then(() => {
                for(const item of buffer.items) {
                    this.items.delete(item)
                }
            })
            this.buffers.push(buffer)
            return buffer
        } else {
            return lastLoadBuffer
        }
    }

    /**
     *
     */
    protected createLoadBuffer(): LoadBuffer<K, R> {
        return new LoadBuffer(this.then)
    }

    /**
     *
     */
    protected items = new Map<K, LoadBuffer<K, R>>()

    /**
     *
     * @param then
     */
    constructor(protected then: (items: K[]) => Promise<Map<K, R>>) {
    }

    /**
     * This remove and halt all the load buffers.
     *
     * @returns true if the action did anything.
     */
    abort() {
        if(this.buffers.length) {
            for(const buffer of this.buffers) {
                buffer.abort()
            }
            this.buffers = []
            this.items.clear()
            return true
        } else {
            return false
        }
    }

    /**
     * Adds an item to a batch.
     *
     * @param item
     * @returns A promise resolving with the item's resultant value or, if
     * removed, undefined.
     */
    include(item: K): Promise<R | undefined> {
        let bufferReference = this.items.get(item)
        if(!bufferReference) {
            bufferReference = this.currentLoadBuffer
            this.items.set(item, bufferReference)
        }
        return bufferReference.include(item)
    }

    /**
     * Removes an item from a batch. The relevant promises will still be
     * triggered, but with undefined values.
     *
     * Removing then re-adding the same item has no effect.
     *
     * @param item
     * @returns
     */
    remove(item: K): boolean {
        const bufferReference = this.items.get(item)
        if(bufferReference) {
            this.items.delete(item)
            return bufferReference.remove(item)
        } else {
            return false
        }
    }
}