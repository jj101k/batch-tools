import assert from "assert"
import { BatchFitByteSize } from "../src"

describe("Batch fit (byte size)", () => {
    const testSizes = [1, 2, 3, 5, 7, 11, 4, 25, 49, 121]
    const sizeItems: [number, number[]][] = testSizes.map(testSize => [testSize, [...new Array(testSize)].map((_, i) => i)])
    describe("Empty input", () => {
        const items: number[] = []
        it("can accept zero-size input", () => {
            for(let s = 1; s < 5; s++) {
                const fitter = new BatchFitByteSize(s, (items: number[]) => "#".repeat(items.length), true)
                const result = fitter.fitsItems(items)
                assert.ok(result > 0, `Size ${s} can (probably) fit >0 items`)
            }
        })
        it("can work with 0 limit and 0 input", () => {
            const fitter = new BatchFitByteSize(0, (items: number[]) => "#".repeat(items.length), true)
            const result = fitter.fitsItems(items)
            assert.equal(result, 0, "Can fit 0 items with 0 capacity")
        })
    })
    describe("Inconvenient sizes", () => {
        it("can iterate for reasonable size ranges", () => {
            for(const [testSize, items] of sizeItems) {
                for(let s = 0; s < 100; s++) {
                    const fitter = new BatchFitByteSize(s, (items: number[]) => "##".repeat(items.length), true)
                    const result = fitter.fitsItems(items)
                    if(s >= (testSize + 1) * 2) {
                        assert.ok(result > testSize, `Size ${s} fits more than ${testSize} items`)
                    } else {
                        const expected = Math.floor(s / 2)
                        assert.equal(result, expected, `Size ${s} fits ${expected} of ${testSize} items`)
                    }
                }
            }
        })
        it("can binary search for reasonable size ranges", () => {
            for(const [testSize, items] of sizeItems) {
                for(let s = 0; s < 100; s++) {
                    const fitter = new BatchFitByteSize(s, (items: number[]) => "##".repeat(items.length), false)
                    const result = fitter.fitsItems(items)
                    if(s >= (testSize + 1) * 2) {
                        assert.ok(result > testSize, `Size ${s} fits more than ${testSize} items`)
                    } else {
                        const expected = Math.floor(s / 2)
                        assert.equal(result, expected, `Size ${s} fits ${expected} of ${testSize} items`)
                    }
                }
            }
        })
    })
    it("can iterate for reasonable size ranges", () => {
        for(const [testSize, items] of sizeItems) {
            for(let s = 0; s < 100; s++) {
                const fitter = new BatchFitByteSize(s, (items: number[]) => "#".repeat(items.length), true)
                const result = fitter.fitsItems(items)
                if(s > testSize) {
                    assert.ok(result > testSize, `Size ${s} fits more than ${testSize} items`)
                } else {
                    assert.equal(result, s, `Size ${s} fits ${s} of ${testSize} items`)
                }
            }
        }
    })
    it("can binary search for reasonable size ranges", () => {
        for(const [testSize, items] of sizeItems) {
            for(let s = 0; s < 100; s++) {
                const fitter = new BatchFitByteSize(s, (items: number[]) => "#".repeat(items.length), false)
                const result = fitter.fitsItems(items)
                if(s > testSize) {
                    assert.ok(result > testSize, `Size ${s} fits more than ${testSize} items`)
                } else {
                    assert.equal(result, s, `Size ${s} fits ${s} of ${testSize} items`)
                }
            }
        }
    })
    describe("Efficiency", () => {
        const sizeItemsComplex: [number, any[]][] = testSizes.map(testSize => [testSize, [...new Array(testSize)].map((_, i) => ({
            id: i,
            v: Math.random()
        }))])
        it("is faster at iteration than binary search", function() {
            this.slow(1000)
            this.timeout(2000)
            const fitterBS = new BatchFitByteSize(50, (items: number[]) => JSON.stringify(items), false)
            const fitterIterable = new BatchFitByteSize(50, (items: number[]) => JSON.stringify(items), true)
            let t: number
            let before: Date
            let after: Date

            t = 0
            before = new Date()
            for(const [, items] of sizeItemsComplex) {
                for(let s = 0; s < 1_000; s++) {
                    t += fitterBS.fitsItems(items)
                }
            }
            after = new Date()

            const timeBS = after.valueOf() - before.valueOf()

            t = 0
            before = new Date()
            for(const [, items] of sizeItemsComplex) {
                for(let s = 0; s < 1_000; s++) {
                    t += fitterIterable.fitsItems(items)
                }
            }
            after = new Date()

            const timeIterable = after.valueOf() - before.valueOf()

            assert(timeIterable < timeBS, "Iterable takes less time than BS")
        })
    })
})