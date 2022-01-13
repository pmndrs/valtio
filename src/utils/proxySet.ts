import { proxy } from 'valtio'

// properies that we don't want to expose to the end-user
interface InternalProxySet<T> extends Set<T> {
  data: T[]
  toJSON: object
  hasProxy(value: T): boolean
}

export function proxySet<T>(
  initialValues: Iterable<T> | null | undefined = []
): Set<T> {
  const set: InternalProxySet<T> = proxy({
    data: Array.from(new Set(initialValues)),
    has(value) {
      return this.data.indexOf(value) !== -1
    },
    hasProxy(value) {
      let hasProxy = false
      if (typeof value === 'object') {
        hasProxy = this.data.indexOf(proxy(value as any)) !== -1
      }

      return hasProxy
    },
    add(value) {
      if (!this.has(value) && !this.hasProxy(value)) {
        this.data.push(value)
      }
      return this
    },
    delete(value) {
      if (!this.has(value) && !this.hasProxy(value)) {
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
    forEach(cb) {
      for (let i = 0; i < this.data.length; i++) {
        const value = this.data[i] as T
        cb(value, value, this)
      }
    },
    get [Symbol.toStringTag]() {
      return 'Set'
    },
    toJSON() {
      return {}
    },
    [Symbol.iterator]() {
      let index = 0

      return {
        next: () =>
          index < this.data.length
            ? { value: this.data[index++], done: false }
            : { done: true },
      } as IterableIterator<T>
    },
    values() {
      return this.data.values()
    },
    keys() {
      // for Set.keys is an alias for Set.values()
      return this.data.values()
    },
    entries() {
      // array.entries returns [index, value] while Set [value, value]
      return new Set(this.data).entries()
    },
  })

  Object.defineProperties(set, {
    data: {
      writable: true,
      enumerable: false,
    },
    size: {
      enumerable: false,
    },
    hasProxy: {
      enumerable: false,
    },
  })

  Object.seal(set)

  return set as Set<T>
}
