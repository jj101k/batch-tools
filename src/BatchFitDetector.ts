/**
 *
 */
export interface BatchFitDetector<I> {
    /**
     * Indicates at what point in the supplied list the batch will have to be
     * cut off.
     *
     * @param items
     * @returns Return n>items.length (eg. items.length + 1) if you think
     * there's still space. Return items.length if you think it's exactly full.
     * Return n<items.length if you think it can only fit some of the items (and
     * then will be full).
     */
    fitsItems: (items: I[]) => number
}