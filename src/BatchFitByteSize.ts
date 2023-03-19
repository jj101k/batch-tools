import { BatchFitDetector } from "./BatchFitDetector"

/**
 * This is for the common case where you have a request size limit to deal with.
 */
export class BatchFitByteSize<I> implements BatchFitDetector<I> {
    /**
     *
     * @param maxBytes
     * @param encode
     * @param iterable If true, this will presume that S(A+B) = S(A) + S(B).
     * This will be more efficient (O(n) not O(n log n), unless your encoder is
     * effectively O(1) for the input somehow), but will usually over-estimate
     * the required size, particularly if you are using compression in your encoder.
     */
    constructor(private maxBytes: number,
        private encode: (items: I[]) => string = items => JSON.stringify(items),
        private iterable = true) {
    }

    fitsItems(items: I[]): number {
        if(this.maxBytes == 0) {
            return 0
        } else if(items.length == 0) {
            return 1 // This is purely a guess.
        }

        const byteEncoder = new TextEncoder()
        const getSize = (items: I[]) => byteEncoder.encode(this.encode(items)).byteLength

        // Try all of them first.
        const allEncoded = getSize(items)
        if(allEncoded <= this.maxBytes) {
            if(allEncoded * (items.length + 1) / items.length <= this.maxBytes) {
                return items.length + 1
            } else {
                return items.length
            }
        }

        if(getSize(items.slice(0, 1)) > this.maxBytes) {
            return 0 // Can't fit any of THOSE
        }

        if(this.iterable) {
            // Try iterating
            let iteratedSize = 0
            let itemsAccepted = 0
            for(const item of items) {
                iteratedSize += getSize([item])
                if(iteratedSize > this.maxBytes) {
                    return itemsAccepted
                }
                itemsAccepted++
            }
            return itemsAccepted
        } else {
            // Classic binary search
            let top = items.length - 1
            let bottom = 0
            while(top > bottom + 1) {
                const test = Math.round((top + bottom) / 2)
                const size = getSize(items.slice(0, test + 1))
                if(size == this.maxBytes) {
                    // No harm aborting early
                    return test + 1
                } else if(size < this.maxBytes) {
                    bottom = test
                } else {
                    top = test
                }
            }
            return bottom + 1
        }
    }
}