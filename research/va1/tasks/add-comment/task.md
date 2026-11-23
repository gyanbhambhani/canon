Add an endpoint to add a comment: `POST /comments`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `body` | string | not blank, at most 500 characters |

Response `200`: the comment, `{"body": ...}`, with the value as sent.

Frontend: add `frontend/src/features/addComment.ts` exporting `addComment(baseUrl: string, input: { body: string }): Promise<Outcome<{ body: string }>>`.
