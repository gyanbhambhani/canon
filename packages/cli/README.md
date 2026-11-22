# canon-lang

The `canon` command for [Canon](https://github.com/gyanbhambhani/canon), a programming language for AI agents: one way to write every program, effects in every signature, and a compiler that answers with patches.

```bash
npx canon-lang run hello.cn
npm i -g canon-lang && canon check file.cn --json
```

Commands: `check`, `fmt [--write]`, `run [--deny fs,net] [--no-contracts]`, `test`, each with `--json`. Exit codes: 0 success, 1 diagnostics, failed tests or traps, 2 usage error. Node 20 or later. MIT.
