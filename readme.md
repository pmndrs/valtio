![](/readme.svg)

<details id="alt">
  <summary>
    Alt. Description
  </summary>

<div align="center">
  <h2 align="center">Valtio</h2>
  <p align="center"><code>npm i valtio</code> makes proxy-state simple</p>
</div>

### Wrap your state object

```js
import { proxy, useProxy } from 'valtio'

const state = proxy({ count: 0, text: 'hello' })
```

### Mutate from anywhere

```js
setInterval(() => {
  ++state.count
}, 1000)
```

### React via `useProxy`

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

### Subscribe from anywhere

```js
import { subscribe } from 'valtio'

// Suscribe to all state changes
const unsubscribe = subscribe(state, () =>
  console.log(`state has changed to ${state}`)
)
// Unsubscribe by calling the result
unsubscribe()
// Subscribe to a portion of state
subscribe(state.foo, () => console.log(`state.foo has changed to ${state.foo}`))
```

### Suspense out of the box

```js
const state = create({ post: fetch(url).then((res) => res.json()) })

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

**And that's it!**

</details>
