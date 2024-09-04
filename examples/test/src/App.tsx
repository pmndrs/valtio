import { useSnapshot } from '../../../dist/esm/index.mjs'
import { proxyMap, devtools } from '../../../dist/esm/utils.mjs'
import { createProxy, isChanged } from 'proxy-compare';
const state = proxyMap();
const affected = new WeakMap()
const p = createProxy(state, affected)


export default function App() {
  const snap = useSnapshot(state, { sync: true });
  devtools(state, { enabled: true });

  return (
    <div>
      <button
        onClick={() => {
          state.set("hello", "world");
        }}
      >
        add
      </button>
      Goodbye {snap.get("hello")}
    </div>
  );
}
