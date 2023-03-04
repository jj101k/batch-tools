/**
 *
 */
export class InvalidState implements Error {
    /**
     *
     */
    public readonly name = "InvalidState"

    /**
     *
     * @param message
     */
    constructor(public readonly message: string) {

    }
}