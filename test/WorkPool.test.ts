import { WorkPool } from "../src"
import * as assert from "assert"
import { TestHelper } from "./TestHelper"
describe("Work pool", () => {
    let pool: WorkPool
    beforeEach(() => {
        pool = new WorkPool(5, {count: 10, ms: 100})
    })
    it("has a maximum size", async () => {
        let c = 0
        const action = () => {c++; return new Promise(resolve => setTimeout(resolve, 100))}
        for(let i = 0; i < 8; i++) {
            pool.add(action)
        }
        await TestHelper.pause(50)
        assert.equal(c, 5, "only the work that fitted in the pool is complete")
        await TestHelper.pause(100)
        assert.equal(c, 8, "all work is eventually complete")
    })
    it("has a maximum rate", async () => {
        let c = 0
        const action = () => {c++}
        for(let i = 0; i < 20; i++) {
            pool.add(action)
        }
        await TestHelper.pause(50)
        assert.equal(c, 10, "only the work within the work rate is complete")
        await TestHelper.pause(100)
        assert.equal(c, 20, "all work is eventually complete")
    })
})