import { useSnapshot } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist/esm/utils.mjs'

const state = proxyMap([['test', 'test']])

setTimeout(() => {
  state.set('foo', 'bar')
}, 10000)

const Comp1 = () => {
  const snap = useSnapshot(state)

  console.log('COMP1 RENDER')

  return <p>{snap.has('foo') ? snap.get('foo') : ''}</p>
}

const Comp2 = () => {
  const snap = useSnapshot(state)

  console.log('COMP2 RENDER')

  return <p>{snap.has('bar') ? snap.get('bar') : ''}</p>
}

const Comp3 = () => {
  const snap = useSnapshot(state)

  console.log('COMP3 RENDER')

  return <p>{snap.has('test') ? snap.get('test') : ''}</p>
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
