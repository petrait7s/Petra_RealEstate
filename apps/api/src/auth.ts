import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { meta, setMeta } from "./store.js";
import type { Claims } from "./tenant.js";

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function secret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  let v = meta("jwt_secret");
  if (!v) { v = randomBytes(32).toString("hex"); setMeta("jwt_secret", v); }
  return v;
}

export function signToken(c: Omit<Claims, "exp">, ttlSec = 60 * 60 * 12): string {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...c, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = createHmac("sha256", secret()).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyToken(tok: string): Claims | undefined {
  const [head, body, sig] = tok.split(".");
  if (!head || !body || !sig) return;
  const want = createHmac("sha256", secret()).update(`${head}.${body}`).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as Claims;
    return c.exp > Date.now() / 1000 ? c : undefined;
  } catch { return; }
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
}
export function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(pw, Buffer.from(salt, "hex"), 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
