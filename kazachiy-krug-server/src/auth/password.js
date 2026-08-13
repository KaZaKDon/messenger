import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEY_LENGTH);
    return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password, encodedHash) {
    const [algorithm, saltHex, keyHex] = String(encodedHash ?? "").split(":");
    if (algorithm !== "scrypt" || !saltHex || !keyHex) return false;

    const expected = Buffer.from(keyHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}