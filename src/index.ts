/* 
  Dynamic re-exports blocked to support snowpack ts re-export issues
*/
// export * from "./vanilla"
// export * from "./react"

export { useSnapshot } from './react'

export { ref, proxy, getVersion, subscribe, snapshot } from './vanilla'
