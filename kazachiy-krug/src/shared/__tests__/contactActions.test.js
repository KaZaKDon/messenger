import test from "node:test";
import assert from "node:assert/strict";
import { buildContactChatPath, filterContacts } from "../contactActions.js";

test("contact actions open chat, audio call and video call", () => {
    assert.equal(buildContactChatPath("user-2"), "/chat?user=user-2");
    assert.equal(buildContactChatPath("user-2", "audio"), "/chat?user=user-2&call=audio");
    assert.equal(buildContactChatPath("user-2", "video"), "/chat?user=user-2&call=video");
});

test("contact search checks only public nickname and phone", () => {
    const contacts = [
        { id: "secret-id", name: "Дима", phone: "+79381532981" },
        { id: "user-3", name: "Казак", phone: "+79515220669" },
    ];
    assert.deepEqual(filterContacts(contacts, "Дим"), [contacts[0]]);
    assert.deepEqual(filterContacts(contacts, "32981"), [contacts[0]]);
    assert.deepEqual(filterContacts(contacts, "secret-id"), []);
});
