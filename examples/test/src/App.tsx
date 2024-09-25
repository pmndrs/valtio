import { useEffect } from 'react'
import { useSnapshot } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

// devtools(state, { enabled: true });

const state = proxyMap()

function Comp1() {
  const snap = useSnapshot(state)
  console.log('COMP1 RERENDER')
  console.log(snap)

  return (
    <div>
      <button
        onClick={() => {
          state.set('test1', 'hello234')
          console.log(state)
        }}
      >
        Test 1
      </button>
      <div>
        {snap.has('test1') ? (snap.get('test1') as string | undefined) : ''}
      </div>
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
      <div>
        {snap.has('test2') ? (snap.get('test2') as string | undefined) : ''}
      </div>
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
