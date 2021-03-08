import { proxy, useSnapshot } from 'valtio'

export interface Todo {
  id: number
  name: string
  completed?: boolean
}

export const filters: Filter[] = ['all', 'completed']
type Filter = 'all' | 'completed'

interface Store {
  todos: Todo[]
  filter: Filter
}

export const store = proxy<Store>({
  todos: [],
  filter: 'all',
})

let id = 0
export const actions = {
  addTodo(todo: Omit<Todo, 'id'>) {
    store.todos.push({
      ...todo,
      id: id++,
    })
  },
  toggleTodo(id: number, value: boolean) {
    const todo = store.todos.find((todo) => todo.id === id)
    if (todo && value) todo.completed = value
    else if (todo) todo.completed = !todo.completed
  },
  removeTodo(id: number) {
    store.todos = store.todos.filter((todo) => todo.id !== id)
  },
  toggleFilter(filter: Filter) {
    store.filter = filter
  },
}

export function useTodos() {
  const snapShot = useSnapshot(store)

  switch (snapShot.filter) {
    case 'all':
      return snapShot.todos
    case 'completed':
      return snapShot.todos.filter((todo) => todo.completed)
    default:
      throw Error('Error: un supported filter')
  }
}

export function useFilter() {
  return useSnapshot(store).filter
}
