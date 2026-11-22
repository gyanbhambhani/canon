/** Encode editor contents into the URL hash (base64url of UTF-8) and back. */
export function encodeSource(src: string): string {
  const bytes = new TextEncoder().encode(src);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSource(hash: string): string | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/^code=/, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!b64) return null;
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export const playHref = (src: string) => `/play#code=${encodeSource(src)}`;
