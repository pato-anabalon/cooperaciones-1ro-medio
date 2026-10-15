import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "cooperation-admin-session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function isAdminPasswordValid(password: string) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  return Boolean(expectedPassword && safeCompare(password, expectedPassword));
}

export function createAdminSession() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${expiresAt}.${randomUUID()}`;
  return {
    value: `${payload}.${sign(payload, secret)}`,
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export function isAdminSessionValid(value: string | undefined) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !value) return false;

  const [expiresAt, nonce, signature] = value.split(".");
  if (!expiresAt || !nonce || !signature) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  return safeCompare(signature, sign(`${expiresAt}.${nonce}`, secret));
}

