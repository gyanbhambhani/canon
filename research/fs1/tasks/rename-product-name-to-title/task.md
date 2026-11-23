# Rename a product's `name` field to `title`

The product field `name` is renamed `title` everywhere: in request and response bodies (`POST /products`, `GET /products/{sku}`, `GET /products`, `PATCH /products/{sku}/stock`), in the frontend types and in every feature module that sends or reads a product. `title` is required, as `name` was: a product body without `title` is 422 with `{"error": {"kind": "ValidationError", ...}}`.

Only products change. A user's `name` (in `POST /users`, `POST /login` and the profile they return) stays `name`.

The behavior does not change otherwise: validation, prices, orders, `/prices`, `/average` and the reports work as before. After the change, no request or response uses the name `name` for a product.
