import { Timeout } from "@jdframe/core"
import * as assert from "assert"
import { BatchRemovable } from "../src/LowLevel/BatchRemovable"

const debug = false

describe("BatchRemovable is usable", () => {
    it("runs normally when all items are added at once and the end is removed", async () => {
        const batch = new BatchRemovable<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50})
        const resultsOut = new Map<number, number | undefined>()
        for(let i = 0; i < 30; i+=2) {
            const result = batch.add(i, i + 1)
            assert.equal(result.remaining, 0, `Item ${i} is accepted`)
            const j = i
            result.promise.then(r => {resultsOut.set(j, r[0]); resultsOut.set(j + 1, r[1])})
        }
        for(let i = 20; i < 30; i+=2) {
            batch.remove(i, i + 1)
        }
        await new Timeout(100)
        assert.equal(resultsOut.size, 30, "All results in")
        assert.equal(new Set(resultsOut.values()).size, 21, "All results are distinct")
        assert.equal([...resultsOut].filter(([k, v]) => v !== undefined && v < 20 && k == v).length, 20, "Only the expected results exist")
    })

    it("runs normally with random removals", async () => {
        const batch = new BatchRemovable<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50})
        const resultsOut = new Map<number, number | undefined>()
        for(let i = 0; i < 30; i+=2) {
            const result = batch.add(i, i + 1)
            assert.equal(result.remaining, 0, `Item ${i} is accepted`)
            const j = i
            result.promise.then(r => {resultsOut.set(j, r[0]); resultsOut.set(j + 1, r[1])})
        }
        let removed = 0
        for(let i = 0; i < 30; i++) {
            if(Math.random() > 0.5) {
                removed++
                batch.remove(i)
            }
        }
        await new Timeout(100)
        const expected = 30 - removed
        assert.equal(resultsOut.size, 30, "All results in")
        assert.equal(new Set(resultsOut.values()).size, expected + 1, "All results are distinct")
        assert.equal([...resultsOut].filter(([k, v]) => v !== undefined && k == v).length, expected, "Only the expected results exist")
    })
})