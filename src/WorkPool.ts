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
     * This tracks how many items were filled in a second.
     */
    private oneSecondFillStats: {startTs: number, count: number} | null = null

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
     *
     */
    private get currentSecondFillStats() {
        const nowTs = new Date().valueOf()
        if(!this.oneSecondFillStats || this.oneSecondFillStats.startTs < nowTs - this.maxFillRate.ms) {
            this.oneSecondFillStats = {startTs: nowTs, count: 0}
        }
        return this.oneSecondFillStats
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
        for(; this.active < this.capacity; this.currentSecondFillStats.count++) {
            const currentSecondFillStats = this.currentSecondFillStats
            if(currentSecondFillStats.count >= this.maxFillRate.count) {
                console.warn("WorkPool: Possible work loop, rescheduling to the end of the second")
                // Reschedule to the end of the second.
                const nowTs = new Date().valueOf()
                setTimeout(() => this.fillActive(), currentSecondFillStats.startTs + this.maxFillRate.ms - nowTs)
                break
            }
            const item = this.backlog.shift()
            if(!item) break
            const p = item()
            this.active++
            p.finally(() => this.active--)
        }
    }

    /**
     *
     * @param capacity
     * @param maxFillRate
     */
    constructor(public readonly capacity: number,
        private readonly maxFillRate: {count: number, ms: number} = {count: 1_000_000, ms: 1_000},
    ) {
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