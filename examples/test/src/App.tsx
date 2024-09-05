import { useSnapshot, getVersion , proxy } from '../../../dist/esm/index.mjs'
import { proxyMap, devtools } from '../../../dist/esm/utils.mjs'
import { createProxy, isChanged } from 'proxy-compare';
const state = proxyMap();
const state2 = proxy({
  foo: ''
})

export default function App() {
  const snap = useSnapshot(state);
  const snap2 = useSnapshot(state2)

  return (
    <div>
      <button
        onClick={() => {
          console.log(snap.get("hello"))
          console.log(getVersion(state))
          state.set("hello", "world");
          state2.foo = 'bar'

          console.log(snap.get("hello"))
          setTimeout(() => {
            state.set("hello", "world2");

          }, 2000)
          console.log(getVersion(state))
        }}
      >
        add
      </button>
      Goodbye {snap.get("hello")} Foo {snap2.foo}
    </div>
  );
}
