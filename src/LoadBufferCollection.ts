import { BatchSendCondition, SelectionBuffer } from "@jdframe/selection-buffer"
import { MultiBatchable } from "./MultiBatchable"

/**
 *
 */
interface LoadResultBuffer<K, R> {
    /**
     *
     */
    buffer: SelectionBuffer<K>
    /**
     *
     */
    promise: Promise<Map<K, R>>
}

/**
 * @see BatchTools which does something similar
 *
 * This wraps multiple load buffers so that they can be sent serially or with
 * limited parallelism.
 *
 * This can safely be filled, allowed to drain, then refilled. For that reason
 * it doesn't have a promise interface.
 */
export class LoadBufferCollection<I, O> implements MultiBatchable<I, O> {
    /**
     *
     */
    private loadResultBuffers: LoadResultBuffer<I, O>[] = []

    /**
     *
     * @returns
     */
    protected buildLoadSelectionBuffer(): SelectionBuffer<any> {
        return new SelectionBuffer(this.sendCondition)
    }

    /**
     *
     */
    protected get currentLoadResultBuffer() {
        const lastLoadResultBuffer = this.loadResultBuffers[this.loadResultBuffers.length - 1]
        if(!lastLoadResultBuffer?.buffer.canAdd) {
            const buffer = this.buildLoadSelectionBuffer()
            const promise = buffer.then(this.handler)
            buffer.then(() => {
                for(const item of buffer.items) {
                    this.items.delete(item)
                }
            })
            const loadResultBuffer = {buffer, promise}
            this.loadResultBuffers.push(loadResultBuffer)
            return loadResultBuffer
        } else {
            return lastLoadResultBuffer
        }
    }

    /**
     *
     */
    protected items = new Map<I, LoadResultBuffer<I, O>>()

    /**
     *
     * @param handler Somewhat like .then() but can be called many times
     * @param sendCondition
     */
    constructor(protected handler: (items: I[]) => Promise<Map<I, O>>,
        private sendCondition?: BatchSendCondition<I>) {
    }

    abort() {
        if(this.loadResultBuffers.length) {
            for(const resultBuffer of this.loadResultBuffers) {
                resultBuffer.buffer.abort()
            }
            this.loadResultBuffers = []
            this.items.clear()
            return true
        } else {
            return false
        }
    }

    async include(item: I): Promise<O> {
        let loadResultBuffer = this.items.get(item)
        if(!loadResultBuffer) {
            loadResultBuffer = this.currentLoadResultBuffer
            this.items.set(item, loadResultBuffer)
        }
        loadResultBuffer.buffer.add(item)
        const m = await loadResultBuffer.promise
        if(loadResultBuffer.buffer.has(item)) {
            return m.get(item)!
        } else {
            throw new Error("Not loaded")
        }
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
            return bufferReference.buffer.delete(item)
        } else {
            return false
        }
    }
}