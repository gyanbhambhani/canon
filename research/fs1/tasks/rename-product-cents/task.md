# Rename a product's `cents` field to `price_cents`

The product field `cents` is renamed `price_cents` everywhere: in request and response bodies (`POST /products`, `GET /products/{sku}`, `GET /products`, `PATCH /products/{sku}/stock`), in the frontend types and in every feature module that sends or reads a product. The behavior does not change: prices, totals, `/prices` and `/average` work as before, and the validation rule now applies to `price_cents` (it must not be negative).

After the change, no request or response uses the name `cents` for a product.
