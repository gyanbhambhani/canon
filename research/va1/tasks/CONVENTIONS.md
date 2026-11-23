Conventions for every VA-1 task (the arm-neutral contract):

- The service has no database. Each task adds one endpoint and one frontend feature module.
- A request that breaks any validation rule is answered `422` with `{"error": {"kind": "ValidationError", ...}}`. A valid request is answered `200` with the JSON the task describes. No other status is used.
- The frontend feature takes `baseUrl` first, then the request body as one object, and returns `Promise<Outcome<T>>` (see `frontend/src/features/result.ts`). It never throws.
- Validation runs on both sides. The feature must reject an invalid input **before sending any request**, returning `{ ok: false, error: { kind: "ValidationError" } }`, and must never reject an input the server accepts. The client and the server must agree on every input.
- A string's length is its number of Unicode code points (an emoji is one character). "Blank" means empty or only spaces, tabs, carriage returns and line feeds. Integers are whole numbers below 2^53.
- Numbers in the request are JSON numbers of the type the task states. Only values of the stated types are sent.
