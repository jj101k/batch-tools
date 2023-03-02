export class TestHelper {
    /**
     *
     */
    static debug = false
    static expectedResults(orderedLetters: string) {
        return orderedLetters.split("").map(v => [v, v + "!"])
    }
    static comparableResults(results: Map<string, string>) {
        return [...results].sort(([a], [b]) => a.localeCompare(b))
    }
    static async wait(time: number) {
        if(this.debug) console.log(`Wait ${time}ms: start`)
        try {
            await new Promise(resolve => setTimeout(resolve, time))
        } finally {
            if(this.debug) console.log("Wait finished")
        }
    }
}