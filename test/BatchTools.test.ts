import * as assert from "assert"
import {BatchTools} from "../src"
import { TestHelper } from "./TestHelper"

const debug = false

const preferredTimeout = 20

class BatchToolsConsumer {
    private _c_fooBatchedLimit: BatchTools<string, string> | null = null
    private _c_fooBatchedLimitParallelLimit: BatchTools<string, string> | null = null
    private _c_fooBatchedManual: BatchTools<string, string> | null = null
    private _c_fooBatchedTimeout: BatchTools<string, string> | null = null
    public callCount = 0
    public largestBatch = 0

    get fooBatchedLimit() {
        if(!this._c_fooBatchedLimit) {
            this._c_fooBatchedLimit = new BatchTools(this.foo.bind(this), {timeoutMs: preferredTimeout, maxItems: 3})
        }
        return this._c_fooBatchedLimit
    }
    get fooBatchedLimitParallelLimit() {
        if(!this._c_fooBatchedLimitParallelLimit) {
            this._c_fooBatchedLimitParallelLimit = new BatchTools(this.foo.bind(this), {timeoutMs: 50, maxItems: 2}, 2)
        }
        return this._c_fooBatchedLimitParallelLimit
    }
    get fooBatchedManual() {
        if(!this._c_fooBatchedManual) {
            this._c_fooBatchedManual = new BatchTools(this.foo.bind(this), {})
        }
        return this._c_fooBatchedManual
    }
    get fooBatchedTimeout() {
        if(!this._c_fooBatchedTimeout) {
            this._c_fooBatchedTimeout = new BatchTools(this.foo.bind(this), {timeoutMs: preferredTimeout})
        }
        return this._c_fooBatchedTimeout
    }
    async foo(...items: string[]) {
        if(debug) console.log("Results due in 50ms")
        this.callCount++
        this.largestBatch = Math.max(this.largestBatch, items.length)
        await new Promise(resolve => setTimeout(resolve, 50))
        if(debug) console.log("> Time out, value due at next execution opportunity")
        return items.map(i => i + "!")
    }
}

class BatchToolTestWrapper {
    public readonly results = new Map<string, string>()

    constructor(private batchTools: BatchTools<string, string>) {
    }

    async tryIterableBatchCall(...ns: string[]) {
        let offset = 0
        for await (const rs of this.batchTools.callMultiIterableBatch(...ns)) {
            if(debug) console.log(`Storing ${rs.length} results`)
            for(const [i, r] of Object.entries(rs)) {
                if(debug) console.log(`Storing ${ns[offset + +i]}=${r}`)
                this.results.set(ns[offset + +i]!, r)
            }
            offset += rs.length
        }
    }
    async tryIterableSingleCall(...ns: string[]) {
        let i = 0
        for await (const r of this.batchTools.callMultiIterableSingle(...ns)) {
            if(debug) console.log(`Storing 1 result, ${ns[+i]}=${r}`)
            this.results.set(ns[+i]!, r)
            i++
        }
    }

    async tryMultiCall(...ns: string[]) {
        const rs = await this.batchTools.callMulti(...ns)
        if(debug) console.log(`Storing ${rs.length} results`)
        for(const [i, r] of Object.entries(rs)) {
            this.results.set(ns[+i]!, r)
        }
    }
    async trySingleCall(n: string) {
        const r = await this.batchTools.include(n)
        if(debug) console.log("Storing 1 result")
        this.results.set(n, r)
    }
}

describe("Batch tools are usable", () => {
    it("can run with a timeout", async function() {
        this.slow(500)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedTimeout)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await TestHelper.pause(preferredTimeout * 2 / 5)
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await TestHelper.pause(preferredTimeout * 2 / 5)
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await TestHelper.pause(preferredTimeout * 2 / 5)
        // t+60, call 1 fired
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await TestHelper.pause(300)
        // t+360, both calls fired and returned

        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefghijkl"), "Results match")
    })

    it("can run with a timeout + limit", async function() {
        this.slow(500)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedLimit)

        const items = "abcdefghijklm".split("")

        // More than 10!
        testWrapper.tryMultiCall(...items.slice(0, 5))
        testWrapper.tryMultiCall(...items.slice(5))
        await TestHelper.pause(preferredTimeout * 2 / 5)
        // t+20, one call made and another one in the backlog.
        assert.equal(consumer.callCount, 4, "Four calls made immediately")
        assert.ok((consumer.fooBatchedLimit.lastActiveBatchSize ?? 0) < 5, "The active batch is small & incomplete")
        await TestHelper.pause(preferredTimeout * 4 / 5)
        // t+60, two calls made
        assert.equal(consumer.callCount, 5, "Five calls made after 1x timeout")
        await TestHelper.pause(80)
        // t+140, one call completed
        assert.equal(testWrapper.results.size, 13, "Some results are in")
        await TestHelper.pause(100)
        // t+250, all calls completed
        assert.equal(testWrapper.results.size, items.length, "All results are in")

        assert.equal(consumer.callCount, 5, "Expected number of calls made")
        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefghijklm"), "Results match")
    })

    it("can run in manual-submit mode", async function() {
        this.slow(1000)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedManual)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await TestHelper.pause(20)
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await TestHelper.pause(20)
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await TestHelper.pause(20)
        // t+60, still no call
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await TestHelper.pause(300)
        // t+360, still no call.

        assert.equal(consumer.callCount, 0, "No calls made in advance")
        consumer.fooBatchedManual.send()

        await TestHelper.pause(150) // Wait long enough for it to finish

        assert.equal(consumer.callCount, 1, "Expected number of calls made")
        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefghijkl"), "Results match")
    })

    it("can run with a timeout + limit + parallel limit", async function() {
        this.slow(500)
        const consumer = new BatchToolsConsumer()
        try {
            const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedLimitParallelLimit)

            const items = "abcdefg".split("")

            // More than 10!
            testWrapper.tryMultiCall(...items.slice(0, 3)) // 0 1 2
            testWrapper.tryMultiCall(...items.slice(3, 7)) // 3 4 5 6
            await TestHelper.pause(5)
            // t+5: At this point we have three complete batches (a, b), (c, d), (e,
            // f) and one incomplete batch (g). Only the first two batches will have
            // been sent, because that's the limit.
            assert.equal(consumer.callCount, 2, "Expected number of calls made")
            await TestHelper.pause(preferredTimeout * 1.1)
            // t+60: The fourth batch became available, but was not sent.
            assert.equal(consumer.callCount, 2, "Expected number of calls made (no change)")
            await TestHelper.pause(50)
            // t+110: Results from the first two batches, last two batches are sent.
            assert.equal(consumer.callCount, 4, "All calls made")
            assert.equal(testWrapper.results.size, 3, "Partial results in - one response for two batches")
            await TestHelper.pause(100)
            // t+210: All results in

            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefg"), "Results match")
        } finally {
            consumer.fooBatchedLimitParallelLimit.abort()
        }
    })

    describe("Batch tools (iterable) are usable", () => {
        it("can run with a timeout", async function() {
            this.slow(500)
            const consumer = new BatchToolsConsumer()
            const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedTimeout)
            testWrapper.tryIterableBatchCall("a", "b")
            testWrapper.tryIterableBatchCall("c", "d", "e")
            await TestHelper.pause(60)
            // t+60, call added
            await TestHelper.pause(60)
            // t+120, batch 1 finished
            assert.equal(consumer.callCount, 1, "Expected number of calls made")
            assert.equal(testWrapper.results.size, 5, "All results are in")

            // It's the same, so no real extra tests.
            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcde"), "Results match")
        })

        it("can run with a timeout + limit (batch iteration)", async function() {
            this.slow(500)
            const consumer = new BatchToolsConsumer()
            const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedLimit)
            testWrapper.tryIterableBatchCall("a", "b")
            testWrapper.tryIterableBatchCall("c", "d", "e")
            await TestHelper.pause(5)
            // t+5, one call issued.
            assert.equal(consumer.callCount, 1, "Expected number of calls made")

            await TestHelper.pause(55)
            // t+60, one call finished, another added.
            assert.equal(consumer.callCount, 2, "Expected number of calls made")
            assert.equal(testWrapper.results.size, 3, "All initial results are in")

            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abc"), "Results match (initial)")

            await TestHelper.pause(60)
            // t+120, both calls finished
            assert.equal(consumer.callCount, 2, "Expected number of calls made")
            assert.equal(testWrapper.results.size, 5, "All results are in")
            assert.equal(consumer.largestBatch, 3, "Exactly filled the batches")

            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcde"), "Results match")
        })

        it("can run with a timeout + limit (single iteration)", async function() {
            this.slow(500)
            const consumer = new BatchToolsConsumer()
            const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedLimit)
            testWrapper.tryIterableSingleCall("a", "b")
            testWrapper.tryIterableSingleCall("c", "d", "e")
            await TestHelper.pause(5)
            // t+5, one call issued.
            assert.equal(consumer.callCount, 1, "Expected number of calls made")

            await TestHelper.pause(55)
            // t+60, one call finished, another added.
            assert.equal(consumer.callCount, 2, "Expected number of calls made")
            assert.equal(testWrapper.results.size, 3, "All initial results are in")

            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abc"), "Results match (initial)")

            await TestHelper.pause(60)
            // t+120, both calls finished
            assert.equal(consumer.callCount, 2, "Expected number of calls made")
            assert.equal(testWrapper.results.size, 5, "All results are in")
            assert.equal(consumer.largestBatch, 3, "Exactly filled the batches")

            assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcde"), "Results match")
        })
    })
})