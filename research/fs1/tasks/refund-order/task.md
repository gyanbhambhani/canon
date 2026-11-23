# Refund a paid order

Customers can get their money back for an order they have paid.

**Backend:** add `POST /orders/{id}/refund`.
- Only a paid order can be refunded. The backend asks the payment provider for the refund: `POST https://payments.example.com/refund`, whose body is the order's total in cents as decimal text (for example `2209`). The provider answers with a refund id.
- The order's status becomes `{"kind": "Refunded", "refund": "<the provider's answer>"}`; every other field is unchanged. The refunded order is returned, and a later request sees it refunded.
- With the fake payment provider (`SHOP_FAKE_PAYMENTS=1`), every request to the provider is answered with `test-receipt-<body>`: refunding an order whose total is 2209 gives `"refund": "test-receipt-2209"`.
- An unknown order is 400 with `{"error": {"kind": "Missing", "sku": "order <id>"}}`, as for paying.
- An order that is not paid (open, cancelled, or already refunded) is 400 with `{"error": {"kind": "Invalid", "reason": "order <id> is not paid"}}`, and the provider is not called.
- If the provider fails, answer 400 with `{"error": {"kind": "PaymentFailed", "message": ...}}` and leave the order unchanged.
- A refunded order is not open: `GET /orders/open` does not count it.

**Frontend:** add `frontend/src/features/refundOrder.ts`, exporting

```ts
refundOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```

It calls the new endpoint and returns the refunded order, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Order` type, whose status now includes `Refunded`). It never throws.
