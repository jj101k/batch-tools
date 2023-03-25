/**
 * For using a map with objects as keys
 */
export class PseudoMap<K extends string | number, R, I> implements Map<I, R> {
    /**
     *
     */
    private uniqueValues = new Map<K, [I, R]>()

    get size() {
        return this.uniqueValues.size
    }

    get [Symbol.toStringTag]() {
        return "PseudoMap"
    }

    /**
     *
     * @param getKey Map the objects to valid keys (eg, strings)
     * @param items
     */
    constructor(private getKey: (item: I) => K, items: Array<[I, R]> = []) {
        this.uniqueValues = new Map(items.map(([i, r]) => [getKey(i), [i, r]]))
    }

    entries(): IterableIterator<[I, R]> {
        return this.uniqueValues.values()
    }

    forEach(callbackfn: (value: R, key: I, map: Map<I, R>) => void, thisArg?: any): void {
        return this.uniqueValues.forEach(([i, r]) => callbackfn(r, i, this))
    }

    get(key: I) {
        return this.uniqueValues.get(this.getKey(key))?.[1]
    }

    *keys(): IterableIterator<I> {
        for(const value of this.uniqueValues.values()) {
            yield value[0]
        }
    }

    set(key: I, value: R): this {
        this.uniqueValues.set(this.getKey(key), [key, value])
        return this
    }

    *values(): IterableIterator<R> {
        for(const value of this.uniqueValues.values()) {
            yield value[1]
        }
    }

    clear(): void {
        this.uniqueValues.clear()
    }

    delete(key: I): boolean {
        return this.uniqueValues.delete(this.getKey(key))
    }

    has(key: I): boolean {
        return this.uniqueValues.has(this.getKey(key))
    }

    [Symbol.iterator]() {
        return this.uniqueValues.values()
    }
}