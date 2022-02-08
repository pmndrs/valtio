import { actions, useTodos } from "./store";

import { TodoItem } from "./TodoItem";

export function TodoList() {
  const todos = useTodos();

  const handleToggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    actions.toggleAll(e.target.checked);
  };

  if (!todos.length) return null;

  return (
    <section className="main">
      <input
        id="toggle-all"
        className="toggle-all"
        type="checkbox"
        onChange={handleToggleAll}
      />
      <label htmlFor="toggle-all" />
      <ul className="todo-list">
        {todos.map((todo) => (
          <TodoItem key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  );
}
