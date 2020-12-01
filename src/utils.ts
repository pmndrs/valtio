import { useRef } from 'react'
import { proxy, useProxy } from 'valtio'

export const useLocalProxy = <T extends object>(init: T | (() => T)) => {
  const ref = useRef<T>()
  if (!ref.current) {
    const initialObject =
      typeof init === 'function' ? (init as () => T)() : init
    ref.current = proxy(initialObject)
  }
  return [useProxy(ref.current), ref.current] as const
}
