/**
 * This provides a work pool with a limited capacity.
 */
export class WorkPool {
    /**
     *
     */
    private _active = 0

    /**
     * @see fillActive()
     *
     * This should start at zero and be reduced to zero after a fill pass.
     */
    private singlePassFillCount = 0

    /**
     *
     */
    private backlog: Array<() => (Promise<any> | any)> = []

    /**
     *
     */
    private get active() {
        return this._active
    }

    /**
     *
     */
    private set active(v) {
        const change = this._active - v
        if(change < 0) {
            this.fillActive()
        }
    }

    /**
     * Adds more active items.
     *
     * Note 1: while this is designed for async cases and therefore the active
     * work reduction will happen _after_ this finishes, it's possible that some
     * work will be immediate/synchronous. For that to work, we re-check the
     * capacity at every iteration.
     *
     * Note 2: Work items could add more work, in a possible infinite loop. So
     * we limit that.
     */
    private fillActive() {
        const maxFill = 1_000_000
        let startedFromZero = this.singlePassFillCount == 0
        try {
            let added = 0
            for(; this.active < this.capacity; added++, this.singlePassFillCount++) {
                if(this.singlePassFillCount >= maxFill) {
                    // Reschedule
                    setTimeout(() => this.fillActive(), 1000)
                    break
                }
                const item = this.backlog.shift()
                if(!item) break
                const p = item()
                this.active++
                p.finally(() => this.active--)
            }
        } finally {
            if(startedFromZero) {
                this.singlePassFillCount = 0
            }
        }
    }

    /**
     *
     * @param capacity
     */
    constructor(public readonly capacity: number) {
    }

    /**
     * Adds some work items, may call some of them.
     *
     * @param items
     */
    add(...items: Array<() => (Promise<any> | any)>) {
        this.backlog.push(...items)
        this.fillActive()
    }
}