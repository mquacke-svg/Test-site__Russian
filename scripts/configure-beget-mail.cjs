// Запускать на Beget: пароль передаётся через временную переменную окружения.
const fs = require("node:fs");
const nodemailer = require("nodemailer");
const target = process.argv[2];
const user = "noreply@case-garage.fun";
const password = process.env.BAKERY_SMTP_PASSWORD;
if (!target || !password) {
  console.error("Не указан путь или пароль.");
  process.exit(1);
}
const transport = nodemailer.createTransport({ host: "smtp.beget.com", port: 465, secure: true, auth: { user, pass: password }, connectionTimeout: 15000 });
transport.verify().then(() => {
  fs.writeFileSync(target, JSON.stringify({ user, password }), { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  console.log("SMTP подключён. Пароль сохранён в закрытом файле.");
}).catch(() => {
  console.error("Не удалось подключить SMTP. Проверьте пароль почтового ящика и повторите попытку.");
  process.exitCode = 1;
});
