/**
 *
 */
type PromisableFunction<T = any> = () => (Promise<T> | T)

/**
 * This provides a work pool with a limited work rate. Once it's busy, extra
 * work will be queued and then dequeued when more capacity is ready.
 *
 * This is designed to work with BatchTools in cases where you don't benefit
 * from more integrated pooling.
 *
 * Generally, you replace:
 *
 * await Promise.all([
 *  foo(),
 *  bar(),
 * ])
 *
 * ...with:
 *
 * const pool = new WorkPool(1)
 * await Promise.all([
 *  pool.add(foo),
 *  pool.add(bar)
 * ])
 */
export class WorkPool {
    /**
     *
     */
    private _active = 0

    /**
     *
     */
    private debug = false

    /**
     * @see activateItems()
     *
     * This tracks how many items were filled in the period.
     */
    private periodFillStats: {startTs: number, count: number} | null = null

    /**
     *
     */
    private backlog: Array<() => Promise<any>> = []

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
        this.debugLog(`Active to ${v}`)
        const change = v - this._active
        this._active = v
        if(change < 0) {
            this.debugLog("Checking for more items")
            this.activateItems()
        }
    }

    /**
     *
     */
    private get currentSecondFillStats() {
        if(!this.periodFillStats) {
            const nowTs = new Date().valueOf()
            this.periodFillStats = {startTs: nowTs, count: 0}
            setTimeout(() => this.periodFillStats = null, this.maxFillRate.ms)
        }
        return this.periodFillStats
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
    private activateItems() {
        for(; this.active < this.capacity; this.currentSecondFillStats.count++) {
            const currentSecondFillStats = this.currentSecondFillStats
            if(currentSecondFillStats.count >= this.maxFillRate.count) {
                console.warn(
                    `WorkPool: Possible work loop, rescheduling to the end of the ${this.maxFillRate.ms}ms period`
                )
                const nowTs = new Date().valueOf()
                setTimeout(() => this.activateItems(), currentSecondFillStats.startTs + this.maxFillRate.ms - nowTs)
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
     * @param message
     */
    private debugLog(message: string) {
        if (this.debug) {
            console.log(message)
        }
    }

    /**
     *
     * @param item
     * @returns A promise
     */
    private pushPromise<T = any>(item: PromisableFunction<T>) {
        return new Promise((resolve, reject) => { // Called immediately
            this.backlog.push(() => {
                try {
                    const p = Promise.resolve(item()) // Called and could throw
                    p.then(resolve, reject) // Won't throw
                    return p
                } catch(e) {
                    reject(e)
                    return Promise.reject(e)
                }
            })
        })
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
     * Adds one work item, may call it
     *
     * @param item
     * @returns A promise
     */
    add<T = any>(item: PromisableFunction<T>) {
        const p = this.pushPromise(item)
        this.activateItems()
        return p
    }

    /**
     * Adds some work items, may call some of them.
     *
     * @param items
     * @returns An array of promises
     */
    addMulti<T = any>(items: Array<PromisableFunction<T>>) {
        const ps: Array<Promise<any>> = []
        for(const item of items) {
            ps.push(this.pushPromise(item))
        }
        this.activateItems()
        return ps
    }

    /**
     * Convenience method - use if you want a pattern like:
     *
     * ```
     * try {
     *  const successes = await pool.all(items)
     * } catch(e) {
     *  // ...
     * }
     * ```
     *
     * @param items
     * @returns
     */
    all<T = any>(items: Array<PromisableFunction<T>>) {
        return Promise.all(this.addMulti(items))
    }

    /**
     * Convenience method - use if you want a pattern like:
     *
     * ```
     * const results = await pool.allSettled(items)
     * ```
     *
     * @param items
     * @returns
     */
    allSettled<T = any>(items: Array<PromisableFunction<T>>) {
        return Promise.allSettled(this.addMulti(items))
    }

    /**
     * Convenience method - use if you want a pattern like:
     *
     * ```
     * try {
     *  for await (const v of pool.iterate(items)) {
     *      // Do something with v
     *  }
     * } catch(e) {
     *  // ...
     * }
     * ```
     *
     * @param items
     */
    async *iterate<T = any>(items: Array<PromisableFunction<T>>) {
        const promises = this.addMulti(items)
        for(const p of promises) {
            yield await p
        }
    }
}