import { Timeout } from "@jdframe/core"
import * as assert from "assert"
import { WorkPool } from "../src"
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
        await new Timeout(50)
        assert.equal(c, 5, "only the work that fitted in the pool is complete")
        await new Timeout(100)
        assert.equal(c, 8, "all work is eventually complete")
    })
    it("has a maximum rate", async () => {
        let c = 0
        const action = () => {c++}
        for(let i = 0; i < 20; i++) {
            pool.add(action)
        }
        await new Timeout(50)
        assert.equal(c, 10, "only the work within the work rate is complete")
        await new Timeout(100)
        assert.equal(c, 20, "all work is eventually complete")
    })
    it("can handle excessive overuse", async () => {
        let c = 0
        const action = () => {if(c < 50) {c++; pool.add(action); pool.add(action)}}
        pool.add(action)
        await new Timeout(50)
        assert.equal(c, 10, "only the work within the work rate is complete")
        await new Timeout(1000)
        assert.equal(c, 50, "all work is eventually complete")
    })
    it("can terminate after excessive overuse", async function() {
        this.slow(4000)
        this.timeout(5000)
        let succeeded = 0
        let started = 0
        let failed = 0
        let c = 0
        const action = () => {if(c < 500) {
            c++
            started += 2
            pool.add(action).then(() => succeeded++, () => failed++)
            pool.add(action).then(() => succeeded++, () => failed++)
        }}
        started++
        pool.add(action).then(() => succeeded++, () => failed++)
        await new Timeout(50)
        assert.equal(c, 10, "only the work within the work rate is complete")
        await new Timeout(1000)
        assert.ok(c <= 100, "limited work is eventually complete")
        let last = c
        await new Timeout(1000)
        assert.equal(c, last, "no further work is done")
        assert.equal(failed + succeeded, started, "All started work returned a state")
    })
})