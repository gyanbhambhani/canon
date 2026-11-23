/**
 * Print the required Python header (declarations) and signature for seeds, as the WRITE prompt
 * shows them:  npx tsx --conditions=source scripts/py-stub.ts <id>...
 */
import { loadSeed } from "../lib/seed.js";
import { pyDecls, pySignature } from "../lib/types.js";

for (const id of process.argv.slice(2)) {
  const s = loadSeed(id);
  console.log(`# ===== ${id}\n${pyDecls(s)}\n\n${pySignature(s)}\n    ...\n`);
}
