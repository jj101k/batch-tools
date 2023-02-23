import * as assert from "assert"
import {BatchTools} from "../src"

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
        this.callCount++
        await new Promise(resolve => setTimeout(resolve, 100))
        return items.map(i => i + "!")
    }
}

class BatchToolTestWrapper {
    public readonly results = new Map<string, string>()

    constructor(private batchTools: BatchTools<string, string>) {
    }

    async tryMultiCall(...ns: string[]) {
        const rs = await this.batchTools.callMulti(...ns)
        for(const [i, r] of Object.entries(rs)) {
            this.results.set(ns[+i]!, r)
        }
    }
    async trySingleCall(n: string) {
        const r = await this.batchTools.call(n)
        this.results.set(n, r)
    }
}

describe("Batch tools are usable", () => {
    it("can run with a timeout", async () => {
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedTimeout)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+60, call 1 fired
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await new Promise(resolve => setTimeout(resolve, 300))
        // t+360, both calls fired and returned

        const expected = new Map("abcdefghijkl".split("").map(v => [v, v + "!"]))

        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.deepEqual(testWrapper.results, expected, "Results match")
    })

    it("can run in manual-submit mode", async () => {
        const consumer = new BatchToolsConsumer()
        const testWrapper = new BatchToolTestWrapper(consumer.fooBatchedManual)
        testWrapper.trySingleCall("a")
        testWrapper.tryMultiCall("b", "c")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+20, no call
        testWrapper.trySingleCall("d")
        testWrapper.tryMultiCall("e", "f")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+40, no call
        testWrapper.trySingleCall("g")
        testWrapper.tryMultiCall("h", "i")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+60, still no call
        testWrapper.trySingleCall("j")
        testWrapper.tryMultiCall("k", "l")
        await new Promise(resolve => setTimeout(resolve, 300))
        // t+360, still no call.

        assert.equal(consumer.callCount, 0, "No calls made in advance")
        consumer.fooBatchedManual.send()

        await new Promise(resolve => setTimeout(resolve, 150)) // Wait long enough for it to finish

        const expected = new Map("abcdefghijkl".split("").map(v => [v, v + "!"]))

        assert.equal(consumer.callCount, 1, "Expected number of calls made")
        assert.deepEqual(testWrapper.results, expected, "Results match")
    })
})