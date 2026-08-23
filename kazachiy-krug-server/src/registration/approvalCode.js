import { randomInt } from "node:crypto";

export const APPROVAL_CODE_MIN = 1_000;
export const APPROVAL_CODE_MAX_EXCLUSIVE = 10_000;

export function createFourDigitApprovalCode(randomIntFn = randomInt) {
    return String(randomIntFn(APPROVAL_CODE_MIN, APPROVAL_CODE_MAX_EXCLUSIVE));
}

export async function allocateUniqueApprovalCode({
    isTaken,
    randomIntFn = randomInt,
    maxAttempts = 30,
}) {
    if (typeof isTaken !== "function") {
        throw new TypeError("isTaken must be a function");
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const code = createFourDigitApprovalCode(randomIntFn);
        if (!(await isTaken(code))) return code;
    }

    throw new Error("Не удалось создать свободный четырёхзначный код заявки");
}
