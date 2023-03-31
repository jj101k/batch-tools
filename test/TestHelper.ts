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
}