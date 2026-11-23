# Split paying into authorize and capture

The payment provider now works in two steps: an amount is first authorized (held), and later captured (taken). Replace the single pay endpoint with one endpoint per step.

**Backend:** remove `POST /orders/{id}/pay` (afterwards it no longer exists: 404 or 405). Add:
- `POST /orders/{id}/authorize`. Only an open order can be authorized. The backend calls the provider, `POST https://payments.example.com/authorize`, whose body is the order's total in cents as decimal text (for example `2209`); the provider answers with an authorization id. The order's status becomes `{"kind": "Authorized", "authorization": "<the provider's answer>"}`. Any other order is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not open"}}`.
- `POST /orders/{id}/capture`. Only an authorized order can be captured. The backend calls `POST https://payments.example.com/capture`, again with the total in cents as the body; the provider answers with a receipt. The order's status becomes `{"kind": "Paid", "receipt": "<the provider's answer>"}`. Any other order is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not authorized"}}`.
- Both return the updated order (every other field unchanged). An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}` for both. If the provider fails, answer 400 with `{"error": {"kind": "PaymentFailed", "message": ...}}` and leave the order unchanged.
- With the fake payment provider (`SHOP_FAKE_PAYMENTS=1`), every request to the provider is answered with `test-receipt-<body>`: for a total of 2209, the authorization is `"test-receipt-2209"` and so is the receipt.
- An authorized order is no longer open: `GET /orders/open` counts only open orders.
- Placing orders is unchanged.

**Frontend:** remove `frontend/src/features/payOrder.ts`. Add `frontend/src/features/authorizeOrder.ts` and `frontend/src/features/captureOrder.ts`, exporting

```ts
authorizeOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
captureOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

Each calls its endpoint and returns the updated order, or the error (see `frontend/src/features/result.ts` for `Outcome`; the project's `Order` status now includes `Authorized`). They never throw.
