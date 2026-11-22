/** Runtime traps: R001 requires · R002 ensures · R003 overflow · R004 division by zero · R005 assert · R006 effect denied. */
export interface Frame {
  fn: string;
  line: number;
  col: number;
}

export interface TrapJson {
  code: string;
  message: string;
  line: number;
  col: number;
  stack: Frame[];
}

export class Trap extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly line: number,
    readonly col: number,
    readonly stack_: Frame[],
  ) {
    super(message);
    this.name = "Trap";
  }

  toJSON(): TrapJson {
    return { code: this.code, message: this.message, line: this.line, col: this.col, stack: this.stack_ };
  }
}

/** Thrown by `try e` on an Err, caught by the enclosing function, which returns the Err. */
export class Early {
  constructor(readonly value: unknown) {}
}
