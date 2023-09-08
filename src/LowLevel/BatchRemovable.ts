import { BatchSendCondition, SelectionBufferSparse } from "@jdframe/selection-buffer"
import { BatchBase } from "./BatchBase"
import { BatchState } from "./BatchState"

/**
 * This represents a single batch of actions to take. Items are removable from
 * this object, which makes it a little more complex.
 *
 * @see Batch
 * @see BatchBase
 */
export class BatchRemovable<I, O> extends BatchBase<I, O, I | undefined, O | undefined> {
    protected async getResults(worker: (...ts: I[]) => Promise<O[]>, backlog: (I | undefined)[]): Promise<(O | undefined)[]> {
        const results = await super.getResults(worker, backlog)
        const resultsSparse: (O | undefined)[] = []
        let p = 0
        for(const i of backlog) {
            if(i === undefined) {
                resultsSparse.push(undefined)
            } else {
                resultsSparse.push(results[p++])
            }
        }
        return resultsSparse
    }

    protected postInit(worker: (...ts: I[]) => Promise<O[]>, sendCondition?: BatchSendCondition<I> | undefined, delay?: boolean): void {
        this.selectionBuffer = new SelectionBufferSparse<I>(sendCondition, delay)
    }

    protected workableBacklog(backlog: (I | undefined)[]): I[] {
        const w: I[] = []
        for(const b of backlog) {
            if(b !== undefined) {
                w.push(b)
            }
        }
        return w
    }

    /**
     *
     * @param items
     * @returns True if anything was removed
     */
    remove(...items: I[]): boolean {
        this.debugLog("Remove")
        if (this.internalState > BatchState.ReadyToSend) {
            this.debugLog("Cannot remove")
            return false
        }

        for(const item of items) {
            this.selectionBuffer.delete(item)
        }

        this.debugLog(`${items.length} removed`)
        return true
    }
}
