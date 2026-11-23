import { api, attempt, type Schemas } from "../api/client";
import type { Outcome } from "./result";

/** Set (or replace) a user's default shipping address. */
export async function setDefaultAddress(
  baseUrl: string,
  email: string,
  street: string,
  city: string,
  postcode: string,
): Promise<Outcome<Schemas["Address"]>> {
  return attempt(() =>
    api(baseUrl).PUT("/users/{email}/default-address", {
      params: { path: { email } },
      body: { street, city, postcode },
    }),
  );
}
