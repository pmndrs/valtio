import * as React from 'react'
import { actions, filters, Todo, useFilter, useTodos } from './store'

function App() {
  return (
    <div className="App">
      <h1>Todo</h1>
      <AddTodoInput />
      <TodoList />
      <FilterRow />
    </div>
  )
}

function AddTodoInput() {
  const [value, setValue] = React.useState('')

  function handleSubmit() {
    actions.addTodo({ name: value })
    setValue('')
  }

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={({ target }) => setValue(target.value)}
      />
      <button onClick={handleSubmit}>Add Todo</button>
    </div>
  )
}

function TodoList() {
  const todos = useTodos()
  return (
    <div>
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} />
      ))}
    </div>
  )
}

function TodoRow({ todo }: { todo: Todo }) {
  function handleCheckBoxChange(event: React.ChangeEvent<HTMLInputElement>) {
    actions.toggleTodo(todo.id, event.target.checked)
  }

  function handleDeleteClick() {
    actions.removeTodo(todo.id)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        textDecoration: todo.completed ? 'line-through' : 'initial',
      }}>
      <input type="checkbox" onChange={handleCheckBoxChange} />
      <h2>{todo.name}</h2>
      <h2 style={{ color: 'red', paddingLeft: 10 }} onClick={handleDeleteClick}>
        X
      </h2>
    </div>
  )
}

function FilterRow() {
  const activeFilter = useFilter()

  return (
    <div style={{ padding: 20 }}>
      {filters.map((filter) => (
        <button
          style={{
            fontWeight: activeFilter === filter ? 'bold' : 'normal',
          }}
          onClick={() => {
            actions.toggleFilter(filter)
          }}>
          {filter}
        </button>
      ))}
    </div>
  )
}

export default App
