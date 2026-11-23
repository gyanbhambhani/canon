Add an endpoint to rename a project: `POST /projects/rename`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `name` | string | 3 to 40 characters |

Response `200`: the request as sent, `{"name": ...}`.

Frontend: add `frontend/src/features/renameProject.ts` exporting `renameProject(baseUrl: string, input: { name: string }): Promise<Outcome<{ name: string }>>`.
