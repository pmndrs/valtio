import { useEffect, useRef, useState } from "react";
import cx from "clsx";

import { actions, Todo } from "./store";

export function TodoItem({ todo }: { todo: Todo }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      const node = inputRef.current;
      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    } else if (inputRef.current) {
      const node = inputRef.current;
      node.blur();
    }
  }, [isEditing]);

  const handleCheckBoxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    actions.toggleTodo(todo.id, event.target.checked);
  };

  const handleDelete = () => {
    actions.removeTodo(todo.id);
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditText(e.target.value);
  };

  const handleKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(todo.name);
    } else if (e.key === "Enter" && editText.trim().length > 0) {
      setIsEditing(false);
      actions.updateTodo(todo.id, editText);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editText.trim().length > 0) {
      actions.updateTodo(todo.id, editText);
    }
  };

  return (
    <li className={cx({ completed: todo.completed, editing: isEditing })}>
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          checked={todo.completed}
          onChange={handleCheckBoxChange}
        />
        <label onDoubleClick={handleDoubleClick}>{todo.name}</label>
        <button className="destroy" onClick={handleDelete} />
      </div>
      <input
        ref={inputRef}
        className="edit"
        value={editText}
        onChange={handleEdit}
        onKeyDown={handleKeydown}
        onBlur={handleBlur}
      />
    </li>
  );
}
