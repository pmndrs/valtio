<img src="logo.svg" alt="valtio">
<br />
<br />

<code>npm i valtio</code> makes proxy-state simple

[![Build Status](https://img.shields.io/github/actions/workflow/status/pmndrs/valtio/lint-and-type.yml?branch=main&style=flat&colorA=000000&colorB=000000)](https://github.com/pmndrs/valtio/actions?query=workflow%3ALint)
[![Build Size](https://img.shields.io/bundlephobia/minzip/valtio?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=valtio)
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

Create a local snapshot that catches changes. Rule of thumb: read from snapshots in render function, otherwise use the source. The component will only re-render when the parts of the state you access have changed, it is render-optimized.

```jsx
// This will re-render on `state.count` change but not on `state.text` change
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

<details>
<summary>Note for TypeScript users: Return type of useSnapshot can be too strict.</summary>

The `snap` variable returned by `useSnapshot` is a (deeply) read-only object.
Its type has `readonly` attribute, which may be too strict for some use cases.

To mitigate typing difficulties, you might want to loosen the type definition:

```ts
declare module 'valtio' {
  function useSnapshot<T extends object>(p: T): T
}
```

See [#327](https://github.com/pmndrs/valtio/issues/327) for more information.

</details>

<details>
<summary>Note: useSnapshot returns a new proxy for render optimization.</summary>

Internally, `useSnapshot` calls `snapshot` in valtio/vanilla,
and wraps the snapshot object with another proxy to detect property access.
This feature is based on [proxy-compare](https://github.com/dai-shi/proxy-compare).

Two kinds of proxies are used for different purposes:

- `proxy()` from `valtio/vanilla` is for mutation tracking or write tracking.
- `createProxy()` from `proxy-compare` is for usage tracking or read tracking.
</details>

<details>
<summary>Use of <code>this</code> is for expert users.</summary>

Valtio tries best to handle `this` behavior
but it's hard to understand without familiarity.

```js
const state = proxy({
  count: 0,
  inc() {
    ++this.count
  },
})
state.inc() // `this` points to `state` and it works fine
const snap = useSnapshot(state)
snap.inc() // `this` points to `snap` and it doesn't work because snapshot is frozen
```

To avoid this pitfall, the recommended pattern is not to use `this` and prefer arrow function.

```js
const state = proxy({
  count: 0,
  inc: () => {
    ++state.count
  },
})
```

</details>

If you are new to this, it's highly recommended to use
[eslint-plugin-valtio](https://github.com/pmndrs/eslint-plugin-valtio).

#### Subscribe from anywhere

You can access state outside of your components and subscribe to changes.

```jsx
import { subscribe } from 'valtio'

// Subscribe to all state changes
const unsubscribe = subscribe(state, () =>
  console.log('state has changed to', state)
)
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

To subscribe to a primitive value of state, consider `subscribeKey` in utils.

```jsx
import { subscribeKey } from 'valtio/utils'

const state = proxy({ count: 0, text: 'hello' })
subscribeKey(state, 'count', (v) =>
  console.log('state.count has changed to', v)
)
```

There is another util `watch` which might be convenient in some cases.

```jsx
import { watch } from 'valtio/utils'

const state = proxy({ count: 0 })
const stop = watch((get) => {
  console.log('state has changed to', get(state)) // auto-subscribe on use
})
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

See [#61](https://github.com/pmndrs/valtio/issues/61) and [#178](https://github.com/pmndrs/valtio/issues/178) for more information.

```js
import { proxy, ref } from 'valtio'

const state = proxy({
  count: 0,
  dom: ref(document.body),
})
```

#### Update transiently (for often occurring state-changes)

You can read state in a component without causing re-render.

```jsx
function Foo() {
  const { count, text } = state
  // ...
```

Or, you can have more control with subscribing in useEffect.

```jsx
function Foo() {
  const total = useRef(0)
  useEffect(() => subscribe(state.arr, () => {
    total.current = state.arr.reduce((p, c) => p + c)
  }), [])
  // ...
```

#### Update synchronously

By default, state mutations are batched before triggering re-render.
Sometimes, we want to disable the batching.
The known use case of this is `<input>` [#270](https://github.com/pmndrs/valtio/issues/270).

```jsx
function TextBox() {
  const snap = useSnapshot(state, { sync: true })
  return (
    <input value={snap.text} onChange={(e) => (state.text = e.target.value)} />
  )
}
```

#### Dev tools

You can use [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) for plain objects and arrays.

```jsx
import { devtools } from 'valtio/utils'

const state = proxy({ count: 0, text: 'hello' })
const unsub = devtools(state, { name: 'state name', enabled: true })
```

<details>
  <summary>Manipulating state with Redux DevTools</summary>
The screenshot below shows how to use Redux DevTools to manipulate state. First select the object from the instances drop down. Then type in a JSON object to dispatch. Then click "Dispatch". Notice how it changes the state.

<br/>
<img width="564" alt="image" src="https://user-images.githubusercontent.com/6372489/141134955-26e9ffce-1e2a-4c8c-a9b3-d9da739610fe.png">
</details>

#### Use it vanilla

Valtio is not tied to React, you can use it in vanilla-js.

```jsx
import { proxy, subscribe, snapshot } from 'valtio/vanilla'
// import { ... } from 'valtio/vanilla/utils'

const state = proxy({ count: 0, text: 'hello' })

subscribe(state, () => {
  console.log('state is mutated')
  const obj = snapshot(state) // A snapshot is an immutable object
})
```

#### `useProxy` util

While the separation of proxy state and its snapshot is important,
it's confusing for beginners.
We have a convenient util to improve developer experience. useProxy returns shallow proxy state and its snapshot, meaning you can only mutate on root level.

```js
import { useProxy } from 'valtio/utils'

const state = proxy({ count: 1 })

const Component = () => {
  // useProxy returns a special proxy that can be used both in render and callbacks
  // The special proxy has to be used directly in a function scope. You can't destructure it outside the scope.
  const $state = useProxy(state)
  return (
    <div>
      {$state.count}
      <button onClick={() => ++$state.count}>+1</button>
    </div>
  )
}
```

#### `derive` util

You can subscribe to some proxies and create a derived proxy.

```js
import { derive } from 'valtio/utils'

// create a base proxy
const state = proxy({
  count: 1,
})

// create a derived proxy
const derived = derive({
  doubled: (get) => get(state).count * 2,
})

// alternatively, attach derived properties to an existing proxy
derive(
  {
    tripled: (get) => get(state).count * 3,
  },
  {
    proxy: state,
  }
)
```

#### `proxyWithHistory` util

This is a utility function to create a proxy with snapshot history.

```js
import { proxyWithHistory } from 'valtio/utils'

const state = proxyWithHistory({ count: 0 })
console.log(state.value) // ---> { count: 0 }
state.value.count += 1
console.log(state.value) // ---> { count: 1 }
state.undo()
console.log(state.value) // ---> { count: 0 }
state.redo()
console.log(state.value) // ---> { count: 1 }
```

#### `proxySet` util

This is to create a proxy which mimic the native Set behavior. The API is the same as Set API

```js
import { proxySet } from 'valtio/utils'

const state = proxySet([1, 2, 3])
//can be used inside a proxy as well
//const state = proxy({
//    count: 1,
//    set: proxySet()
//})

state.add(4)
state.delete(1)
state.forEach((v) => console.log(v)) // 2,3,4
```

#### `proxyMap` util

This is to create a proxy which emulate the native Map behavior. The API is the same as Map API

```js
import { proxyMap } from 'valtio/utils'

const state = proxyMap([
  ['key', 'value'],
  ['key2', 'value2'],
])
state.set('key', 'value')
state.delete('key')
state.get('key') // ---> value
state.forEach((value, key) => console.log(key, value)) // ---> "key", "value", "key2", "value2"
```

#### Compatibility

Valtio works with React with hooks support (>=16.8).
It only depends on `react` and works with any
renderers such as `react-dom`, `react-native`, `react-three-fiber`, and so on.

Valtio works on Node.js, Next.js and other frameworks.

Valtio also works without React. See [vanilla](#use-it-vanilla).

#### Plugins

- [eslint-plugin-valtio](https://github.com/pmndrs/eslint-plugin-valtio)

#### Recipes

Valtio is unopinionated about best practices.
The community is working on recipes on wiki pages.

- [How to organize actions](https://github.com/pmndrs/valtio/wiki/How-to-organize-actions)
- [How to persist states](https://github.com/pmndrs/valtio/wiki/How-to-persist-states)
- [How to use with context](https://github.com/pmndrs/valtio/wiki/How-to-use-with-context)
- [How to split and compose states](https://github.com/pmndrs/valtio/wiki/How-to-split-and-compose-states)
