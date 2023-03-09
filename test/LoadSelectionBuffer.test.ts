import * as assert from "assert"
import { LoadSelectionBuffer, LoadSelectionBufferAny, PseudoMap } from "../src"
describe("Load selection buffer tests", () => {
    it("can handle basic buffering duties", async () => {
        const simpleBatchFunction = (ts: number[]) => Promise.resolve(new Map(ts.map(t => [t, t])))
        const buffer = new LoadSelectionBuffer<number>()
        const promise = buffer.then(simpleBatchFunction)
        buffer.add(1)
        buffer.add(2)
        buffer.delete(1)
        const result = await promise
        assert.equal(result.size, 1, "Only one result")
        assert.ok(result.has(2), "Included item exists")
    })
    it("can use a custom load selection buffer", async () => {
        type Entity = {id: string}
        const complexBatchFunction = (ts: Entity[]) => Promise.resolve(new PseudoMap((entity: Entity) => entity.id, ts.map(t => [t, t])))
        const buffer = new LoadSelectionBufferAny((entity: Entity) => entity.id)
        const promise = buffer.then(complexBatchFunction)

        buffer.add({id: "1"})
        buffer.add({id: "2"})
        buffer.delete({id: "1"})
        const result = await promise
        assert.equal(result.size, 1, "Only one result")
        assert.ok(result.has({id: "2"}), "Included item exists")
    })
})