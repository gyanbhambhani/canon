# Show related products

A product page should suggest products that share its tags.

**Backend:** add `GET /products/{sku}/related`.
- It returns every *other* product that shares at least one tag with the product `sku`, as full product objects. The product itself is never included.
- Products sharing more distinct tags come first; products sharing the same number of tags are sorted by `sku`. A tag listed twice by either product counts once.
- A product without tags, or with no product sharing its tags, gives `[]`.
- An unknown product is 400 with `{"error": {"kind": "Missing", "sku": "<sku>"}}`.

**Frontend:** add `frontend/src/features/relatedProducts.ts`, exporting

```ts
relatedProducts(baseUrl: string, sku: string): Promise<Outcome<Product[]>>
```

It returns the related products, or the error (see `frontend/src/features/result.ts` for `Outcome`; use the project's `Product` type). It never throws.
