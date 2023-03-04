/**
 *
 */
export class LimitExceeded implements Error {
    /**
     *
     */
    public readonly name = "LimitExceeded"

    /**
     *
     * @param message
     */
    constructor(public readonly message = "Cancelled") {

    }
}