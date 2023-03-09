import { InvalidState } from "./Errors"
import { TriggerPromise } from "./LowLevel/TriggerPromise"

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
    private aborted = false

    /**
     *
     */
    private activatedJobs = 0

    /**
     *
     */
    private readonly _activeJobs = new Set<number>()

    /**
     *
     */
    private avoidedLoopCount = 0

    /**
     *
     */
    private readonly avoidedLoopAbortLimit = 10

    /**
     *
     */
    private readonly avoidedLoopWarnLimit = 3

    /**
     *
     */
    private avoidingLoop = false

    /**
     *
     */
    private debug = false

    /**
     * @see activateItems()
     *
     * This tracks how many items were filled in the period.
     */
    private periodActivationStats: {startTs: number, count: number} | null = null

    /**
     *
     */
    private backlog: Array<TriggerPromise<any>> = []

    /**
     *
     */
    private get active() {
        return this._activeJobs.size
    }

    /**
     *
     */
    private get currentPeriodActivationStats() {
        if(!this.periodActivationStats) {
            const nowTs = new Date().valueOf()
            this.periodActivationStats = {startTs: nowTs, count: 0}
            setTimeout(() => this.periodActivationStats = null, this.maxActivationRate.ms)
        }
        return this.periodActivationStats
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
        for(; this.active < this.capacity; this.currentPeriodActivationStats.count++) {
            this.debugLog("Activate loop")
            if(this.avoidingLoop) {
                return
            }
            const currentPeriodActivationStats = this.currentPeriodActivationStats
            if(currentPeriodActivationStats.count >= this.maxActivationRate.count) {
                this.avoidLoop(currentPeriodActivationStats)
                break
            }
            const item = this.backlog.shift()
            if(!item) break

            const id = this.activatedJobs++
            this.addActiveJob(id)
            item.finally(() => this.removeActiveJob(id))

            try {
                item.activate()
            } catch(e) {
                this.removeActiveJob(id)
                throw e
            }
        }
    }

    /**
     *
     * @param id
     */
    private addActiveJob(id: number) {
        this._activeJobs.add(id)
    }

    /**
     *
     * @param id
     */
    private removeActiveJob(id: number) {
        this._activeJobs.delete(id)
        this.debugLog("Checking for more items")
        this.activateItems()
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
            const tp = new TriggerPromise(item)
            tp.then(resolve, reject)
            this.backlog.push(tp)
        })
    }

    /**
     *
     * @param currentPeriodActivationStats
     */
    private avoidLoop(currentPeriodActivationStats: {startTs: number, count: number}) {
        this.avoidingLoop = true
        this.avoidedLoopCount++

        if(this.avoidedLoopCount >= this.avoidedLoopAbortLimit) {
            console.error(`WorkPool: Too many work loops, aborting`)
            this.abort()
            return
        }

        if(this.avoidedLoopCount < this.avoidedLoopWarnLimit) {
            console.warn(
                `WorkPool: Possible work loop, rescheduling to the end of the ${this.maxActivationRate.ms}ms period`
            )
        } else if(this.avoidedLoopCount == this.avoidedLoopWarnLimit) {
            console.warn(`WorkPool: Possible work loop, will not warn again, but will abort if this continues`)
        }
        const nowTs = new Date().valueOf()
        setTimeout(() => {
            this.avoidingLoop = false
            this.debugLog("Finished reschedule")
            this.activateItems()
        }, currentPeriodActivationStats.startTs + this.maxActivationRate.ms - nowTs)
    }

    /**
     *
     * @param capacity How many items are worked on at once (or, strictly, in
     * parallel).
     * @param maxActivationRate You shouldn't need to change this - it's a cap
     * on the rate with which jobs are activated, beyond which a delay will be
     * added in. If you're hitting the overuse warning, you should generally set
     * both numbers higher than the default.
     */
    constructor(public readonly capacity: number,
        private readonly maxActivationRate: {count: number, ms: number} = {count: 10_000, ms: 1_000},
    ) {
    }

    /**
     * This clears & rejects the backlog
     */
    abort() {
        this.aborted = true
        for(const tp of this.backlog) {
            tp.cancel()
        }
        this.backlog = []
    }

    /**
     * Adds one work item, may call it immediately, but in any case you'll
     * get a promise.
     *
     * @param item
     * @throws
     * @returns A promise
     */
    add<T = any>(item: PromisableFunction<T>) {
        if(this.aborted) {
            throw new InvalidState("Cannot add - aborted")
        }
        const p = this.pushPromise(item)
        this.activateItems()
        return p
    }

    /**
     * Adds some work items, may call some of them.
     *
     * @param items
     * @throws
     * @returns An array of promises
     */
    addMulti<T = any>(items: Array<PromisableFunction<T>>) {
        if(this.aborted) {
            throw new InvalidState("Cannot add - aborted")
        }
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