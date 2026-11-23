Add an endpoint to create a tag: `POST /tags`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `label` | string | 2 to 20 characters |
| `color` | string | one of `red`, `green`, `blue`, `gray` (exactly, lower case) |

Response `200`: the request as sent, `{"label": ..., "color": ...}`.

Frontend: add `frontend/src/features/createTag.ts` exporting `createTag(baseUrl: string, input: { label: string; color: string }): Promise<Outcome<{ label: string; color: string }>>`.
