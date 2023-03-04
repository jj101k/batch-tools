/**
 *
 */
export class Cancelled implements Error {
    /**
     *
     */
    public readonly name = "Cancelled"

    /**
     *
     * @param message
     */
    constructor(public readonly message = "Cancelled") {

    }
}