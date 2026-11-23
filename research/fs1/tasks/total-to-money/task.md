# Change an order's total from an integer to money

An order's `total` changes from a number of cents to an amount of money with a currency:

```json
"total": {"cents": 2209, "currency": "USD"}
```

- Every order the API returns (`POST /orders`, `POST /orders/{id}/pay`) has the new `total`. The currency is always `"USD"`; `cents` is computed as before (each line's product price times its quantity, summed).
- Paying charges `total.cents`, so the receipt is still `test-receipt-<cents>` with the fake payment provider.
- `GET /summaries` is unchanged: `spent` stays an integer number of cents. `/customers`, `/orders/open` and `/orders/first` behave as before.

**Frontend:** add a `Money` type (`{cents: number, currency: string}`); the `Order` type's `total` is a `Money`. The feature modules keep their signatures:

```ts
placeOrder(baseUrl: string, email: string, lines: Line[]): Promise<Outcome<Order>>
payOrder(baseUrl: string, orderId: number): Promise<Outcome<Order>>
```
