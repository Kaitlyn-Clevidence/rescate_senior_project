// Author(s): Isabel Sullivan
// Start date: 2026-11-14
// Last updated: 2026-11-14
// P5: MVP
// Purpose: tests MailService with a fake mail server, so no real email is sent

import type { SendMailOptions, Transporter } from "nodemailer";
import { describe, expect, it } from "vitest";
import { createMailService } from "../src/services/MailService.js";

//Fake mail server: keep messages in a list rather than sending it
function makeMail() {
    const sent: SendMailOptions[] = [];
    const transport = {
        sendMail: async (message: SendMailOptions) => {
            sent.push(message);
        },
    } as unknown as Transporter;
    const mail = createMailService(transport, "Rescate <no-reply@example.com>");
    return {mail, sent};
}

const link = "http://localhost:5173/setup?token=abc123";

describe("MailService", () => {
    it("sends the setup link to the invited user", async() => {
        const {mail, sent} = makeMail();
        await mail.sendSetup("provider@example.com", link, "en", 10);

        expect(sent).toHaveLength(1);
        expect(sent[0].to).toBe("provider@example.com");
        expect(sent[0].from).toBe("Rescate <no-reply@example.com>");
        expect(sent[0].text).toContain(link);
    });

    it("writes the setup email in English", async()=> {
        const {mail, sent} = makeMail();
        await mail.sendSetup("provider@example.com", link, "en", 10);

        expect(sent[0].subject).toBe("Set up your Rescate de San Carlos account");
        expect(sent[0].text).toContain("expires in 10 minutes");
    });

    it("writes the setup email in Spanish", async() => {
        const {mail, sent} = makeMail();
        await mail.sendSetup("newuser@example.com", link, "es", 10);

        expect(sent[0].subject).toBe("Configura tu cuenta de Rescate de San Carlos");
        expect(sent[0].text).toContain("vence en 10 minutos");
    });

    it("sends a reset email in either language", async ()=> {
        const {mail, sent} = makeMail();
        await mail.sendReset("provider@example.com", link, "en", 10);
        await mail.sendReset("provider@example.com", link, "es", 10);

        expect(sent[0].subject).toBe("Reset your Rescate de San Carlos password");
        expect(sent[1].subject).toBe("Restablece tu contraseña de Rescate de San Carlos");
        expect(sent[1].text).toContain(link);
    });
});
