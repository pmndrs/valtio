import { useEffect } from 'react'
import { useSnapshot } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

// devtools(state, { enabled: true });

const state = proxyMap([
  ['test1', 'hello'],
  ['test2', 'hello2'],
])

function Comp1() {
  const snap = useSnapshot(state)
  console.log('COMP1 RERENDER')
  console.log(snap)

  useEffect(() => {
    console.log(snap)
  }, [snap])

  return (
    <div>
      <button
        onClick={() => {
          state.set('test1', 'hello234')
        }}
      >
        Test 1
      </button>
      <div>{snap.get('test1')}</div>
    </div>
  )
}

function Comp2() {
  const snap = useSnapshot(state)
  console.log('COMP2 RERENDER')
  console.log(snap)

  useEffect(() => {
    console.log(snap)
  }, [snap])

  return (
    <div>
      <button
        onClick={() => {
          state.set('test2', 'hello2432')
        }}
      >
        Test 2
      </button>
      <div>{snap.get('test2')}</div>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Comp1 />
      <Comp2 />
    </>
  )
}
