import { useSnapshot, proxy, subscribe } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

// const state = proxyMap()
// state.set('first', 1)
// state.set('second', 2)

// function App() {
//   const snap = useSnapshot(state)
//   const handleClick = () => {
//     state.delete('first')
//   }
//   return (
//     <>
//       <p>{snap.get('second') as number}</p>
//       <p>Should not change on click: {Math.random()}</p>
//       <button onClick={handleClick}>Click Me</button>
//     </>
//   )
// }

// export default App

// import { useSnapshot } from '../../../dist/esm/index.mjs'
// import { proxyMap } from '../../../dist/esm/utils.mjs'

const state = proxyMap([['test', 'test']])

setTimeout(() => {
  state.set('asdf', 'bar')
}, 5000)

setTimeout(() => {
  state.set('bat', 'foo')
}, 7000)

setTimeout(() => {
  state.set('foo', 'bar')
}, 9000)

const Comp1 = () => {
  const snap = useSnapshot(state)

  console.log('COMP1 RENDER')

  return <p>{state.has('foo') ? snap.get('foo') : ''}</p>
}

const Comp2 = () => {
  const snap = useSnapshot(state)

  console.log('COMP2 RENDER')

  return <p>{state.has('bar') ? snap.get('bar') : ''}</p>
}

const Comp3 = () => {
  const snap = useSnapshot(state)

  console.log('COMP3 RENDER')

  return <p>{state.has('test') ? snap.get('test') : ''}</p>
}

const App = () => {
  return (
    <>
      <Comp1 />
      <Comp2 />
      <Comp3 />
    </>
  )
}

export default App
