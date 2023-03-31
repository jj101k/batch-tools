import { Timeout } from "@jdframe/core"
import { BatchFitCount } from "@jdframe/selection-buffer"
import * as assert from "assert"
import { LoadBufferCollection } from "../src"

describe("Load buffer collections", () => {
    it("can handle basic buffering duties", async () => {
        const simpleBatchFunction = (ts: number[]) => Promise.resolve(new Map(ts.map(t => [t, t])))
        const buffer = new LoadBufferCollection(simpleBatchFunction, {timeoutMs: 5, fits: new BatchFitCount(5)})

        const result = new Map<number, number>()

        const bufferAdd = (n: number) => buffer.include(n).then(r => result.set(n, r))

        // Fill buffer 0, intelligently.
        bufferAdd(0)
        bufferAdd(1)
        buffer.remove(1) // Now has 1
        bufferAdd(2)
        bufferAdd(3)
        bufferAdd(4)
        buffer.remove(4)
        buffer.remove(3) // Now has 2
        bufferAdd(5)
        bufferAdd(6)
        bufferAdd(7)

        // Fill buffer 1, _un_intelligently.
        bufferAdd(8)
        bufferAdd(9)
        bufferAdd(10)
        bufferAdd(11)
        bufferAdd(12)

        let error
        try {
            buffer.remove(12) // Oops - it's just been sent!
        } catch(e) {
            error = e
        }

        assert.ok(error instanceof Object, "An exception was thrown on late remove")

        await buffer
        await new Timeout(10)
        assert.equal(result.size, 10, "Expected results were stored")
        assert.ok(result.has(2), "Included item exists")
    })
})