/**
 * For having a set of objects. This uses a map to keep them unique; unlike Set,
 * this allows you to provide a custom map like PseudoMap which understands
 * objects as keys.
 */
export class PseudoSet<I> implements Set<I> {
    get size() {
        return this.uniqueValues.size
    }

    get [Symbol.toStringTag]() {
        return "PseudoSet"
    }

    /**
     *
     * @param uniqueValues
     */
    constructor(private uniqueValues: Map<I, I>) {
    }

    add(value: I): this {
        this.uniqueValues.set(value, value)
        return this
    }

    clear(): void {
        this.uniqueValues.clear()
    }

    delete(value: I): boolean {
        return this.uniqueValues.delete(value)
    }

    forEach(callbackfn: (value: I, value2: I, set: Set<I>) => void, thisArg?: any): void {
        for(const v of this.uniqueValues.values()) {
            callbackfn(v, v, this)
        }
    }

    has(value: I): boolean {
        return this.uniqueValues.has(value)
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