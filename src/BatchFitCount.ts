import { BatchFitDetector } from "./BatchFitDetector"

/**
 * A batch-fit detector. Very simple, this just limits how many items fit in the
 * batch.
 */
export class BatchFitCount implements BatchFitDetector<any> {
    /**
     *
     * @param limit
     */
    constructor(private limit: number) {
    }
    fitsItems(items: any[]): number {
        return this.limit
    }
}