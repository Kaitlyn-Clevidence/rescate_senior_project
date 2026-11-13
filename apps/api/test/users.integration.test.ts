// Author(s): Isabel Sullivan
// Start date: 2026-11-13
// Last updated: 2026-11-13
// P5: MVP
// Purpose: tests UserRepository against a real MySQL database (issue #12)
// requires RUN_DB_TESTS to be set and migrations 0001-0004 to be run

import { afterAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createUserRepository } from "../src/repositories/UserRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("UserRepository against MySQL", () => {
    const db = createDb(config.db);
    const users = createUserRepository(db);

    const email = `test-${Date.now()}@example.com`;
    const mins = (n: number) => new Date(Date.now() + n * 60_000);
    const hash = (letter: string) => `${letter}${Date.now()}`.padEnd(64, letter);

    //When a user is deleted tokens are deleted
    afterAll(async () => {
        await db.deleteFrom("users").where("email", "like", "test-%@example.com").execute();
        await db.destroy();
    });

    it("creates an invited user who has no password yet", async () => {
        const id = await users.create({ email, role: "provider", language_preferred: "es", invited_by: null });
        const user = await users.findByEmail(email);
        expect(user).toMatchObject({ user_id: id, email, role: "provider", name: null, password_set_at: null });
        expect(user).not.toHaveProperty("password_hash");
    });

    it("refuses a second account with the same email", async () => {
        await expect(
            users.create({ email, role: "provider", language_preferred: "es", invited_by: null })
        ).rejects.toThrow();
    });

    it("lets a setup token be used once only", async () => {
        const user = await users.findByEmail(email);
        const token = hash("a");

        await users.saveToken(user!.user_id, token, "setup", mins(10));
        expect(await users.consumeToken(token, "setup", new Date())).toBe(user!.user_id);
        expect(await users.consumeToken(token, "setup", new Date())).toBeUndefined();
    });

    it("rejects an expired token", async() => {
        const user = await users.findByEmail(email);
        const token = hash("b");
        await users.saveToken(user!.user_id, token, "setup", mins(-1));
        expect(await users.consumeToken(token, "setup", new Date())).toBeUndefined();
    });

    it("rejects a setup token used as a reset token", async ()=> {
        const user = await users.findByEmail(email);
        const token = hash("c");
        await users.saveToken(user!.user_id, token, "setup", mins(10));
        expect(await users.consumeToken(token, "reset", new Date())).toBeUndefined();
    });

    it("rejects a token that wasn't ever saved", async()=> {
        expect(await users.consumeToken(hash("d"), "setup", new Date())).toBeUndefined();
    });

    it("saves the users details when setup is complete", async() => {
        const user = await users.findByEmail(email);
        await users.completeSetup(
            user!.user_id, {name: "Izzy Sullivan", username: null, phone: "+52 622 123 4567", password_hash: "hashed"}, new Date());
        const updated = await users.findByEmail(email);
        expect(updated?.name).toBe("Izzy Sullivan");
        expect(updated?.password_set_at).toBeInstanceOf(Date);
    });
});