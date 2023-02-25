import * as assert from "assert"
import {BatchTools} from "../src"
import { TestHelper } from "./TestHelper"

const debug = false

class BatchToolsConsumer {
    private _c_fooBatchedLimit: BatchTools<string, string> | null = null
    private _c_fooBatchedManual: BatchTools<string, string> | null = null
    private _c_fooBatchedTimeout: BatchTools<string, string> | null = null
    public callCount = 0

    get fooBatchedLimit() {
        if(!this._c_fooBatchedLimit) {
            this._c_fooBatchedLimit = new BatchTools(this.foo.bind(this), {timeoutMs: 50, limit: 10})
        }
        return this._c_fooBatchedLimit
    }
    get fooBatchedManual() {
        if(!this._c_fooBatchedManual) {
            this._c_fooBatchedManual = new BatchTools(this.foo.bind(this))
        }
        return this._c_fooBatchedManual
    }
    get fooBatchedTimeout() {
        if(!this._c_fooBatchedTimeout) {
            this._c_fooBatchedTimeout = new BatchTools(this.foo.bind(this), {timeoutMs: 50})
        }
        return this._c_fooBatchedTimeout
    }
    async foo(...items: string[]) {
        if(debug) console.log("Results due in 100ms")
        this.callCount++
        await new Promise(resolve => setTimeout(resolve, 100))
        if(debug) console.log("> Time out, value due at next execution opportunity")
        return items.map(i => i + "!")
    }
}

class BatchToolTestWrapper {
    public readonly results = new Map<string, string>()

    constructor(private batchTools: BatchTools<string, string>) {
    }

    async tryMultiCall(...ns: string[]) {
        const rs = await this.batchTools.callMulti(...ns)
        if(debug) console.log(`Storing ${rs.length} results`)
        for(const [i, r] of Object.entries(rs)) {
            this.results.set(ns[+i]!, r)
        }
    }
    async trySingleCall(n: string) {
        const r = await this.batchTools.call(n)
        if(debug) console.log("Storing 1 result")
        this.results.set(n, r)
    }
    async wait(time: number) {
        if(debug) console.log("Wait " + time + "ms: start")
        try {
            await new Promise(resolve => setTimeout(resolve, time))
        } finally {
            if(debug) console.log("Wait finished")
        }
    }
}

describe("Batch tools are usable", () => {
    it("can run with a timeout", async function() {
        this.slow(500)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedTimeout)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await testWrapper.wait(20)
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await testWrapper.wait(20)
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await testWrapper.wait(20)
        // t+60, call 1 fired
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await testWrapper.wait(300)
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
        await testWrapper.wait(20)
        // t+20, one call made and another one in the backlog.
        assert.equal(consumer.callCount, 1, "One call made immediately")
        assert.ok((consumer.fooBatchedLimit.activeBatchSize ?? 0) < 5, "The active batch is small & incomplete")
        await testWrapper.wait(40)
        // t+60, two calls made
        assert.equal(consumer.callCount, 2, "Two calls made after 1x timeout")
        await testWrapper.wait(80)
        // t+140, one call completed
        assert.equal(testWrapper.results.size, 5, "Some results are in")
        await testWrapper.wait(100)
        // t+250, all calls completed
        assert.equal(testWrapper.results.size, items.length, "All results are in")

        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefghijklm"), "Results match")
    })

    it("can run in manual-submit mode", async function() {
        this.slow(1000)
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedManual)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await testWrapper.wait(20)
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await testWrapper.wait(20)
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await testWrapper.wait(20)
        // t+60, still no call
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await testWrapper.wait(300)
        // t+360, still no call.

        assert.equal(consumer.callCount, 0, "No calls made in advance")
        consumer.fooBatchedManual.send()

        await testWrapper.wait(150) // Wait long enough for it to finish

        assert.equal(consumer.callCount, 1, "Expected number of calls made")
        assert.deepEqual(TestHelper.comparableResults(testWrapper.results), TestHelper.expectedResults("abcdefghijkl"), "Results match")
    })
})