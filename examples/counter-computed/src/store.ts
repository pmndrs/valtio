import { proxyWithComputed } from 'valtio/utils'

export const state = proxyWithComputed(
  {
    count: 1,
  },
  {
    doubled() {
      return this.count * 2
    },
    quadrupled: {
      get() {
        return this.doubled * 2
      },
      set(v: number) {
        this.count = v >> 2
      },
    },
  }
)

export const inc = () => state.count++
export const dec = () => state.quadrupled--
