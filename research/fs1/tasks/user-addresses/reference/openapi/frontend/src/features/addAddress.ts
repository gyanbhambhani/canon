import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Save a new address for a user. */
export async function addAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Schemas["Address"]>> {
  return attempt(() =>
    api(baseUrl).POST("/users/{email}/addresses", {
      params: { path: { email } },
      body: { street, city, postcode },
    }),
  );
}
