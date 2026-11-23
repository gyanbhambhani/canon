import { call, invalid } from "../api/client";
import type { Outcome } from "./result";

export interface RectangleRequest {
  width: number;
  height: number;
  label: string;
}

export interface Rectangle extends RectangleRequest {
  area: number;
}

/** Create a rectangle. */
export async function createRectangle(baseUrl: string, input: RectangleRequest): Promise<Outcome<Rectangle>> {
  if (input.width < 1 || input.height < 1) return invalid("width and height must be at least 1");
  if (input.width * input.height > 10000) return invalid("the area must be at most 10000");
  if ([...input.label].length > 20) return invalid("label must be at most 20 characters");
  return call(baseUrl, "POST", "/rectangles", input);
}
