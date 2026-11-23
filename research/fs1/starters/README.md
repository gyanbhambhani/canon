# FS-1 starters: one shop, three ways

- `direct/`: a hand-written FastAPI backend (`backend/main.py`, `backend/shop/`) and a hand-written
  TypeScript client (`frontend/src/api/`).
- `openapi/`: the same backend; the frontend's API types are generated from the backend's OpenAPI
  schema with `node generate-client.mjs` (openapi-typescript), and called with openapi-fetch.
- `canon/`: Canon sources in `canon/`; `canon build` generates `backend/canon_generated/` and
  `frontend/src/canon/`.

All three keep one contract:
- `backend/main.py` exposes `app` and `reset_database()`. The database is `$SHOP_DATABASE` (default
  shop.db). `SHOP_FAKE_PAYMENTS=1` replaces payments.example.com with a fake that answers
  `test-receipt-<amount>`.
- Error bodies are `{"error": {"kind": ...}}`: 400 for domain errors, 422 `ValidationError` for
  invalid input, 500 `InternalError`.
- Feature modules: `frontend/src/features/<name>.ts`, taking `baseUrl` first and returning
  `Promise<Outcome<T>>` (`frontend/src/features/result.ts`); they never throw.

The starters pass the regression suite (harness/regression) and their own checks.
