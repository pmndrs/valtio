import { useSnapshot, proxy } from '../../../dist/esm/index.mjs'
import { proxyMap } from '../../../dist//esm/utils.mjs'



const state = proxy({
  map: proxyMap([[-10, 1]]),
})

const TestComponent = (e) => {
  const snap = useSnapshot(state)

  const handleClick = () => {
    state.map.set(-10, 'foobar')
    console.log(snap)
  }

  return (
    <>
      <div>size: {snap.map.size} {snap.map.get(-10)}</div>
      <button onClick={handleClick}>button</button>
    </>
  )
}

export default TestComponent
