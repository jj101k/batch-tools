import * as assert from "assert"
import { Batch } from "../src/Batch"
import { TestHelper } from "./TestHelper"

describe("Batch is usable", () => {
    it("runs normally with no send condition and no delay flag", async () => {
        const batch = new Batch<number, number>((...ts) => Promise.resolve(ts))
        const resultsOut = new Set<number>()
        for(let i = 0; i < 20; i++) {
            const result = batch.add(i)
            assert.equal(result.remaining, 0, `Item ${i} is accepted`)
            result.promise.then(r => resultsOut.add(r[0]))
        }
        await TestHelper.pause(100)
        assert.equal(resultsOut.size, 0, "No results yet")
        await batch.finish()
        assert.equal(resultsOut.size, 20, "All results in")
    })
    describe("With a time limit", () => {
        it("runs normally when all items are added at once", async () => {
            const batch = new Batch<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50})
            const resultsOut = new Set<number>()
            for(let i = 0; i < 20; i+=2) {
                const result = batch.add(i, i + 1)
                assert.equal(result.remaining, 0, `Item ${i} is accepted`)
                result.promise.then(r => {resultsOut.add(r[0]); resultsOut.add(r[1])})
            }
            await TestHelper.pause(100)
            assert.equal(resultsOut.size, 20, "All results in")
        })
        it("runs normally when all items are added serially", async () => {
            const batch = new Batch<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50})
            const resultsOut = new Set<number>()
            for(let i = 0; i < 10; i+=2) {
                const result = batch.add(i, i + 1)
                assert.equal(result.remaining, 0, `Item ${i} is accepted`)
                result.promise.then(r => {resultsOut.add(r[0]); resultsOut.add(r[1])})
                await TestHelper.pause(5) // Might be a bit more
            }
            await TestHelper.pause(25)
            assert.equal(resultsOut.size, 10, "All results in")
            const result = batch.add(10)
            assert.equal(result.remaining, 1, "Items after timeout are not accepted")
        })
        it("holds off when delayed", async () => {
            const batch = new Batch<number, number>((...ts) => Promise.resolve(ts), {timeoutMs: 50}, true)
            const resultsOut = new Set<number>()
            for(let i = 0; i < 20; i+=2) {
                const result = batch.add(i, i + 1)
                assert.equal(result.remaining, 0, `Item ${i} is accepted`)
                result.promise.then(r => {resultsOut.add(r[0]); resultsOut.add(r[1])})
            }
            await TestHelper.pause(100)
            assert.equal(resultsOut.size, 0, "No results in while delayed")
            batch.delay = false
            await TestHelper.pause(5) // Arbitrary short delay
            assert.equal(resultsOut.size, 20, "All results in")
        })
    })
})