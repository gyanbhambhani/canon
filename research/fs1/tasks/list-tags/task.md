# List the catalog's tags

The storefront wants a tag menu.

**Backend:** add `GET /tags`.
- It returns every tag used by at least one product, each once, as a JSON list of strings sorted in ascending order (`["fruit", "heavy", "tool"]`).
- An empty catalog, or one whose products have no tags, gives `[]`.
- A deleted product's tags no longer count.

**Frontend:** add `frontend/src/features/listTags.ts`, exporting

```ts
listTags(baseUrl: string): Promise<Outcome<string[]>>
```

It returns the tags, or the error (see `frontend/src/features/result.ts` for `Outcome`). It never throws.
