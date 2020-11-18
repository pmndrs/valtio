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
import { subscribeProxy } from 'valtio'
import globalState from './globalState';

subscribeProxy(globalState, () => {
  console.log(`globalState.count changed to ${state.count}`);
})
```

**And that's it!**

</details>
