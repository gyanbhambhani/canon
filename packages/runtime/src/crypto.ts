/**
 * v0.5: password hashing for hash_password and verify_password, with no dependencies so it runs
 * in Node and the browser. The format is Django's, `pbkdf2_sha256$<iterations>$<salt>$<base64>`,
 * which the generated Python reads and writes with hashlib, so a hash made by either side verifies
 * on the other. The JavaScript runtime (canon run and canon test) uses fewer iterations than the
 * Python backend, because it hashes in pure JavaScript; verification reads the count from the hash.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

function hmac(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256(key) : key;
  const ipad = new Uint8Array(64 + msg.length);
  const opad = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const b = i < k.length ? k[i] : 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  ipad.set(msg, 64);
  opad.set(sha256(ipad), 64);
  return sha256(opad);
}

/** PBKDF2-HMAC-SHA256 with a 32-byte output. */
export function pbkdf2(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const block = new Uint8Array(salt.length + 4);
  block.set(salt);
  block[salt.length + 3] = 1;
  let u = hmac(password, block);
  const t = u.slice();
  for (let i = 1; i < iterations; i++) {
    u = hmac(password, u);
    for (let j = 0; j < 32; j++) t[j] ^= u[j];
  }
  return t;
}

const utf8 = (s: string) => new TextEncoder().encode(s);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

/** Iterations used by the JavaScript runtime (the generated Python uses more). */
export const JS_ITERATIONS = 10_000;
const SALT_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function hashPassword(password: string, random: () => number, iterations = JS_ITERATIONS): string {
  let salt = "";
  for (let i = 0; i < 16; i++) salt += SALT_CHARS[Math.floor(random() * SALT_CHARS.length)];
  return `pbkdf2_sha256$${iterations}$${salt}$${base64(pbkdf2(utf8(password), utf8(salt), iterations))}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const parts = hash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256" || !/^[1-9][0-9]{0,6}$/.test(parts[1])) return false;
  const expected = base64(pbkdf2(utf8(password), utf8(parts[2]), Number(parts[1])));
  // constant-time comparison
  let diff = expected.length ^ parts[3].length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (parts[3].charCodeAt(i) || 0);
  return diff === 0;
}

/** A version-4 UUID from the host's random source (reproducible under the test host). */
export function uuid4(random: () => number): string {
  const b: number[] = [];
  for (let i = 0; i < 16; i++) b.push(Math.floor(random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * is_email: one simple rule with the same meaning in Python (re.fullmatch) and TypeScript. The
 * whitespace class is spelled out, because \s differs between the two.
 */
// eslint-disable-next-line no-control-regex -- vertical tab and form feed are whitespace in Python's \s
export const EMAIL_RE = /^[^@ \t\n\r\x0b\x0c]+@[^@ \t\n\r\x0b\x0c]+\.[^@ \t\n\r\x0b\x0c]+$/;
