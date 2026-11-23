Add an endpoint to create a rectangle: `POST /rectangles`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `width` | integer | at least 1 |
| `height` | integer | at least 1 |
| `label` | string | at most 20 characters (it may be empty) |

The area `width * height` must be at most 10000.

Response `200`: `{"width": ..., "height": ..., "label": ..., "area": width * height}`.

Frontend: add `frontend/src/features/createRectangle.ts` exporting `createRectangle(baseUrl: string, input: { width: number; height: number; label: string }): Promise<Outcome<{ width: number; height: number; label: string; area: number }>>`.
