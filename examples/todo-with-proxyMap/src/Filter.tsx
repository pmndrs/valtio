import cx from "clsx";
import { useFilter, actions, useTodosCount } from "./store";

export function Filter() {
  const count = useTodosCount();
  const activeFilter = useFilter();

  if (!count.active && !count.completed) return null;

  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{count.active}</strong> {`item${count.active > 1 ? "s" : ""}`}{" "}
        left
      </span>
      <ul className="filters">
        <li>
          <button
            onClick={() => actions.toggleFilter("all")}
            className={cx({ selected: activeFilter === "all" })}
          >
            All
          </button>
        </li>{" "}
        <li>
          <button
            onClick={() => actions.toggleFilter("todo")}
            className={cx({
              selected: activeFilter === "todo"
            })}
          >
            Active
          </button>
        </li>{" "}
        <li>
          <button
            onClick={() => actions.toggleFilter("done")}
            className={cx({
              selected: activeFilter === "done"
            })}
          >
            Completed
          </button>
        </li>
      </ul>
    </footer>
  );
}
