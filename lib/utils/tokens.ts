import "server-only";
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 48;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
