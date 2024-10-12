import { useEffect } from 'react'
import { useSnapshot, proxy, subscribe } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

const state = proxyMap()
const k1 = 'k1'
const k2 = 'k2'
state.set(k1, 'hello')

const App = () => {
  const snap = useSnapshot(state)
  const handleClick = () => {
    //state.delete(k1);
    state.set(k2, 'hey')
  }
  return (
    <>
      <p>{snap.has(k2) ? 'yes' : 'no'}</p>
      <button onClick={handleClick}>Click Me</button>
      <div>{Math.random()}</div>
    </>
  )
}

export default App

// const state = proxyMap()
// const k1 = {}
// state.set(k1, {
//   foo: 'bar',
// })

// const App = () => {
//   const snap = useSnapshot(state)
//   const handleClick = () => {
//     state.delete(k1)
//     state.set('foo', 'asdf')
//   }

//   useEffect(() => {
//     console.log(snap)
//   }, [snap])
//   console.log(snap.get(k1) === k1)
//   return (
//     <>
//       <p>{snap.has(k1) ? 'yes k1' : 'no k1'}</p>
//       <p>{snap.has('foo') ? 'foo' : 'no foo'}</p>
//       <button onClick={handleClick}>Click Me</button>
//       <div>{Math.random()}</div>
//     </>
//   )
// }

// export default App

// const state = proxyMap([
//   ['first', 0],
//   ['fdsa', 1],
//   ['second', 2],
//   ['foo', 3],
// ])
// function App() {
//   const snap = useSnapshot(state)

//   const handleClick = () => {
//     state.set('first', 10)
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

// const state = proxyMap([['test', 'test']])
// console.log('state', state)

// setTimeout(() => {
//   state.set('foo', 'foo: bar')
// }, 3000)

// setTimeout(() => {
//   state.set('bar', 'bar: foo')
// }, 4000)

// setTimeout(() => {
//   state.set('test', 'test: test')
// }, 5000)

// const Comp1 = () => {
//   const snap = useSnapshot(state)

//   console.log(snap)
//   console.log('COMP1 RENDER')

//   return <p>Comp 1:{snap.get('foo')}</p>
// }

// const Comp2 = () => {
//   const snap = useSnapshot(state)

//   console.log('COMP2 RENDER')

//   return <p>Comp 2: {snap.get('bar')}</p>
// }

// const Comp3 = () => {
//   const snap = useSnapshot(state)

//   console.log('COMP3 RENDER')

//   return <p>Comp 3: {snap.get('test')}</p>
// }

// const App = () => {
//   return (
//     <>
//       <Comp1 />
//       <Comp2 />
//       <Comp3 />
//     </>
//   )
// }

// export default App
