import PrismCode from 'react-prism'
import 'prismjs'
import 'prismjs/components/prism-jsx.min'

import React from 'react'
import { useSnapshot } from 'valtio'
import { state, inc, dec } from './store'
// You wrap your state
const Figure = () => {
  const { count, doubled, quadrupled } = useSnapshot(state)
  // This component *only* renders when state.number changes ...
  return (
    <div className="figure">
      {count}-{doubled}-{quadrupled}
    </div>
  )
}

const Controls = () => {
  // This component simply mutates the state model, just like that ...
  return (
    <div className="logo">
      <ButtonUp onClick={inc} />
      <ButtonDown onClick={dec} />
    </div>
  )
}

const ButtonUp = ({ onClick }: { onClick: () => void }) => (
  <svg viewBox="0 0 430 452" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      onClick={onClick}
      d="M214.83 0.95459C82.4432 0.95459 0.0568237 91.2955 0.0568237 226.523C0.0568237 272.651 9.76549 313.624 27.8727 347.545L340.5 36.3569C306.7 13.5435 264.249 0.95459 214.83 0.95459Z"
      fill="#A5FFCE"
    />
  </svg>
)

const ButtonDown = ({ onClick }: { onClick: () => void }) => (
  <svg viewBox="0 0 430 452" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      onClick={onClick}
      d="M214.83 451.523C347.216 451.523 429.602 360.898 429.602 226.523C429.602 187.816 422.852 152.786 410.112 122.5L106 426.214C136.689 442.604 173.299 451.523 214.83 451.523Z"
      fill="#FFBEC2"
    />
  </svg>
)

const code = `import { proxyWithComputed } from 'valtio/utils'

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
`

export default function App() {
  return (
    <>
      <div className="app">
        <Figure />
        <Controls />
      </div>
      <div className="code">
        <PrismCode component="pre" className="language-jsx" children={code} />
      </div>
    </>
  )
}
