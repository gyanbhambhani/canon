import { send } from "../api/client";
import type { components } from "../api/schema";
import type { Outcome } from "./result";

type StockRemoval = components["schemas"]["StockRemoval"];
type StockResult = components["schemas"]["StockResult"];

/** Remove stock. The schema carries the bound, the minimum and the enum; the rule over two fields is written here too. */
export async function removeStock(baseUrl: string, input: StockRemoval): Promise<Outcome<StockResult>> {
  return send(baseUrl, "POST", "/inventory/remove", "StockRemoval", input, (i: StockRemoval) => (i.remove > i.on_hand ? "remove must not exceed on_hand" : null));
}
