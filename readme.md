![VALTIO](/valtio.svg)

<code>npm i valtio</code> makes proxy-state simple

#### Wrap your state object

```js
import { proxy, useProxy } from 'valtio'

const state = proxy({ count: 0, text: 'hello' })
```

#### Mutate from anywhere

```js
setInterval(() => {
  ++state.count
}, 1000)
```

#### React via useProxy

```js
function Counter() {
  const snapshot = useProxy(state)
  // Rule of thumb: read from snapshots, mutate the source
  // The component renders when the snapshot-reads change
  return (
    <div>
      {snapshot.count}
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}
```

#### Subscribe from anywhere

```js
import { subscribe } from 'valtio'

// Suscribe to all state changes
const unsubscribe = subscribe(state, () =>
  console.log(`state has changed to ${state}`)
)
// Unsubscribe by calling the result
unsubscribe()
// Subscribe to a portion of state
subscribe(state.obj, () => console.log(`state.obj has changed to ${state.obj}`))
```

#### Suspense out of the box

```js
const state = proxy({ post: fetch(url).then((res) => res.json()) })

function Post() {
  const snapshot = useProxy(state)
  // Valtio suspends promises, access async data directly
  return <div>{snapshot.post.title}</div>
}

function App() {
  return (
    <Suspense fallback={<span>waiting...</span>}>
      <Post />
    </Suspense>
  )
}
```

#### Vanilla JS

```js
import { proxy, subscribe, snapshot } from 'valtio/vanilla'

const state = proxy({ count: 0, text: 'hello' })

subscribe(state, () => {
  console.log('state is mutated')
  const obj = snapshot(state) // A snapshot is an immutable object
})
```
