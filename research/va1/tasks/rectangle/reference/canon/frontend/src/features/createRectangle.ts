import { createClient } from "../canon/client";
import type { Rectangle, RectangleRequest } from "../canon/types";
import type { Outcome } from "./result";

/** Create a rectangle. */
export async function createRectangle(baseUrl: string, input: RectangleRequest): Promise<Outcome<Rectangle>> {
  return createClient(baseUrl).createRectangle(input);
}
