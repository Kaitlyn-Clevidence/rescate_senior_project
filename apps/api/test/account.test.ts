// Author(s): Isabel Sullivan
// Start date: 2026-11-14
// Last updated: 2026-11-16
// P5: MVP
// Purpose: tests AccountService with an in-memory user store and a fake
// mail service, so no database or email is needed (issue #12)

import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import type {NewUser, SetupDetails, TokenPurpose, User, UserRepository} from "../src/repositories/UserRepository.js";
import type { Language, MailService } from "../src/services/MailService.js";
import {createAccountService, hashToken } from "../src/services/AccountService.js";


interface StoredToken {userId: number; tokenHash: string; purpose: TokenPurpose; expiresAt: Date; usedAt: Date | null;}

interface SentMail {to: string; link: string; language: Language; minutes: number;}

// Fake UserRepository: keeps users and tokens in lists but follows the same rules as the real one
function makeUsers(){
    const users: (User & {password_hash: string|null; invited_by: number |null})[]=[];
    const tokens: StoredToken[]=[];

    const repo: UserRepository = {
        findByEmail: async(email)=> {
            const user = users.find((u)=>u.email === email);
            if(!user) {
                return undefined;
            }
            const {password_hash: _hash, invited_by: _by, ...visible} = user;
            return visible;
        },
        create: async (user: NewUser)=>{
            const id = users.length + 1;
            users.push({user_id:id, email: user.email, name: null, username: null, role: user.role, language_preferred: user.language_preferred, 
                        is_active: 1, password_set_at: null, password_hash: null, invited_by: user.invited_by,});
            return id;
        },
        saveToken: async(userId, tokenHash, purpose, expiresAt) => {
            tokens.push({userId, tokenHash, purpose, expiresAt, usedAt: null});
        },
        consumeToken: async(tokenHash, purpose, now)=>{
            const token = tokens.find((t)=>t.tokenHash === tokenHash && t.purpose === purpose && t.usedAt === null && t.expiresAt > now);
            if(!token) {
                return undefined;
            }
            token.usedAt = now;
            return token.userId;
        },
        completeSetup: async (userId, details: SetupDetails, now) => {
            const user = users.find((u) => u.user_id === userId)!;
            user.name = details.name;
            user.username = details.username;
            user.password_hash = details.password_hash;
            user.password_set_at = now;
        },
    };
    return {repo, users, tokens};
}

//Fake mailservice, doesn't send each email just records it
function makeMail(){
    const sent: SentMail[]=[];
    const mail: MailService = {
        sendSetup: async(to, link, language, minutes)=> {
            sent.push({to, link, language, minutes});
        },
        sendReset: async () => {}
    };
    return {mail, sent};
}

function setup(){
    let clock = new Date("2026-11-16T12:00:00Z");
    const {repo, users, tokens} = makeUsers();
    const {mail, sent} = makeMail();
    const accounts = createAccountService(repo, mail, {appUrl: "http://localhost:5173", setupLinkMinutes: 10, now: ()=>clock,});

    const advanceMinutes = (n: number)=> {
        clock = new Date(clock.getTime()+n*60_000);
    };
    const tokenFrom = (link: string) => new URL(link).searchParams.get("token")!;
    return {accounts, users, tokens, sent, advanceMinutes, tokenFrom};
}

const invite = {email: "provider@example.com", role: "provider" as const, language: "es" as const };
const goodPassword = "Rescate is the best";

describe("AccountService.invite", () => {
  it("creates the user and emails a setup link in their language", async () => {
    const { accounts, users, sent } = setup();
    const result = await accounts.invite(1, invite);

    expect(result).toEqual({ ok: true, userId: 1, resent: false });
    expect(users[0]).toMatchObject({ email: "provider@example.com", role: "provider", invited_by: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "provider@example.com", language: "es", minutes: 10 });
    expect(sent[0].link).toMatch(/^http:\/\/localhost:5173\/setup\?token=/);
  });

  it("stores only the hash of the token, never the token in the link", async () => {
    const { accounts, tokens, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    const token = tokenFrom(sent[0].link);

    expect(tokens[0].tokenHash).not.toBe(token);
    expect(tokens[0].tokenHash).toBe(hashToken(token));
  });

  it("makes the setup link expire after the set number of minutes", async () => {
    const { accounts, tokens } = setup();
    await accounts.invite(1, invite);

    expect(tokens[0].expiresAt).toEqual(new Date("2026-11-16T12:10:00Z"));
  });

  it("saves the email trimmed and in lowercase", async () => {
    const { accounts, users } = setup();
    await accounts.invite(1, { ...invite, email: "  provider@Example.COM " });

    expect(users[0].email).toBe("provider@example.com");
  });

  it("refuses an email that already has an active account", async () => {
    const { accounts, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    await accounts.completeSetup({token: tokenFrom(sent[0].link), name: "Izzy Sullivan", username: null, phone: null, password: goodPassword,});    
    const result = await accounts.invite(1, invite);

    expect(result).toEqual({ ok: false, error: "email_taken" });
    expect(sent).toHaveLength(1); // no second email
  });

  it("sends a new link, without a new user, if the invite was never finished", async () => {
    const { accounts, users, sent } = setup();
    await accounts.invite(1, invite);
    const result = await accounts.invite(1, invite);

    expect(result).toEqual({ ok: true, userId: 1, resent: true });
    expect(users).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(sent[1].link).not.toBe(sent[0].link);
  });
});

describe("AccountService.completeSetup", () => {
  it("saves the details and a bcrypt hash of the password", async () => {
    const { accounts, users, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    const result = await accounts.completeSetup({token: tokenFrom(sent[0].link), name: " Izzy Sullivan ", username: null, phone: null, password: goodPassword,});
    
    expect(result).toEqual({ ok: true });
    expect(users[0].name).toBe("Izzy Sullivan");
    expect(users[0].password_set_at).toBeInstanceOf(Date);
    expect(users[0].password_hash).not.toBe(goodPassword);
    expect(await bcrypt.compare(goodPassword, users[0].password_hash!)).toBe(true);
  });

  it("refuses the same link a second time", async () => {
    const { accounts, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    const request = {token: tokenFrom(sent[0].link), name: "Izzy Sullivan", username: null, phone: null, password: goodPassword,};
    await accounts.completeSetup(request);
    const secondRequest = await accounts.completeSetup(request);

    expect(secondRequest).toEqual({ ok: false, error: "invalid_or_expired_link" });
  });

  it("refuses a link after it expires", async () => {
    const { accounts, sent, tokenFrom, advanceMinutes } = setup();
    await accounts.invite(1, invite);
    advanceMinutes(11);
    const result = await accounts.completeSetup({token: tokenFrom(sent[0].link), name: "Izzy Sullivan", username: null, phone: null, password: goodPassword,});

    expect(result).toEqual({ ok: false, error: "invalid_or_expired_link" });
  });

  it("refuses a made up token", async () => {
    const { accounts } = setup();
    const result = await accounts.completeSetup({token: "made-up-token", name: "Izzy Sullivan", username: null, phone: null, password: goodPassword,});

    expect(result).toEqual({ ok: false, error: "invalid_or_expired_link" });
  });

  it("refuses a short password without using up the link", async () => {
    const { accounts, users, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    const token = tokenFrom(sent[0].link);

    const weak = await accounts.completeSetup({token, name: "Izzy Sullivan", username: null, phone: null, password: "short",});
    const retry = await accounts.completeSetup({token, name: "Izzy Sullivan", username: null, phone: null, password: goodPassword,});

    expect(weak).toEqual({ ok: false, error: "weak_password" });
    expect(retry).toEqual({ ok: true });
    expect(users[0].password_set_at).toBeInstanceOf(Date);
  });

  it("refuses a password longer than bcrypt can use", async () => {
    const { accounts, sent, tokenFrom } = setup();
    await accounts.invite(1, invite);
    const result = await accounts.completeSetup({token: tokenFrom(sent[0].link), name: "Izzy Sullivan", username: null, phone: null, password: "a".repeat(73),});

    expect(result).toEqual({ ok: false, error: "weak_password" });
  });
});