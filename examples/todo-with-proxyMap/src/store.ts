import { proxy, useSnapshot } from "valtio";
import { proxyMap } from "valtio/utils";

export interface Todo {
  id: number;
  name: string;
  completed?: boolean;
}

export const filters: Filter[] = ["all", "todo", "done"];
type Filter = "all" | "todo" | "done";

interface Store {
  todos: Map<number, Todo>;
  filter: Filter;
}

export const store = proxy<Store>({
  todos: proxyMap(),
  filter: "all"
});

let id = 0;
export const actions = {
  addTodo(todo: Omit<Todo, "id">) {
    const nextId = id++;
    store.todos.set(nextId, { id: nextId, ...todo, completed: false });
  },
  toggleTodo(id: number, value: boolean) {
    const todo = store.todos.get(id);
    if (todo && value) todo.completed = value;
    else if (todo) todo.completed = !todo.completed;
  },
  toggleAll(completed: boolean) {
    store.todos.forEach((todo) => {
      todo.completed = completed;
    });
  },
  removeTodo(id: number) {
    store.todos.delete(id);
  },
  toggleFilter(filter: Filter) {
    store.filter = filter;
  },
  updateTodo(id: number, value: string) {
    const todo = store.todos.get(id);
    if (todo) todo.name = value;
  }
};

export function useTodos() {
  const snapshot = useSnapshot(store);

  switch (snapshot.filter) {
    case "all":
      return Array.from(snapshot.todos.values());
    case "done":
      return Array.from(snapshot.todos.values()).filter(
        (todo) => todo.completed
      );
    case "todo":
      return Array.from(snapshot.todos.values()).filter(
        (todo) => !todo.completed
      );
    default:
      throw Error("Error: un supported filter");
  }
}

export function useTodosCount() {
  const snapshot = useSnapshot(store);
  const count = {
    active: 0,
    completed: 0
  };

  snapshot.todos.forEach(({ completed }) => {
    if (completed) {
      count.completed++;
    } else {
      count.active++;
    }
  });

  return count;
}

export function useFilter() {
  return useSnapshot(store).filter;
}
