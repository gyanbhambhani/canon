from dataclasses import dataclass


@dataclass
class Deposit:
    amount: int


@dataclass
class Withdraw:
    amount: int


type Op = Deposit | Withdraw


@dataclass
class Ok[T]:
    value: T


@dataclass
class Err:
    error: str


type Result[T] = Ok[T] | Err


def apply_ops(balance: int, ops: list[Op]) -> Result[int]:
    for step, op in enumerate(ops, start=1):
        match op:
            case Deposit(amount):
                balance += amount
            case Withdraw(amount):
                if amount > balance:
                    return Err(f"insufficient funds at step {step}")
                balance -= amount
    return Ok(balance)
