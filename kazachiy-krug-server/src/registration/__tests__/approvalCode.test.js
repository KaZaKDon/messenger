import assert from "node:assert/strict";
import test from "node:test";

import {
    allocateUniqueApprovalCode,
    APPROVAL_CODE_MAX_EXCLUSIVE,
    APPROVAL_CODE_MIN,
    createFourDigitApprovalCode,
} from "../approvalCode.js";

test("approval code generator always requests a four-digit range", () => {
    const code = createFourDigitApprovalCode((min, max) => {
        assert.equal(min, APPROVAL_CODE_MIN);
        assert.equal(max, APPROVAL_CODE_MAX_EXCLUSIVE);
        return 4827;
    });

    assert.equal(code, "4827");
});

test("approval code allocator retries a collision", async () => {
    const candidates = [4827, 7314];
    const code = await allocateUniqueApprovalCode({
        randomIntFn: () => candidates.shift(),
        isTaken: async (candidate) => candidate === "4827",
    });

    assert.equal(code, "7314");
});

test("approval code allocator fails closed after repeated collisions", async () => {
    await assert.rejects(
        allocateUniqueApprovalCode({
            randomIntFn: () => 4827,
            isTaken: async () => true,
            maxAttempts: 2,
        }),
        /Не удалось создать свободный/,
    );
});
