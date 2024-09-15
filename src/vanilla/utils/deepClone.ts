import { unstable_getInternalStates } from '../../vanilla.ts'

const isObject = (x: unknown): x is object =>
  typeof x === 'object' && x !== null

let defaultRefSet: WeakSet<object> | undefined
const getDefaultRefSet = (): WeakSet<object> => {
  if (!defaultRefSet) {
    defaultRefSet = unstable_getInternalStates().refSet
  }
  return defaultRefSet
}

export const deepClone = <T>(
  obj: T,
  getRefSet: () => WeakSet<object> = getDefaultRefSet,
): T => {
  if (!isObject(obj) || getRefSet().has(obj)) {
    return obj
  }
  const baseObject: T = Array.isArray(obj)
    ? []
    : Object.create(Object.getPrototypeOf(obj))
  Reflect.ownKeys(obj).forEach((key) => {
    baseObject[key as keyof T] = deepClone(obj[key as keyof T], getRefSet)
  })
  return baseObject
}
