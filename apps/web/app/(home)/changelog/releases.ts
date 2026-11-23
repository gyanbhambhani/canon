/**
 * What the changelog says about each version's release state, and every Canon sample on the page.
 * test/changelog.test.ts checks each sample with the real compiler and each release claim
 * against the repository.
 */

/**
 * Flip this to true when canon-lang 0.5.0 is published to npm (and the git tag is pushed). It is
 * the only place the page decides whether v0.5 is called released.
 */
export const V05_RELEASED = false;

export interface Release {
  /** the anchor, e.g. "v0-5" */
  id: string;
  /** the language version, as the heading shows it */
  language: string;
  /** the npm package version(s) that carried it */
  npm: string;
  /** the dates of its first and last commits (git log), ISO */
  from: string;
  to: string;
}

export const RELEASES: Release[] = [
  { id: "v0-5", language: "v0.5", npm: V05_RELEASED ? "0.5.0" : "0.5.0, unreleased", from: "2026-11-22", to: "2026-11-23" },
  { id: "v0-4", language: "v0.4", npm: "0.4.0 and 0.4.1", from: "2026-11-22", to: "2026-11-22" },
  { id: "v0-3", language: "v0.3", npm: "0.3.0", from: "2026-11-22", to: "2026-11-22" },
  { id: "v0-2", language: "v0.2", npm: "0.1.x", from: "2026-11-22", to: "2026-11-22" },
  { id: "v0", language: "v0", npm: "0.1.0", from: "2026-11-22", to: "2026-11-22" },
];

/** A Canon sample. `syntax: "py"` is checked as Canon-Py. */
export interface Sample {
  id: string;
  syntax: "brace" | "py";
  code: string;
}

export const SAMPLES: Record<string, Sample> = {
  v0: {
    id: "v0",
    syntax: "brace",
    code: `type Item {
  sku: String,
  qty: Int,
}

fn restock(items: List[Item], need: Int) -> Int
  effects: io
  requires: need >= 0
  ensures: result >= 0
{
  var short = 0
  for item in items {
    if item.qty < need {
      print(item.sku)
      short = short + 1
    }
  }
  return short
}
`,
  },
  v02: {
    id: "v02",
    syntax: "brace",
    code: `fn countdown(n: Int) -> Int {
  var left = n
  var steps = 0
  while left > 0 {
    left = left - 1
    steps = steps + 1
  }
  return steps
}
`,
  },
  v03: {
    id: "v03",
    syntax: "brace",
    code: `fn first_short(words: List[String]) -> Int {
  var at = -1
  for (i, w) in enumerate(words) {
    if str_len(w) < 3 && w != "" {
      at = i
      break
    }
  }
  return at
}
`,
  },
  v04: {
    id: "v04",
    syntax: "brace",
    code: `fn each(xs: List[String], f: fn(String) -> Unit effects: io) -> Unit
  effects: io
{
  for x in xs {
    f(x)
  }
}
`,
  },
  v04py: {
    id: "v04py",
    syntax: "py",
    code: `@effects(io)
def each(xs: list[str], f: Callable[[str], None, io]) -> None:
    for x in xs:
        f(x)
`,
  },
  v05: {
    id: "v05",
    syntax: "brace",
    code: `table todos: Todo key id

type Todo {
  id: Int,
  title: String,
  done: Bool,
}

type NewTodo {
  title: String,
}

api fn create_todo(input: NewTodo) -> Todo
  route: POST "/todos"
  effects: store(todos)
  requires: str_len(trim(input.title)) > 0
{
  let todo = Todo { id: next_id(todos), title: trim(input.title), done: false }
  insert(todos, todo)
  return todo
}
`,
  },
  v05contract: {
    id: "v05contract",
    syntax: "brace",
    code: `type Signup {
  email: String,
  display_name: String,
  password: String,
  age: Int,
}

api fn signup(input: Signup) -> Int
  route: POST "/users"
  requires: is_email(input.email)
    && str_len(trim(input.display_name)) > 0
    && str_len(input.password) >= 12
    && input.age >= 13
{
  return input.age
}
`,
  },
};

/** The generated route for create_todo, copied from tests/v05/golden/todos/expected/backend/canon_generated/api.py. */
export const CREATE_TODO_PYTHON = `@router.post("/todos")
def create_todo(input: NewTodo, todos: Todos) -> Todo:
    require(len(trim(input.title)) > 0, "str_len(trim(input.title)) > 0")
    return logic.create_todo(input, todos)
`;

/** The matching client method, copied from tests/v05/golden/todos/expected/frontend/src/canon/client.ts. */
export const CREATE_TODO_TYPESCRIPT = `async createTodo(input: NewTodo): Promise<Result<Todo, ValidationError | TransportError>> {
  const invalid = validateCreateTodo(input);
  if (invalid) return { ok: false, error: invalid };
  return request(baseUrl, "POST", "/todos", { body: input });
},
`;
