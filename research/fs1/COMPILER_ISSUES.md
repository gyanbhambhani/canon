# Compiler issues found while building FS-1

## 1. A long `requires` has no mechanical fix (L001)

`canon fmt` breaks long calls at their brackets, but not a chain of `&&` in a `requires:` clause.
A validation rule over 100 characters is L001 with no patch, and repeating `requires:` does not
help (the clauses are joined into one). An agent's only way out is to shorten names.

Minimal reproduction (`canon check`):

```
type Signup {
  email: String,
  name: String,
  password: String,
  age: Int,
}

api fn signup(input: Signup) -> Bool
  route: POST "/users"
  requires: is_email(input.email) && str_len(trim(input.name)) > 0 && str_len(input.password) >= 8 && input.age >= 13
{
  return true
}
```

gives `L001: line is 117 characters (limit 100); bind a subexpression with let`, which a requires
clause cannot do. FS-1's signup-age reference works around it by naming the parameter `s` and
writing `str_len(s.password) > 7`.

Suggested fix: let the printer break a clause's top-level `&&`/`||` chain one operand per line,
indented under the clause, as it breaks pipelines.

**Fixed on main (2026-11-23):** `canon fmt` now breaks a long `requires:`/`ensures:` chain before each `&&`/`||` (Canon-Py: inside the decorator's parentheses), so the line is no longer L001. The signup-age reference's short parameter name is no longer needed, but it stays as written.
