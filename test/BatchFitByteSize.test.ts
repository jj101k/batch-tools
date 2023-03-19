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
    describe("General accuracy", () => {
        const one = {id: 1, name: "foo"}
        const two = {id: 2, name: "bar"}
        const lengthOne = JSON.stringify([one]).length
        const three = {id: 3, name: "baz"}
        const lengthTwo = JSON.stringify([one, two]).length

        it("produces the right kind of size test", () => {
            const shortForOne = new BatchFitByteSize(lengthOne - 1).fitsItems([one])
            assert.equal(shortForOne, 0, `${lengthOne - 1} is not enough for one item`)
            const matchForOne = new BatchFitByteSize(lengthOne).fitsItems([one])
            assert.equal(matchForOne, 1, `${lengthOne} is enough for one item`)

            const shortForTwo = new BatchFitByteSize(lengthTwo - 1).fitsItems([one, two])
            assert.equal(shortForTwo, 1, `${lengthTwo - 1} is not enough for two items`)
            const matchForTwo = new BatchFitByteSize(lengthTwo).fitsItems([one, two])
            assert.equal(matchForTwo, 2, `${lengthTwo} is enough for two items`)
        })
        it("produces the right kind of size test", () => {
            const three = {id: 3, name: "baz"}
            const shortForTwo2 = new BatchFitByteSize(lengthTwo - 1).fitsItems([one, two, three])
            assert.equal(shortForTwo2, 1, `${lengthTwo - 1} is not enough for two items`)
            const matchForTwo2 = new BatchFitByteSize(lengthTwo).fitsItems([one, two, three])
            assert.equal(matchForTwo2, 1, `${lengthTwo} is NOT enough for two items (iterable)`)

            const shortForTwo3 = new BatchFitByteSize(lengthTwo - 1, (items: any[]) => JSON.stringify(items), false).fitsItems([one, two, three])
            assert.equal(shortForTwo3, 1, `${lengthTwo - 1} is not enough for two items`)
            const matchForTwo3 = new BatchFitByteSize(lengthTwo, (items: any[]) => JSON.stringify(items), false).fitsItems([one, two, three])
            assert.equal(matchForTwo3, 2, `${lengthTwo} is enough for two items (BS)`)
        })
    })
    describe("Efficiency", () => {
        const sizeItemsComplex: [number, any[]][] = testSizes.map(testSize => [testSize, [...new Array(testSize)].map((_, i) => ({
            id: i,
            v: Math.random()
        }))])
        it("is fairly quick at binary search", function() {
            const fitter = new BatchFitByteSize(50, (items: number[]) => JSON.stringify(items), false)
            let t: number
            let before: Date
            let after: Date

            t = 0
            before = new Date()
            for(const [, items] of sizeItemsComplex) {
                for(let s = 0; s < 1_000; s++) {
                    t += fitter.fitsItems(items)
                }
            }
            after = new Date()

            const time = after.valueOf() - before.valueOf()
            assert(time < 500, "Finishes 1,000 item checks in <0.5s")
        })
        it("is quick at iteration", function() {
            const fitter = new BatchFitByteSize(50, (items: number[]) => JSON.stringify(items), true)
            let t: number
            let before: Date
            let after: Date

            t = 0
            before = new Date()
            for(const [, items] of sizeItemsComplex) {
                for(let s = 0; s < 1_000; s++) {
                    t += fitter.fitsItems(items)
                }
            }
            after = new Date()

            const time = after.valueOf() - before.valueOf()
            assert(time < 250, "Finishes 1,000 item checks in <0.25s")
        })
        it("is faster at iteration but better at binary search", function() {
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
            const estimateBS = t

            t = 0
            before = new Date()
            for(const [, items] of sizeItemsComplex) {
                for(let s = 0; s < 1_000; s++) {
                    t += fitterIterable.fitsItems(items)
                }
            }
            after = new Date()

            const timeIterable = after.valueOf() - before.valueOf()
            const estimateIterable = t

            assert(timeIterable < timeBS, "Iterable takes less time than BS")
            assert(estimateBS <= estimateIterable, "BS is more accurate (less pessimistic) than iterable")
        })
    })
})