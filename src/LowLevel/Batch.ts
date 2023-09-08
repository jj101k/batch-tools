import { BatchBase } from "./BatchBase"

/**
 * This represents a single batch of actions to take. Items are not removable
 * from this object, which makes it a little simpler.
 *
 * @see BatchRemovable
 * @see BatchBase
 */
export class Batch<I, O> extends BatchBase<I, O> {
    protected workableBacklog(backlog: I[]): I[] {
        return backlog
    }
}
