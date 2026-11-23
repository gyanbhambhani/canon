import re
from dataclasses import dataclass


@dataclass
class Ok[T]:
    value: T


@dataclass
class Err:
    error: str


type Result[T] = Ok[T] | Err


def rpn(tokens: list[str]) -> Result[int]:
    stack: list[int] = []
    for token in tokens:
        if token in ("+", "-", "*", "/"):
            if len(stack) < 2:
                return Err("stack underflow")
            b = stack.pop()
            a = stack.pop()
            if token == "+":
                stack.append(a + b)
            elif token == "-":
                stack.append(a - b)
            elif token == "*":
                stack.append(a * b)
            else:
                if b == 0:
                    return Err("division by zero")
                stack.append(int(a / b))
        elif re.fullmatch(r"-?[0-9]+", token):
            stack.append(int(token))
        else:
            return Err("bad token: " + token)
    if len(stack) != 1:
        return Err("expected one value")
    return Ok(stack[0])
