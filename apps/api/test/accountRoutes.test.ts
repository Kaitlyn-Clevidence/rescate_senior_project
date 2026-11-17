// Author(s): Isabel Sullivan
// Start date: 2026-11-16
// Last updated: 2026-11-16
// P5: MVP
// Purpose: tests the account invite and setup routes with a fake AccountService,
// checking status codes, error codes and input checking (issue #12, FR3, FR4)

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, type Repositories } from "../src/http/app.js";
import type {AccountService, InviteRequest, InviteResult, SetupRequest, SetupResult} from "../src/services/AccountService.js";

// Chart and patient routes aren't used here, so they return nothing
const repositories: Repositories = {
  charts: {listCharts: async () => [], getChartById: async () => undefined, listChartsByPatientId: async () => [],},
  patients: { getPatientById: async () => undefined },
};

// Fake AccountService: records what the routes pass in and returns a chosen result
function makeAccounts() {
  const calls = {
    invites: [] as { invitedBy: number | null; request: InviteRequest }[],
    setups: [] as SetupRequest[],
  };
  let inviteResult: InviteResult = { ok: true, userId: 7, resent: false };
  let setupResult: SetupResult = { ok: true };

  const accounts: AccountService = {
    invite: async (invitedBy, request) => { calls.invites.push({ invitedBy, request }); return inviteResult; },
    completeSetup: async (request) => { calls.setups.push(request); return setupResult; },
  };
  return { accounts, calls, setInviteResult: (r: InviteResult) => (inviteResult = r), setSetupResult: (r: SetupResult) => (setupResult = r), };
}

let app: ReturnType<typeof buildApp>;
let fake: ReturnType<typeof makeAccounts>;

beforeEach(() => {
  fake = makeAccounts();
  app = buildApp(repositories, { accounts: fake.accounts });
});

afterEach(async () => {
  await app.close();
});

const invite = { email: "provider@example.com", role: "provider", language: "es" };
const setup = { token: "abc123", name: "Izzy Sullivan", password: "Rescate is the best" };

describe("POST /users/invite", () => {
  it("returns 201 with the new user's id", async () => {
    const res = await app.inject({ method: "POST", url: "/users/invite", payload: invite });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ user_id: 7, resent: false });
    expect(fake.calls.invites[0].request).toEqual(invite);
  });

  it("returns 200 when an unfinished invite gets a new link", async () => {
    fake.setInviteResult({ ok: true, userId: 7, resent: true });
    const res = await app.inject({ method: "POST", url: "/users/invite", payload: invite });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user_id: 7, resent: true });
  });

  it("returns 409 when the email already has an account", async () => {
    fake.setInviteResult({ ok: false, error: "email_taken" });
    const res = await app.inject({ method: "POST", url: "/users/invite", payload: invite });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "email_taken" });
  });

  it.each([
    ["an invalid email", { ...invite, email: "not-an-email" }],
    ["an unknown role", { ...invite, role: "doctor" }],
    ["an unknown language", { ...invite, language: "fr" }],
    ["a missing email", { role: "provider", language: "es" }],
  ])("returns 400 for %s without calling the service", async (_label, payload) => {
    const res = await app.inject({ method: "POST", url: "/users/invite", payload });

    expect(res.statusCode).toBe(400);
    expect(fake.calls.invites).toHaveLength(0);
  });

  it("passes no inviter until login exists", async () => {
    await app.inject({ method: "POST", url: "/users/invite", payload: invite });

    expect(fake.calls.invites[0].invitedBy).toBeNull();
  });
});

describe("POST /auth/setup", () => {
  it("returns 204 when setup succeeds", async () => {
    const res = await app.inject({ method: "POST", url: "/auth/setup", payload: setup });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
  });

  it("fills in null for a missing username and phone", async () => {
    await app.inject({ method: "POST", url: "/auth/setup", payload: setup });

    expect(fake.calls.setups[0]).toEqual({ ...setup, username: null, phone: null });
  });

  it("returns 400 with a code when the link is invalid or expired", async () => {
    fake.setSetupResult({ ok: false, error: "invalid_or_expired_link" });
    const res = await app.inject({ method: "POST", url: "/auth/setup", payload: setup });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_or_expired_link" });
  });

  it("returns 400 with a code when the password is too weak", async () => {
    fake.setSetupResult({ ok: false, error: "weak_password" });
    const res = await app.inject({ method: "POST", url: "/auth/setup", payload: setup });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "weak_password" });
  });

  it.each([
    ["a missing token", { name: "Izzy Sullivan", password: "Rescate is the best" }],
    ["an empty name", { ...setup, name: "" }],
    ["a missing password", { token: "abc123", name: "Izzy Sullivan" }],
  ])("returns 400 for %s without calling the service", async (_label, payload) => {
    const res = await app.inject({ method: "POST", url: "/auth/setup", payload });

    expect(res.statusCode).toBe(400);
    expect(fake.calls.setups).toHaveLength(0);
  });
});

describe("without an AccountService", () => {
  it("does not add the account routes", async () => {
    const plain = buildApp(repositories);
    const res = await plain.inject({ method: "POST", url: "/users/invite", payload: invite });

    expect(res.statusCode).toBe(404);
    await plain.close();
  });
});
