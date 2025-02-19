import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { proxy, useSnapshot } from 'valtio'

import banner from './assets/banner.svg'

import './index.css'

const state = proxy({ count: 0 })

const Counter = () => {
  const snap = useSnapshot(state)

  return (
    <>
      <span className="text-3xl">{snap.count}</span>
      <button
        className="bg-sky-400 font-bold py-2 px-4 rounded"
        onClick={() => ++state.count}
      >
        +1
      </button>
    </>
  )
}

function App() {
  return (
    <div className="grid place-items-center gap-6">
      <a href="https://valtio.dev/" target="_blank" rel="noreferrer">
        <img
          src={banner}
          alt="Valtio banner"
          className="w-96"
          style={{
            filter: 'drop-shadow(0 0 2em #b2ebf2)',
          }}
        />
      </a>

      <h1 className="text-5xl font-bold">Valtio Starter</h1>

      <Counter />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
