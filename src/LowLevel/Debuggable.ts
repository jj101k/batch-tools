/**
 *
 */
export class Debuggable {
    /**
     *
     */
    private id: number | null = null

    /**
     *
     * @param message
     * @param otherContent
     */
    protected debugLog(message: any, ...otherContent: any[]) {
        if (this.debug) {
            if(this.id === null) {
                this.id = Math.floor(Math.random() * 1000)
            }
            console.log(this.id, message, ...otherContent)
        }
    }

    /**
     *
     * @param debug
     */
    constructor(private debug = false) {

    }
}