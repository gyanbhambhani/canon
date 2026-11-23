from __future__ import annotations
from typing import Callable, Generic, Literal, TypedDict, TypeVar

T = TypeVar("T")

class Ok(TypedDict, Generic[T]):
    ok: Literal[True]
    value: T

class Err(TypedDict):
    ok: Literal[False]
    error: str

class Push(TypedDict):
    kind: Literal["Push"]
    n: int

class Pop(TypedDict):
    kind: Literal["Pop"]

class Add(TypedDict):
    kind: Literal["Add"]

class Sub(TypedDict):
    kind: Literal["Sub"]

class Mul(TypedDict):
    kind: Literal["Mul"]

class Div(TypedDict):
    kind: Literal["Div"]

class Mod(TypedDict):
    kind: Literal["Mod"]

class Dup(TypedDict):
    kind: Literal["Dup"]

class Swap(TypedDict):
    kind: Literal["Swap"]

class Jz(TypedDict):
    kind: Literal["Jz"]
    target: int

class Jmp(TypedDict):
    kind: Literal["Jmp"]
    target: int

class Print(TypedDict):
    kind: Literal["Print"]

class Halt(TypedDict):
    kind: Literal["Halt"]

Instr = Push | Pop | Add | Sub | Mul | Div | Mod | Dup | Swap | Jz | Jmp | Print | Halt


STEP_LIMIT = 1000

STACK_NEEDS: dict[str, int] = {
    "Pop": 1, "Dup": 1, "Print": 1, "Jz": 1,
    "Add": 2, "Sub": 2, "Mul": 2, "Div": 2, "Mod": 2, "Swap": 2,
}


def _trunc_div(a: int, b: int) -> int:
    """Integer division truncated toward zero (Python's // floors)."""
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


BINARY_OPS: dict[str, Callable[[int, int], int]] = {
    "Add": lambda a, b: a + b,
    "Sub": lambda a, b: a - b,
    "Mul": lambda a, b: a * b,
    "Div": _trunc_div,
    "Mod": lambda a, b: a - b * _trunc_div(a, b),
}


def stack_vm(prog: list[Instr]) -> Ok[list[int]] | Err:
    """Execute a stack-machine program and return the values it prints."""
    stack: list[int] = []
    output: list[int] = []
    pc = 0
    steps = 0
    while 0 <= pc < len(prog):
        if steps == STEP_LIMIT:
            return {"ok": False, "error": "step limit exceeded"}
        steps += 1

        instr = prog[pc]
        kind = instr["kind"]
        if len(stack) < STACK_NEEDS.get(kind, 0):
            return {"ok": False, "error": f"stack underflow at {pc}"}

        next_pc = pc + 1
        if instr["kind"] == "Push":
            stack.append(instr["n"])
        elif instr["kind"] == "Pop":
            stack.pop()
        elif instr["kind"] in BINARY_OPS:
            b = stack.pop()
            a = stack.pop()
            if b == 0 and instr["kind"] in ("Div", "Mod"):
                return {"ok": False, "error": f"division by zero at {pc}"}
            stack.append(BINARY_OPS[instr["kind"]](a, b))
        elif instr["kind"] == "Dup":
            stack.append(stack[-1])
        elif instr["kind"] == "Swap":
            stack[-1], stack[-2] = stack[-2], stack[-1]
        elif instr["kind"] == "Print":
            output.append(stack.pop())
        elif instr["kind"] == "Jz" or instr["kind"] == "Jmp":
            target = instr["target"]
            if not 0 <= target < len(prog):
                return {"ok": False, "error": f"bad jump at {pc}"}
            if instr["kind"] == "Jmp" or stack.pop() == 0:
                next_pc = target
        elif instr["kind"] == "Halt":
            break
        pc = next_pc
    return {"ok": True, "value": output}
