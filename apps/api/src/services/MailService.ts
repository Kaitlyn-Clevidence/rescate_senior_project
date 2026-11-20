// Author(s): Isabel Sullivan
// Start date: 2026-11-14
// Last updated: 2026-11-14
// P5: MVP
// Purpose: the only code that sends email; sends account setup and password
// reset links in English or Spanish (issue #12)
 
import nodemailer, {type Transporter} from "nodemailer";

export type Language = "en" | "es";

export interface MailConfig {
    host: string;
    port: number;
    user?: string;
    password?: string;
    from: string;
}

export interface MailService {
    sendSetup(to: string, link: string, language: Language, expiresInMinutes: number): Promise<void>;
    sendReset(to: string, link: string, language: Language, expiresInMinutes: number): Promise<void>;
}

//Turns a link lifetime into words, e.g. 10 -> "10 minutes", 1440 -> "24 hours"
export function formatDuration(minutes: number, language: Language): string {
    const words = {
        en: {minute: ["minute", "minutes"], hour: ["hour", "hours"]},
        es: {minute: ["minuto", "minutos"], hour: ["hora", "horas"]},
    }[language];
    if (minutes >= 60 && minutes % 60 === 0) {
        const hours = minutes / 60;
        return `${hours} ${words.hour[hours === 1 ? 0 : 1]}`;
    }
    return `${minutes} ${words.minute[minutes === 1 ? 0 : 1]}`;
}

//Email wording in each language
const messages = {
    setup: {
        en: {
            subject: "Set up your Rescate de San Carlos account",
            body: (link: string, expires: string) =>
                `You've been invited to set up your account in the Rescate de San Carlos ePCR system. \n\n` +
                `Open this link to create your password:\n${link}\n\n` +
                `This link works once and expires in ${expires}. ` + 
                `If you weren't expecting this email, it can be ignored.`,
        },
        es: {
            subject: "Configura tu cuenta de Rescate de San Carlos",
            body: (link: string, expires: string) =>
                `Has sido invitado al sistema ePCR de Rescate de San Carlos.\n\n` +
                `Abre este enlace para crear tu contraseña:\n${link}\n\n` +
                `El enlace funciona una sola vez y vence en ${expires}. ` +
                `Si no esperabas este correo, puedes ignorarlo.`,
        },
    },
    reset: {
        en: {
            subject: "Reset your Rescate de San Carlos password",
            body: (link: string, expires: string) =>
                `Someone requested to reset the password for this account.\n\n` +
                `Open this link to choose a new password: \n${link}\n\n` +
                `This link works once and expires in ${expires}. ` +
                `If you didn't request this, you can ignore this email and your password won't change. `,
        },
        es: {
            subject: "Restablece tu contraseña de Rescate de San Carlos",
            body: (link: string, expires: string) =>
                `Alguien solicitó restablecer la contraseña de esta cuenta.\n\n` +
                `Abre este enlace para elegir una nueva contraseña:\n${link}\n\n` +
                `El enlace funciona una sola vez y vence en ${expires}. ` +
                `Si no lo solicitaste, puedes ignorar este correo y tu contraseña no cambiará.`,
        },
    },
} as const;

//Connects to the SMTP server named in the config
export function createMailTransport(config: MailConfig): Transporter{
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        auth: config.user?{user: config.user, pass: config.password}: undefined,
    });
}

//Sends setup and reset emails through the given transport
export function createMailService(transport: Transporter, from: string): MailService{
    async function send(kind: "setup" | "reset", to: string, link: string, language: Language, minutes: number) {
        const message = messages[kind][language];
        await transport.sendMail({from, to, subject: message.subject, text: message.body(link, formatDuration(minutes, language)),
        });
    }
    return {
        sendSetup: (to, link, language, minutes) => send("setup", to, link, language, minutes),
        sendReset: (to, link, language, minutes) => send("reset", to, link, language, minutes),
    };
}
