import {LoadBuffer, LoadSelectionBufferAny, PseudoMap} from "../src"
import * as assert from "assert"
describe("Load buffer tests", () => {
    it("can handle basic buffering duties", async () => {
        const simpleBatchFunction = (ts: number[]) => Promise.resolve(new Map(ts.map(t => [t, t])))
        const buffer = new LoadBuffer(simpleBatchFunction)
        buffer.include(1)
        buffer.include(2)
        buffer.remove(1)
        const result = await buffer
        assert.equal(result.size, 1, "Only one result")
        assert.ok(result.has(2), "Included item exists")
    })
    it("can use a custom load selection buffer", async () => {
        type Entity = {id: string}
        const complexBatchFunction = (ts: Entity[]) => Promise.resolve(new PseudoMap((entity: Entity) => entity.id, ts.map(t => [t, t])))
        const buffer = new LoadBuffer(complexBatchFunction, new LoadSelectionBufferAny((entity: Entity) => entity.id))

        buffer.include({id: "1"})
        buffer.include({id: "2"})
        buffer.remove({id: "1"})
        const result = await buffer
        assert.equal(result.size, 1, "Only one result")
        assert.ok(result.has({id: "2"}), "Included item exists")
    })
})