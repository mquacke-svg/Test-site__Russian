import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

function config() {
  let saved: { user?: string; password?: string } = {};
  if (process.env.SMTP_CONFIG_PATH) {
    try { saved = JSON.parse(readFileSync(process.env.SMTP_CONFIG_PATH, "utf8")); }
    catch { return null; }
  }
  const host = process.env.SMTP_HOST;
  const user = saved.user || process.env.SMTP_USER;
  const password = saved.password || process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !password || !from) return null;
  return { host, user, password, from, port: Number(process.env.SMTP_PORT || 465) };
}

export function isMailConfigured() {
  return !!config();
}

export async function sendVerificationMail(to: string, url: string) {
  const settings = config();
  if (!settings) throw new Error("Почта для подтверждения не настроена");
  const { host, port, user, password, from } = settings;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
    connectionTimeout: 15000,
  });
  await transporter.sendMail({
    from,
    to,
    subject: "Подтвердите почту — Жак-Андрэ",
    text: `Здравствуйте!\n\nЧтобы подтвердить адрес электронной почты, перейдите по ссылке:\n${url}\n\nЕсли вы не регистрировались, просто проигнорируйте это письмо. Ссылка действительна один час.`,
  });
}
