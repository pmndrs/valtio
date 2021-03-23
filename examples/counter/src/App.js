// @ts-ignore
import PrismCode from 'react-prism'
import 'prismjs'
import 'prismjs/components/prism-jsx.min'

import React from 'react'
import { proxy, useSnapshot } from 'valtio'

// You wrap your state
const state = proxy({ number: 0 })

// You can freely mutate it from anywhere you want ...
state.nested = { ticks: 0 }
setInterval(() => state.nested.ticks++, 200)

const Figure = () => {
  const snap = useSnapshot(state)
  // This component *only* renders when state.number changes ...
  return <div className="figure">{snap.number}</div>
}

const Ticks = () => {
  const snap = useSnapshot(state)
  // This component *only* renders when state.nested.ticks changes ...
  return <div className="ticks">{snap.nested.ticks} —</div>
}

const Controls = () => {
  // This component simply mutates the state model, just like that ...
  return (
    <div className="logo">
      <ButtonUp onClick={() => state.number++} />
      <ButtonDown onClick={() => state.number--} />
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

const code = `import { proxy, useSnapshot } from 'valtio'

// You wrap your state
const state = proxy({ number: 0 })

// You can freely mutate it from anywhere you want ...
state.nested = { ticks: 0 }
setInterval(() => state.nested.ticks++, 200)

const Figure = () => {
  const snap = useSnapshot(state)
  // This component *only* renders when state.number changes ...
  return <div className="figure">{snap.number}</div>
}

const Ticks = () => {
  const snap = useSnapshot(state)
  // This component *only* renders when state.nested.ticks changes ...
  return <div className="ticks">{snap.nested.ticks} —</div>
}

const Controls = () => {
  // This component simply mutates the state model, just like that ...
  return (
    <div className="logo">
      <ButtonUp onClick={() => state.number++} />
      <ButtonDown onClick={() => state.number--} />
    </div>
  )
}
`

export default function App() {
  return (
    <>
      <div className="app">
        <Figure />
        <Ticks />
        <Controls />
      </div>
      <div className="code">
        <PrismCode component="pre" className="language-jsx" children={code} />
      </div>
    </>
  )
}
