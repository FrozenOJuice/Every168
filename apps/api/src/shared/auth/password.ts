import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// The version identifies this fixed work factor.
const prefix = "scrypt-v1$";
const current = { N: 65536, r: 8, p: 2 };
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      64,
      { ...current, maxmem: 128 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `${prefix}${salt}:${key.toString("hex")}`;
}
export async function verifyPassword({
  hash,
  password,
}: {
  hash: string;
  password: string;
}) {
  const payload = hash.startsWith(prefix) ? hash.slice(prefix.length) : "";
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(payload) || password.length > 128)
    return false;
  const [salt, target] = payload.split(":") as [string, string];
  return timingSafeEqual(
    Buffer.from(target, "hex"),
    await derive(password, salt),
  );
}
