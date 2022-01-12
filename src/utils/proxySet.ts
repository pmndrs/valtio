import { proxy } from 'valtio'

// properies that we don't want to expose to the end-user
interface InternalProxySet<T> extends Set<T> {
  data: T[]
  toJSON: object
}

export function proxySet<T>(
  initialValues: Iterable<T> | null | undefined = []
): Set<T> {
  const set: InternalProxySet<T> = {
    data: Array.from(new Set(initialValues)),
    has(value) {
      return (
        this.data.indexOf(
          typeof value === 'object' ? proxy(value as any) : value
        ) !== -1
      )
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
  }
  Object.defineProperties(set, {
    data: {
      writable: true,
      enumerable: false,
    },
    size: {
      enumerable: false,
    },
  })

  Object.seal(set)

  return proxy(set) as Set<T>
}
