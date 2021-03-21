<img src="logo.svg" alt="valtio">
<br />
<br />

<code>npm i valtio</code> makes proxy-state simple

[![Build Status](https://img.shields.io/github/workflow/status/pmndrs/valtio/Lint?style=flat&colorA=000000&colorB=000000)](https://github.com/pmndrs/valtio/actions?query=workflow%3ALint)
[![Build Size](https://img.shields.io/bundlephobia/min/valtio?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=valtio)
[![Version](https://img.shields.io/npm/v/valtio?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/valtio)
[![Downloads](https://img.shields.io/npm/dt/valtio.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/valtio)
[![Discord Shield](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=ffffff)](https://discord.gg/poimandres)

#### Wrap your state object

Valtio turns the object you pass it into a self-aware proxy.

```jsx
import { proxy, useSnapshot } from 'valtio'

const state = proxy({ count: 0, text: 'hello' })
```

#### Mutate from anywhere

You can make changes to it in the same way you would to a normal js-object.

```jsx
setInterval(() => {
  ++state.count
}, 1000)
```

#### React via useSnapshot

Create a local snapshot that catches changes. Rule of thumb: read from snapshots, mutate the source. The component will only re-render when the parts of the state you access have changed, it is render-optimized.

```jsx
function Counter() {
  const snap = useSnapshot(state)
  return (
    <div>
      {snap.count}
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}
```

#### Subscribe from anywhere

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

To subscribe to a primitive value of state, consider subscribeKey in utils.

```jsx
import { subscribeKey } from 'valtio/utils'

const state = proxy({ count: 0, text: 'hello' })
subscribeKey(state, 'count', (v) => console.log('state.count has changed to', v))
```

#### Suspend your components

Valtio supports React-suspense and will throw promises that you access within a components render function. This eliminates all the async back-and-forth, you can access your data directly while the parent is responsible for fallback state and error handling.

```jsx
const state = proxy({ post: fetch(url).then((res) => res.json()) })

function Post() {
  const snap = useSnapshot(state)
  return <div>{snap.post.title}</div>
}

function App() {
  return (
    <Suspense fallback={<span>waiting...</span>}>
      <Post />
    </Suspense>
  )
}
```

#### Holding objects in state without tracking them

This may be useful if you have large, nested objects with accessors that you don't want to proxy. `ref` allows you to keep these objects inside the state model.

See https://github.com/pmndrs/valtio/pull/62 for more information.

```js
import { proxy, ref } from 'valtio'

const state = proxy({
  count: 0,
  dom: ref(document.body),
})
```

#### Update transiently

You can subscribe a component to state without causing render, just stick the subscribe function into useEffect.

```jsx
function Foo() {
  const ref = useRef(state.obj)
  useEffect(() => subscribe(state.obj, () => ref.current = state.obj), [state.obj])
  // ...
```

#### Update synchronously

By default, state mutations are batched before triggering re-render. Sometimes, we want to disable the batching.

```jsx
function TextBox() {
  const snap = useSnapshot(state, { sync: true })
  return <input value={snap.text} onChange={(e) => (state.text = e.target.value)} />
}
```

#### Dev tools

You can use [Redux DevTools Extension](https://github.com/zalmoxisus/redux-devtools-extension) for plain objects and arrays.

```jsx
import { devtools } from 'valtio/utils'

const state = proxy({ count: 0, text: 'hello' })
const unsub = devtools(state, 'state name')
```

#### Use it vanilla

Valtio is not tied to React, you can use it in vanilla-js.

```jsx
import { proxy, subscribe, snapshot } from 'valtio/vanilla'

const state = proxy({ count: 0, text: 'hello' })

subscribe(state, () => {
  console.log('state is mutated')
  const obj = snapshot(state) // A snapshot is an immutable object
})
```

#### `useProxy` macro

We have a convenient macro with
[babel-plugin-macros](https://www.npmjs.com/package/babel-plugin-macros).

```js
import { useProxy } from 'valtio/macro'

const Component = () => {
  useProxy(state)
  return (
    <div>
      {state.count}
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}

// the code above becomes the code below.

import { useSnapshot } from 'valtio'

const Component = () => {
  const snap = useSnapshot(state)
  return (
    <div>
      {snap.count}
      <button onClick={() => ++state.count}>+1</button>
    </div>
  )
}
```

#### Computed values

You can have computed values with dependency tracking.
Dependency tracking in valtio conflicts with the work in useSnapshot.
React users should consider using render functions (optionally useMemo)
as a primary mean.
Computed works well for some edge cases and for vanilla-js users.

##### `addComputed`

This is to add new computed to an existing proxy state.
It can add computed to different proxy state.

```js
import { addComputed } from 'valtio/utils'

// create a base proxy
const state = proxy({
  count: 1,
})

// add computed to state
addComputed(state, {
  doubled: snap => snap.count * 2,
})

// create another proxy
const state2 = proxy({
  text: 'hello',
})

// add computed from state to state2
addComputed(state, {
  doubled: snap => snap.count * 2,
}, state2)
```

##### `proxyWithComputed`

This is to create a proxy state with computed at the same time.
It can define setters optionally.

```js
import { proxyWithComputed } from 'valtio/utils'

const state = proxyWithComputed({
  count: 1,
}, {
  doubled: snap => snap.count * 2
})

// Computed values accept custom setters too:
const state2 = proxyWithComputed({
  firstName: 'Alec',
  lastName: 'Baldwin'
}, {
  fullName: {
    get: (snap) => snap.firstName + ' ' + snap.lastName,
    set: (state, newValue) => { [state.firstName, state.lastName] = newValue.split(' ') },
  }
})

// if you want a computed value to derive from another computed, you must declare the dependency first:
const state = proxyWithComputed({
  count: 1,
}, {
  doubled: snap => snap.count * 2,
  quadrupled: snap => snap.doubled * 2
})
```
