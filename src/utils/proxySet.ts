export interface ProxySet<T> {
  add(value: T): this
  clear(): void
  delete(value: T): boolean
  has(value: T): boolean
  readonly size: number
  forEach: Array<T>['forEach']
  map: Array<T>['map']
  filter(
    predicate: (value: T, index: number, array: T[]) => boolean,
    thisArg?: any
  ): T[]
  toString(): string
}

// properies that we don't want to expose to the end-user
interface InternalProxySet<T> extends ProxySet<T> {
  data: T[]
  // used for JSON.stringify
  toJSON(): T[]
}

export function proxySet<T = any>(values: T[] | null = []): ProxySet<T> {
  const set: InternalProxySet<T> = {
    data: [...new Set(values)],
    has(value) {
      return this.data.indexOf(value) !== -1
    },
    add(value) {
      if (this.data.indexOf(value) === -1) {
        this.data.push(value)
      }
      return this
    },
    delete(value) {
      if (this.data.indexOf(value) === -1) {
        return false
      }
      this.data = this.data.filter((v: T) => v !== value)
      return true
    },
    clear() {
      this.data = []
    },
    get size() {
      return this.data.length
    },
    forEach(cb, thisArg) {
      this.data.forEach(cb, thisArg)
    },
    map(cb, thisArg) {
      return this.data.map(cb, thisArg)
    },
    filter(cb, thisArg) {
      return this.data.filter(cb, thisArg)
    },
    toString() {
      return this.data.toString()
    },
    toJSON() {
      return this.data
    },
  }

  Object.freeze(set)

  return set as ProxySet<T>
}
