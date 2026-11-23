import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type RectangleRequest = components["schemas"]["RectangleRequest"];
type Rectangle = components["schemas"]["Rectangle"];

/** Create a rectangle. The schema carries the single-field rules; the area rule is written here too. */
export async function createRectangle(baseUrl: string, input: RectangleRequest): Promise<Outcome<Rectangle>> {
  return send(baseUrl, "POST", "/rectangles", "RectangleRequest", input, (i: RectangleRequest) => {
    if (i.width * i.height > 10000) return "the area must be at most 10000";
    return null;
  });
}
