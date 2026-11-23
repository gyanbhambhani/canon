import { checkProject, generateFastapi } from "@canon/compiler";
import { REFERENCE_CANON } from "../../exp1/src/reference-canon.js";
const ids = process.argv.slice(2);
let ok = 0;
const fails: string[] = [];
for (const id of ids.length ? ids : Object.keys(REFERENCE_CANON)) {
  const p = checkProject([{ name: "main", path: "canon/main.cn", src: REFERENCE_CANON[id] }]);
  try {
    const files = generateFastapi(p);
    if (ids.length) for (const f of files) if (/logic|models/.test(f.path)) console.log("==", f.path, "\n" + f.text);
    ok++;
  } catch (e) {
    fails.push(`${id}: ${(e as Error).message.slice(0, 200)}`);
  }
}
console.log("ok", ok, "fail", fails.length);
console.log(fails.join("\n"));
