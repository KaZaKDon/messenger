import assert from "node:assert/strict";
import test from "node:test";

import { buildRegistrationView } from "../registrationViewModel.js";

test("admin registration card reads the code from the nested application", () => {
    const view = buildRegistrationView({
        application: { approvalCode: "3345" },
    });

    assert.equal(view.approvalCode, "3345");
});

test("admin registration card builds the applicant name and purpose labels", () => {
    const view = buildRegistrationView({
        application: {
            firstName: "Дмитрий",
            lastName: "Внуков",
            purposes: ["community", "publish_announcements"],
        },
        acceptances: [{}, {}, {}],
    });

    assert.equal(view.fullName, "Внуков Дмитрий");
    assert.deepEqual(view.purposes, ["Общение в сообществе", "Публикация объявлений"]);
    assert.equal(view.acceptanceText, "Приняты все три");
});

test("admin registration card fails safely when the application is incomplete", () => {
    const view = buildRegistrationView({});

    assert.equal(view.approvalCode, "—");
    assert.deepEqual(view.purposes, []);
    assert.equal(view.acceptanceText, "Принято: 0 из 3");
});
