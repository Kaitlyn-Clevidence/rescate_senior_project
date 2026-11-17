// Author(s): Isabel Sullivan
// Start date: 2026-11-16
// Last updated: 2026-11-16
// P5: MVP
// Purpose: HTTP routes for account setup through an admin invite
// POST /users/invite sends a setup link, POST /auth/setup finishes the account

import type { FastifyInstance } from "fastify";
import type { AccountService, InviteRequest } from "../../services/AccountService.js";


//What the setup page sends
interface SetupBody {
    token: string;
    name: string;
    username?: string | null;
    phone?: string | null;
    password: string;
}

const inviteSchema = {
    body: {
        type: "object",
        required: ["email", "role", "language"],
        properties: {
            email: {type: "string", format: "email", maxLength: 255},
            role: {type: "string", enum: ["admin", "provider", "board", "trainee"]},
            language: {type: "string", enum: ["en", "es"]},
            },
        },
} as const;

const setupSchema = {
    body: {
        type: "object",
        required: ["token", "name", "password"],
        properties: {
            token: {type: "string", minLength: 1, maxLength: 200},            
            name: {type: "string", minLength: 1, maxLength: 100},
            username: {type: ["string", "null"], maxLength: 50},
            phone: {type: ["string", "null"], maxLength: 50},
            password: {type: "string", maxLength: 200},
        },
    },
} as const;

export function registerAccountRoutes(app: FastifyInstance, accounts: AccountService){
    //Admin invites someone by email
    app.post<{Body: InviteRequest}>("/users/invite", 
        {schema: inviteSchema},
        async (request, reply) => {
            //Pass the admins user id instead of null once login feature exists
            const result = await accounts.invite(null, request.body);
            if(!result.ok) {
                return reply.code(409).send({error: result.error});
            }
            return reply
                .code(result.resent ? 200 : 201) 
                .send({user_id: result.userId, resent: result.resent});
        }
    );

    app.post<{Body: SetupBody }>("/auth/setup",
        {schema: setupSchema},
        async (request, reply) => {
            const result = await accounts.completeSetup({token: request.body.token, name: request.body.name, username: request.body.username ?? null, phone: request.body.phone ?? null, password: request.body.password, });   
        if(!result.ok){
            return reply.code(400).send({error: result.error});
        }
        return reply.code(204).send();
    }); 
}
