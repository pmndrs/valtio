import './styles.css'
import React from 'react'
import { useSnapshot } from 'valtio'
import { proxyWithHistory } from 'valtio/utils'

const textProxy = proxyWithHistory({
  text: 'Add some test to this initial value and then undo/redo',
})
const update = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
  (textProxy.value.text = e.target.value)

export default function App() {
  const { value, undo, redo, history, canUndo, canRedo } =
    useSnapshot(textProxy)

  return (
    <div className="App">
      <h2>Editor with history</h2>
      <small>{history.index} changes</small>
      <div className="editor">
        <textarea value={value.text} rows={4} onChange={update} />
      </div>
      <button onClick={undo} disabled={!canUndo()}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo()}>
        Redo
      </button>
    </div>
  )
}
