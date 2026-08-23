import assert from "node:assert/strict";
import test from "node:test";

import { getUserProfile, updateUserProfile } from "../userProfileService.js";

const USER = { id: "user-1", name: "Казак", phone: "+79990000000", avatar: null };

test("profile is read from persistent storage", async () => {
    const prisma = {
        userProfile: {
            findUnique: async () => ({ settlement: "ст. Вёшенская", occupation: "Пчеловод" }),
        },
    };
    const result = await getUserProfile({ prisma, user: USER });
    assert.equal(result.settlement, "ст. Вёшенская");
    assert.equal(result.occupation, "Пчеловод");
    assert.equal(result.phone, USER.phone);
});

test("profile update trims editable fields and upserts by authenticated user", async () => {
    let operation;
    const prisma = {
        userProfile: {
            upsert: async (input) => {
                operation = input;
                return { ...input.create };
            },
        },
    };
    const result = await updateUserProfile({
        prisma,
        user: USER,
        source: { settlement: "  х. Белогорский ", phone: "+70000000000" },
    });
    assert.deepEqual(operation.create, { userId: USER.id, settlement: "х. Белогорский" });
    assert.deepEqual(operation.update, { settlement: "х. Белогорский" });
    assert.equal(result.phone, USER.phone);
});

test("phone is not an editable profile field", async () => {
    await assert.rejects(
        updateUserProfile({ prisma: {}, user: USER, source: { phone: "+70000000000" } }),
        (error) => error.code === "VALIDATION_ERROR",
    );
});
