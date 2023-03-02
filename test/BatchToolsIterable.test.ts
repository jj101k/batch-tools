import * as assert from "assert"
import {BatchToolsIterable} from "../src"
import { TestHelper } from "./TestHelper"

const debug = false

class BatchToolsConsumer {
    private _c_fooBatchedLimit: BatchToolsIterable<string, string> | null = null
    private _c_fooBatchedTimeout: BatchToolsIterable<string, string> | null = null
    public callCount = 0
    public largestBatch = 0

    get fooBatchedLimit() {
        if(!this._c_fooBatchedLimit) {
            this._c_fooBatchedLimit = new BatchToolsIterable(this.foo.bind(this), {timeoutMs: 20, limit: 3})
        }
        return this._c_fooBatchedLimit
    }
    get fooBatchedTimeout() {
        if(!this._c_fooBatchedTimeout) {
            this._c_fooBatchedTimeout = new BatchToolsIterable(this.foo.bind(this), {timeoutMs: 20})
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

    constructor(private batchTools: BatchToolsIterable<string, string>) {
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
}

describe("Batch tools (iterable) are usable", () => {
    it("can run with a timeout", async function() {
        this.slow(500)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedTimeout)
        testWrapper.tryIterableBatchCall("a", "b")
        testWrapper.tryIterableBatchCall("c", "d", "e")
        await TestHelper.wait(60)
        // t+60, call added
        await TestHelper.wait(60)
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
        await TestHelper.wait(5)
        // t+5, one call issued.
        assert.equal(consumer.callCount, 1, "Expected number of calls made")

        await TestHelper.wait(55)
        // t+60, one call finished, another added.
        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.equal(testWrapper.results.size, 3, "All initial results are in")

        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abc"), "Results match (initial)")

        await TestHelper.wait(60)
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
        await TestHelper.wait(5)
        // t+5, one call issued.
        assert.equal(consumer.callCount, 1, "Expected number of calls made")

        await TestHelper.wait(55)
        // t+60, one call finished, another added.
        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.equal(testWrapper.results.size, 3, "All initial results are in")

        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abc"), "Results match (initial)")

        await TestHelper.wait(60)
        // t+120, both calls finished
        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.equal(testWrapper.results.size, 5, "All results are in")
        assert.equal(consumer.largestBatch, 3, "Exactly filled the batches")

        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcde"), "Results match")
    })
})