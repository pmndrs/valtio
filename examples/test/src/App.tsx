import { useSnapshot, proxy, subscribe } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

// const state = proxyMap([
//   ['first', 0],
//   ['fdsa', 1],
//   ['second', 2],
//   ['foo', 3],
// ])
// let i = 0
// function App() {
//   const snap = useSnapshot(state)
//   const entries = snap.entries()

//   const handleClick = () => {
//     state.set('first', i++)
//     console.log(entries.next())
//   }

//   return (
//     <>
//       <p>{snap.get('first')}</p>
//       <p>{snap.get('fdsa')}</p>
//       <p>{snap.get('second')}</p>
//       <p>{snap.get('foo')}</p>
//       <p>Should not change on click: {Math.random()}</p>
//       <button onClick={handleClick}>Click Me</button>
//     </>
//   )
// }

// export default App

const state = proxyMap([['test', 'test']])

setTimeout(() => {
  state.set('asdf', 'bar')
}, 5000)

setTimeout(() => {
  state.set('bat', 'foo')
}, 7000)

setTimeout(() => {
  state.set('foo', 'bar')
  state.set('test', 'test')
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
