import { LoadBuffer } from "./LoadBuffer"
import { LoadBufferAny } from "./LoadBufferAny"
import { LoadBufferPrimitive } from "./LoadBufferPrimitive"
import { PseudoMap } from "./PseudoMap"

/**
 * This applies where your load buffers have a meaningful size limit. If they
 * don't, you can just use LoadBufferPrimitive or LoadBufferAny.
 *
 * This wraps multiple load buffers so that they can be sent serially or with
 * limited parallelism.
 *
 * This can safely be filled, allowed to drain, then refilled. For that reason
 * it doesn't have a promise interface.
 */
export abstract class LoadBufferCollection<K extends string | number, R, I = K> {
    /**
     *
     */
    private buffers: LoadBuffer<K, R, I>[] = []

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
    protected abstract createLoadBuffer(): LoadBuffer<K, R, I>

    /**
     *
     */
    protected items = new Map<I, LoadBuffer<K, R, I>>()

    /**
     *
     * @param then
     */
    constructor(protected then: (items: I[]) => Promise<Map<K, R>>) {
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
    include(item: I): Promise<R | undefined> {
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
    remove(item: I): boolean {
        const bufferReference = this.items.get(item)
        if(bufferReference) {
            this.items.delete(item)
            return bufferReference.remove(item)
        } else {
            return false
        }
    }
}

/**
 * A load buffer collection with any type of object.
 */
export class LoadBufferCollectionAny<K extends string | number, R, I> extends LoadBufferCollection<K, R, I> {
    /**
     *
     */
    protected items = new PseudoMap<K, LoadBuffer<K, R, I>, I>(this.getKey)

    protected createLoadBuffer(): LoadBuffer<K, R, I> {
        return new LoadBufferAny(this.getKey, this.then)
    }

    /**
     *
     * @param getKey
     * @param then
     */
    constructor(private getKey: (item: I) => K, then: (items: I[]) => Promise<Map<K, R>>) {
        super(then)
    }
}

/**
 * A load buffer collection with primitive objects only.
 */
export class LoadBufferCollectionPrimitive<I extends string | number, R> extends LoadBufferCollection<I, R> {
    protected createLoadBuffer(): LoadBuffer<I, R, I> {
        return new LoadBufferPrimitive(this.then)
    }
}