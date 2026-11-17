// Author(s): Isabel Sullivan
// Start date: 2026-11-14
// Last updated: 2026-11-14
// P5: MVP
// Purpose: account setup by admin invite (issue #12, FR3, FR4); creates
// invited users, sends single-use setup links, and finishes setup by
// checking the link and saving the hashed password

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Language, Role, UserRepository } from "../repositories/UserRepository.js";
import type { MailService } from "./MailService.js";

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_BYTES = 72;

const BCRYPT_COST = 12;

export interface AccountOptions {
    appUrl: string; //where the web app runs
    setupLinkMinutes: number; //how long a setup link works
    now?: () => Date; //the clock; fake one passed by tests
}

export interface InviteRequest {
    email: string;
    role: Role;
    language: Language;
}

export type InviteResult = | { ok: true; userId: number; resent: boolean }
    | { ok: false, error: "email_taken" };

export interface SetupRequest {
    token: string;
    name: string;
    username: string | null;
    phone: string | null;
    password: string;
}

export type SetupResult = | { ok: true } | { ok: false; error: "weak_password" | "invalid_or_expired_link" };

export interface AccountService {
    invite(invitedBy: number | null, request: InviteRequest): Promise<InviteResult>;
    completeSetup(request: SetupRequest): Promise<SetupResult>;
}

export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export function createAccountService(
    users: UserRepository,
    mail: MailService,
    options: AccountOptions
): AccountService {
    const now = options.now ?? (() => new Date());

    async function sendSetupLink(userId: number, email: string, language: Language) {
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(now().getTime() + options.setupLinkMinutes * 60_000);
        await users.saveToken(userId, hashToken(token), "setup", expiresAt);

        const link = `${options.appUrl}/setup?token=${token}`;
        await mail.sendSetup(email, link, language, options.setupLinkMinutes);

    }
    return {
        async invite(invitedBy, request) {
            const email = request.email.trim().toLowerCase();
            const existing = await users.findByEmail(email);

            //If user already finished setup: refuse
            if (existing?.password_set_at) return { ok: false, error: "email_taken" };

            //Invited but never finished setup
            if (existing) {
                await sendSetupLink(existing.user_id, email, existing.language_preferred);
                return {
                    ok: true, userId: existing.user_id, resent: true
                }
            }
            const userId = await users.create({ email, role: request.role, language_preferred: request.language, invited_by: invitedBy });
            await sendSetupLink(userId, email, request.language);
            return { ok: true, userId, resent: false };
        },

        async completeSetup(request) {
            const bytes = Buffer.byteLength(request.password, "utf8");
            if (request.password.length < MIN_PASSWORD_LENGTH || bytes > MAX_PASSWORD_BYTES) {
                return { ok: false, error: "weak_password" };
            }

            const userId = await users.consumeToken(hashToken(request.token), "setup", now());
            if (userId === undefined) {
                return { ok: false, error: "invalid_or_expired_link" };
            }
            const passwordHash = await bcrypt.hash(request.password, BCRYPT_COST);
            await users.completeSetup(userId, { name: request.name.trim(), username: request.username?.trim() || null, phone: request.phone?.trim() || null, password_hash: passwordHash, }, now());
            return { ok: true };
        },
    }
};

