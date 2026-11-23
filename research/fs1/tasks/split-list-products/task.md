# Split the product list into two endpoints

`GET /products` does two jobs today: it lists the whole catalog, or, with `tag`, only the products with that tag. Split it in two.

**Backend:**
- `GET /products?page=<page>&per_page=<per_page>` lists the whole catalog. It no longer takes a `tag` parameter.
- New: `GET /tags/{tag}/products?page=<page>&per_page=<per_page>` lists only the products whose `tags` contain `{tag}` (an exact match). A tag no product has gives an empty list.
- Both return full product objects sorted by `sku`, one page at a time (page 1 is the first `per_page` products; a page past the end is an empty list), exactly as `GET /products` does today.
- Both keep today's validation: `page` is at least 1, and `per_page` is between 1 and 50. Anything else is 422 with `{"error": {"kind": "ValidationError", ...}}`.

**Frontend:** `frontend/src/features/listProducts.ts` loses its `tag` parameter, and a new module `frontend/src/features/listTaggedProducts.ts` lists one tag:

```ts
listProducts(baseUrl: string, page: number, perPage: number): Promise<Outcome<Product[]>>
listTaggedProducts(baseUrl: string, tag: string, page: number, perPage: number): Promise<Outcome<Product[]>>
```

Both return the page, or the error (see `frontend/src/features/result.ts` for `Outcome`). They never throw.
