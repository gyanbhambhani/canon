# Count the products per tag

The storefront's tag menu should show how many products each tag has.

**Backend:** add `GET /tags/counts`.
- It returns one row per tag used by at least one product, shaped `{"tag": ..., "count": ...}`, where `count` is the number of products that have the tag. A product that lists the same tag twice counts once.
- Rows are sorted by `tag`, ascending.
- An empty catalog, or one whose products have no tags, gives `[]`.

**Frontend:** add `frontend/src/features/productCountByTag.ts`, exporting

```ts
productCountByTag(baseUrl: string): Promise<Outcome<TagCount[]>>
```

where `TagCount` is `{ tag: string; count: number }`. It returns the rows, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
