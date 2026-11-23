Add an endpoint to apply a coupon to an order: `POST /coupons/apply`. Amounts are whole cents.

Request body (JSON):

| field | type | rule |
| --- | --- | --- |
| `code` | string | 3 to 20 characters |
| `subtotal` | integer | at least 1 |
| `discount` | integer | at least 0, and at most `subtotal` |

Response `200`: `{"code": ..., "subtotal": ..., "discount": ..., "payable": subtotal - discount}`.

Frontend: add `frontend/src/features/applyCoupon.ts` exporting `applyCoupon(baseUrl: string, input: { code: string; subtotal: number; discount: number }): Promise<Outcome<{ code: string; subtotal: number; discount: number; payable: number }>>`.
