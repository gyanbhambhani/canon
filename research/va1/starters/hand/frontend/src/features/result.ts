/** What every feature function returns, in every arm of VA-1: a value, or an error with a kind. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: { readonly kind: string; readonly rule?: string; readonly message?: string } };
