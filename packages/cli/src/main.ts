import { VERSION } from "@canon/compiler";

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export async function main(argv: string[], io: CliIO): Promise<number> {
  if (argv[0] === "--version") {
    io.stdout(`canon ${VERSION}\n`);
    return 0;
  }
  io.stderr("usage: canon <check|fmt|run|test> FILE\n");
  return 2;
}
