/**
 * For using a map like it's a set.
 */
export class PseudoSet<I, K> implements Set<I> {
    /**
     *
     */
    private uniqueValues = new Map<K, I>()

    get size() {
        return this.uniqueValues.size
    }

    get [Symbol.toStringTag]() {
        return "PseudoSet"
    }

    /**
     *
     * @param getKey
     */
    constructor(private getKey: (item: I) => K) {
    }

    add(value: I): this {
        this.uniqueValues.set(this.getKey(value), value)
        return this
    }

    clear(): void {
        this.uniqueValues.clear()
    }

    delete(value: I): boolean {
        return this.uniqueValues.delete(this.getKey(value))
    }

    forEach(callbackfn: (value: I, value2: I, set: Set<I>) => void, thisArg?: any): void {
        for(const v of this.uniqueValues.values()) {
            callbackfn(v, v, this)
        }
    }

    has(value: I): boolean {
        return this.uniqueValues.has(this.getKey(value))
    }

    *entries(): IterableIterator<[I, I]> {
        for(const v of this.uniqueValues.values()) {
            yield [v, v]
        }
    }

    keys(): IterableIterator<I> {
        return this.uniqueValues.values()
    }

    values(): IterableIterator<I> {
        return this.uniqueValues.values()
    }

    [Symbol.iterator]() {
        return this.uniqueValues.values()
    }
}