import React from "react";

import { actions } from "./store";

export function AddTodoInput() {
  const [value, setValue] = React.useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim().length > 0) {
      actions.addTodo({ name: value });
      setValue("");
    }
  }

  return (
    <header className="header">
      <h1>Todo</h1>
      <form onSubmit={handleSubmit}>
        <input
          className="new-todo"
          type="text"
          value={value}
          placeholder="What needs to be done?"
          onChange={({ target }) => setValue(target.value)}
        />
      </form>
    </header>
  );
}
