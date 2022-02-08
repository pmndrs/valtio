import { AddTodoInput } from "./AddTodoInput";
import { TodoList } from "./TodoList";
import { Filter } from "./Filter";

import "./styles.css";

function App() {
  return (
    <div className="todoapp">
      <AddTodoInput />
      <TodoList />
      <Filter />
    </div>
  );
}

export default App;
