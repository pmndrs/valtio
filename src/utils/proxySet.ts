import { CUSTOM_TYPE } from '../vanilla'

// properies that we don't want to expose to the end-user
interface InternalProxySet<T> extends Set<T> {
  data: T[]
  // used for JSON.stringify
  toJSON(): T[]
  [CUSTOM_TYPE]: boolean
}

export function proxySet<T>(initialValues: Iterable<T> = []): Set<T> {
  const set: InternalProxySet<T> = {
    data: [...new Set(initialValues)],
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
    forEach(cb) {
      for (let i = 0; i < this.data.length; i++) {
        const value = this.data[i] as T
        cb(value, value, this)
      }
    },
    get [Symbol.toStringTag]() {
      return 'Set'
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
    [CUSTOM_TYPE]: true,
    toJSON() {
      return this.data
    },
    values() {
      return this.data.values()
    },
    keys() {
      // for Set same has Set.values()
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
    },
  })

  Object.seal(set)

  return set as Set<T>
}
