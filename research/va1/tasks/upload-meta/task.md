Add an endpoint to register file metadata for an upload: `POST /uploads`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `filename` | string | 1 to 100 characters |
| `size_kb` | integer | from 1 to 10240 inclusive |
| `kind` | string | one of `png`, `jpg`, `pdf` (exactly, lower case) |

Response `200`: the request as sent, `{"filename": ..., "size_kb": ..., "kind": ...}`.

Frontend: add `frontend/src/features/registerUpload.ts` exporting `registerUpload(baseUrl: string, input: { filename: string; size_kb: number; kind: string }): Promise<Outcome<{ filename: string; size_kb: number; kind: string }>>`.
