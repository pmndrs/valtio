import { useEffect, useRef } from 'react'

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function useCommitCount(initialCount = 0): number {
  const commitCountRef = useRef(initialCount)
  useEffect(() => {
    commitCountRef.current += 1
  })
  return commitCountRef.current
}
