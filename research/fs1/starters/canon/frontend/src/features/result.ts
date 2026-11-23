/** What every feature function returns, in every arm of FS-1: a value, or an error with a kind. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: { readonly kind: string } };
