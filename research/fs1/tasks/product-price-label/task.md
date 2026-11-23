# Show a product's price as a label

The shop's product page shows the price as text, like `$19.99`.

**Backend:** add `GET /products/{sku}/label`.
- It returns `{"sku": ..., "name": ..., "price_label": ...}` for the product.
- `price_label` is `$`, the whole dollars, `.`, and the remaining cents as two digits: 105 cents is `"$1.05"`, 5 cents is `"$0.05"`, 0 cents is `"$0.00"`, 123456 cents is `"$1234.56"` (no thousands separators).
- An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.

**Frontend:** add `frontend/src/features/productPriceLabel.ts`, exporting

```ts
productPriceLabel(baseUrl: string, sku: string): Promise<Outcome<PriceLabel>>
```

where a `PriceLabel` is `{ sku: string; name: string; price_label: string }`. It returns the label, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
