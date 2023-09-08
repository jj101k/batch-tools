import { Timeout } from "@jdframe/core"
import * as assert from "assert"
import { BatchRemovable } from "../src/LowLevel/BatchRemovable"

const debug = false

describe("BatchRemovable is usable", () => {
    it("runs normally when all items are added at once", async () => {
        const batch = new BatchRemovable<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50})
        const resultsOut: (number | undefined)[] = []
        for(let i = 0; i < 30; i+=2) {
            const result = batch.add(i, i + 1)
            assert.equal(result.remaining, 0, `Item ${i} is accepted`)
            result.promise.then(r => {resultsOut.push(r[0]); resultsOut.push(r[1])})
        }
        for(let i = 20; i < 30; i+=2) {
            batch.remove(i, i + 1)
        }
        await new Timeout(100)
        assert.equal(resultsOut.length, 30, "All results in")
        assert.equal(new Set(resultsOut).size, 21, "All results are distinct")
        assert.equal(resultsOut.filter(r => r !== undefined && r < 20).length, 20, "Only the expected results exist")
    })
})