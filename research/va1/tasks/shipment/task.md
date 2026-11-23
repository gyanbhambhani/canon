Add an endpoint to create a shipment: `POST /shipments`.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `weight_g` | integer | from 1 to 30000 inclusive |
| `length` | integer | from 1 to 200 inclusive (cm) |
| `width` | integer | from 1 to 100 inclusive (cm) |
| `height` | integer | from 1 to 100 inclusive (cm) |

The size limit: `length + 2 * (width + height)` is at most 300.

Response `200`: the request body unchanged, `{"weight_g": ..., "length": ..., "width": ..., "height": ...}`.

Frontend: add `frontend/src/features/createShipment.ts` exporting `createShipment(baseUrl: string, input: { weight_g: number; length: number; width: number; height: number }): Promise<Outcome<{ weight_g: number; length: number; width: number; height: number }>>`.
