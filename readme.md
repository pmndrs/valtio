![VALTIO](valtio.svg)

<code>npm i valtio</code> makes proxy-state simple

##### Wrap your state object

Valtio turns the object you pass it into a self-aware proxy.

```jsx
import { proxy, useProxy } from 'valtio'

const state = proxy({ count: 0, text: 'hello' })
```

##### Mutate from anywhere

You can make changes to it in the same way you would to a normal js-object.

```jsx
setInterval(() => {
  ++state.count
}, 1000)
```

##### React via useProxy

Create a local snapshot that catches changes. Rule of thumb: read from snapshots, mutate the source. The component will only re-render when the parts of the state you access have changed, it is render-optimized.

```jsx
function Counter() {
  const snapshot = useProxy(state)
  return (
    <div>
      {snapshot.count}
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}
```

##### Subscribe from anywhere

You can access state outside of your components and subscribe to changes.

```jsx
import { subscribe } from 'valtio'

// Suscribe to all state changes
const unsubscribe = subscribe(state, () => console.log('state has changed to', state))
// Unsubscribe by calling the result
unsubscribe()
```

You can also subscribe to a portion of state.

```jsx
const state = proxy({ obj: { foo: 'bar' }, arr: ['hello'] })

subscribe(state.obj, () => console.log('state.obj has changed to', state.obj))
state.obj.foo = 'baz'

subscribe(state.arr, () => console.log('state.arr has changed to', state.arr))
state.arr.push('world')
```

To subscribe to a primitive value of state, consider [subscribeKey](./src/utils.ts#L28-L35) in utils.

##### Suspend your components

Valtio supports React-suspense and will throw promises that you access within a components render function. This eliminates all the async back-and-forth, you can access your data directly while the parent is responsible for fallback state and error handling.

```jsx
const state = proxy({ post: fetch(url).then((res) => res.json()) })

function Post() {
  const snapshot = useProxy(state)
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

##### Update synchronously

By default, state mutations are batched before triggering re-render. Sometimes, we want to disable the batching.

```jsx
function TextBox() {
  const snapshot = useProxy(state, { sync: true })
  return <input value={snapshot.text} onChange={(e) => (state.text = e.target.value)} />
}
```

##### Update transiently

You can subscribe a component to state without causing render, just stick the subscribe function into useEffect.

```jsx
function Foo() {
  const ref = useRef(state.obj)
  useEffect(() => subscribe(state.obj, () => ref.current = state.obj), [state.obj])
```

##### Dev tools

You can use [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension) for plain objects and arrays.

```jsx
import { devtools } from 'valtio/utils'

const state = proxy({ count: 0, text: 'hello' })
const unsub = devtools(state, 'state name')
```

##### Use it vanilla

Valtio is not tied to React, you can use it in vanilla-js.

```jsx
import { proxy, subscribe, snapshot } from 'valtio/vanilla'

const state = proxy({ count: 0, text: 'hello' })

subscribe(state, () => {
  console.log('state is mutated')
  const obj = snapshot(state) // A snapshot is an immutable object
})
```

##### Use it locally in components

You can use it locally in components. [Notes](./src/utils.ts#L5-L15)

```jsx
import { useLocalProxy } from 'valtio/utils'

function Foo() {
  const [snapshot, state] = useLocalProxy({ count: 0, text: 'hello' })
```
