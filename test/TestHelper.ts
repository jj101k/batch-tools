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
    /**
     *
     * @param milliseconds
     */
    static async pause(milliseconds: number) {
        if(this.debug) console.log(`Wait ${milliseconds}ms: start`)
        try {
            await new Promise(resolve => setTimeout(resolve, milliseconds))
        } finally {
            if(this.debug) console.log("Wait finished")
        }
    }
}