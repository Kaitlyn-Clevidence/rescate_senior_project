// Author(s): Isabel Sullivan
// Start date: 2026-11-12
// Last updated: 2026-11-12
// P5: MVP
// Purpose: data layer repository for the users and user_tokens tables;
// saves invited users, finds users by email, and stores and uses up
// single-use setup/reset tokens (issue #12, FR1, FR3, FR4)

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export type Role = "admin" | "provider" | "board" | "trainee";
export type Language = "en" | "es";
export type TokenPurpose = "setup" | "reset";

// What the app will get back about user (never password hash)
export interface User {
    user_id: number;
    email: string;
    name: string | null;
    username: string | null;
    role: Role;
    language_preferred: Language;
    is_active: number;
    password_set_at: Date | null;
}

export interface NewUser {
    email: string;
    role: Role;
    language_preferred: Language;
    invited_by: number | null; //Null for the first account created
}

export interface SetupDetails {
    name: string;
    username: string | null;  //remove field all together??
    phone: string | null;
    password_hash: string;
}

export interface UserRepository {
    findByEmail(email: string): Promise<User | undefined>;
    create(user: NewUser): Promise<number>;
    saveToken(
        userId: number,
        tokenHash: string,
        purpose: TokenPurpose,
        expiresAt: Date
    ): Promise<void>;
    consumeToken(
        tokenHash: string,
        purpose: TokenPurpose,
        now: Date
    ): Promise<number | undefined>;
    completeSetup(userId: number, details: SetupDetails, now: Date): Promise<void>;
}

const userColumns = ["user_id", "email", "name", "username", "role", "language_preferred", "is_active", "password_set_at"] as const;

export function createUserRepository(db: Kysely<Database>): UserRepository {
    return {
        findByEmail: (email: string) =>
            db
                .selectFrom("users")
                .select(userColumns)
                .where("email", "=", email)
                .executeTakeFirst(),
        //Invite from admin: Only email, role, and language are known initially
        create: async (user: NewUser) => {
            const result = await db
                .insertInto("users")
                .values({
                    email: user.email,
                    role: user.role,
                    language_preferred: user.language_preferred,
                    invited_by: user.invited_by
                })
                .executeTakeFirstOrThrow();
            return Number(result.insertId);
        },
        //tokenHash is the SHA-256 hash of the token in link, never token itself
        saveToken: async (userId, tokenHash, purpose, expiresAt) => {
            await db
                .insertInto("user_tokens")
                .values({
                    user_id: userId,
                    token_hash: tokenHash,
                    purpose,
                    expires_at: expiresAt,
                })
                .execute();
        },

        //Marks the token as used, returns its user_id or undefined if token
        //does not exist, was used already, or expired
        //Checks and update happen in 1 statement so two clicks can't both succeed
        consumeToken: async (tokenHash, purpose, now) => {
            const result = await db
                .updateTable("user_tokens")
                .set({ used_at: now })
                .where("token_hash", "=", tokenHash)
                .where("purpose", "=", purpose)
                .where("used_at", "is", null)
                .where("expires_at", ">", now)
                .executeTakeFirst();
            if (Number(result.numUpdatedRows) !== 1) return undefined;

            const token = await db
                .selectFrom("user_tokens")
                .select("user_id")
                .where("token_hash", "=", tokenHash)
                .executeTakeFirst();
            return token?.user_id;
        },

        completeSetup: async (userId, details, now) => {
            await db
                .updateTable("users")
                .set({
                    name: details.name,
                    username: details.username,
                    phone: details.phone,
                    password_hash: details.password_hash,
                    password_set_at: now,
                })
                .where("user_id", "=", userId)
                .execute();
        },
    };
}