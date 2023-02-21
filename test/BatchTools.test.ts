import * as assert from "assert"
import {BatchTools} from "../src"

class BatchToolsConsumer {
    private _c_fooBatchedLimit: BatchTools<string, string> | null = null
    private _c_fooBatchedTimeout: BatchTools<string, string> | null = null
    public callCount = 0

    get fooBatchedLimit() {
        if(!this._c_fooBatchedLimit) {
            this._c_fooBatchedLimit = new BatchTools(this.foo.bind(this), {limit: 10})
        }
        return this._c_fooBatchedLimit
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

describe("Batch tools are usable", () => {
    it("can run with a timeout", async () => {
        const consumer = new BatchToolsConsumer()
        const results = new Map<string, string>()
        function tryMultiCall(...ns: string[]) {
            return consumer.fooBatchedTimeout.callMulti(...ns).then(rs => {
                for(const [i, r] of Object.entries(rs)) {
                    results.set(ns[+i]!, r)
                }
            })
        }
        function trySingleCall(n: string) {
            return consumer.fooBatchedTimeout.call(n).then(r => results.set(n, r))
        }
        trySingleCall("a")
        tryMultiCall("b", "c")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+20, no call
        trySingleCall("d")
        tryMultiCall("e", "f")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+40, no call
        trySingleCall("g")
        tryMultiCall("h", "i")
        await new Promise(resolve => setTimeout(resolve, 20))
        // t+60, call 1 fired
        trySingleCall("j")
        tryMultiCall("k", "l")
        await new Promise(resolve => setTimeout(resolve, 300))
        // t+360, both calls fired and returned

        const expected = new Map("abcdefghijkl".split("").map(v => [v, v + "!"]))

        assert.equal(consumer.callCount, 2, "Expected number of calls made")
        assert.deepEqual(results, expected, "Results match")
    })
})