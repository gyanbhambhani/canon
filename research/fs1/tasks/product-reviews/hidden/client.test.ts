import type { ClientTest } from "../../../harness/client-api";

type Review = { id: number; sku: string; rating: number; text: string };

async function product(t: Parameters<ClientTest["run"]>[0]): Promise<string> {
  const { addProduct } = await t.feature("addProduct");
  const sku = t.unique("sku");
  t.ok(await addProduct(t.baseUrl, { sku, name: "Kettle", cents: 2500, stock: 4, tags: [] }));
  return sku;
}

export const tests: ClientTest[] = [
  {
    id: "addReview-probe",
    tags: ["probe"],
    async run(t) {
      const sku = await product(t);
      const { addReview } = await t.feature("addReview");
      const review = t.ok<Review>(await addReview(t.baseUrl, sku, 4, " Boils fast "));
      t.equal({ ...review, id: 0 }, { id: 0, sku, rating: 4, text: " Boils fast " });
      t.equal(typeof review.id, "number");
      t.equal((await t.http("GET", `/products/${sku}/reviews`)).body, [review], "the server stored what the client sent");
    },
  },
  {
    id: "listReviews-probe",
    tags: ["probe"],
    async run(t) {
      const sku = await product(t);
      const { listReviews } = await t.feature("listReviews");
      t.equal(t.ok(await listReviews(t.baseUrl, sku)), []);
      const first = (await t.http("POST", `/products/${sku}/reviews`, { rating: 5, text: "Great" })).body as Review;
      const second = (await t.http("POST", `/products/${sku}/reviews`, { rating: 2, text: "Loud" })).body as Review;
      const reviews = t.ok<Review[]>(await listReviews(t.baseUrl, sku));
      t.equal(reviews, [first, second]);
      t.equal(reviews, (await t.http("GET", `/products/${sku}/reviews`)).body, "client parses what the server returns");
    },
  },
  {
    id: "reviews-errors",
    tags: [],
    async run(t) {
      const sku = await product(t);
      const { addReview } = await t.feature("addReview");
      const { listReviews } = await t.feature("listReviews");
      t.fails(await addReview(t.baseUrl, sku, 0, "fine"), "ValidationError");
      t.fails(await addReview(t.baseUrl, sku, 6, "fine"), "ValidationError");
      t.fails(await addReview(t.baseUrl, sku, 3, "   "), "ValidationError");
      t.fails(await addReview(t.baseUrl, sku, 3, "x".repeat(501)), "ValidationError");
      const none = t.unique("none");
      t.equal(t.fails(await addReview(t.baseUrl, none, 3, "fine"), "Missing").sku, none);
      t.equal(t.fails(await listReviews(t.baseUrl, none), "Missing").sku, none);
    },
  },
];
