import { useCallback, useEffect, useState } from "react";
import { createClient } from "./canon/client";
import type { TransportError, ValidationError } from "./canon/runtime";
import type { Todo, TodoError } from "./canon/types";

const api = createClient("/api");
const PER_PAGE = 5;

/** One message for every error the generated client can return. */
function describe(error: TodoError | ValidationError | TransportError): string {
  switch (error.kind) {
    case "NotFound":
      return `Todo ${error.id} no longer exists.`;
    case "ValidationError":
      return `Not allowed: ${error.rule}`;
    case "TransportError":
      return `The server could not be reached (${error.message}).`;
  }
}

export function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.listTodos(page, PER_PAGE);
    if (result.ok) setTodos(result.value);
    else setError(describe(result.error));
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const result = await api.createTodo({ title });
    if (!result.ok) {
      setError(describe(result.error));
      return;
    }
    setError(null);
    setTitle("");
    await load();
  }

  async function complete(id: number) {
    const result = await api.completeTodo(id);
    if (!result.ok) setError(describe(result.error));
    await load();
  }

  return (
    <main>
      <h1>Todos</h1>
      <form onSubmit={add}>
        <input aria-label="New todo" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span style={{ textDecoration: todo.done ? "line-through" : "none" }}>{todo.title}</span>{" "}
            {!todo.done && <button onClick={() => void complete(todo.id)}>Done</button>}
          </li>
        ))}
      </ul>
      <nav>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span> Page {page} </span>
        <button disabled={todos.length < PER_PAGE} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    </main>
  );
}
