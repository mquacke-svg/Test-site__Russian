import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { user, account } from "../lib/schema";
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (
  process.env.ADMIN_EMAIL || (await rl.question("Email администратора: "))
)
  .trim()
  .toLowerCase();
const name = process.env.ADMIN_NAME || "Администратор";
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  if (process.stdin.isTTY) {
    process.stdout.write("Пароль (минимум 12 символов, ввод скрыт): ");
    rl.close();
    process.stdin.setRawMode(true);
    process.stdin.resume();
    password = await new Promise<string>((resolve) => {
      let input = "";
      const listener = (chunk: Buffer) => {
        for (const char of chunk.toString()) {
          if (char === "\u0003") process.exit(130);
          if (char === "\r" || char === "\n") {
            process.stdin.off("data", listener);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write("\n");
            resolve(input);
            return;
          }
          if (char === "\u007f" || char === "\b") input = input.slice(0, -1);
          else input += char;
        }
      };
      process.stdin.on("data", listener);
    });
  } else
    throw new Error(
      "Укажите ADMIN_PASSWORD через переменную окружения или запустите команду в терминале",
    );
}
rl.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12)
  throw new Error("Нужен корректный email и пароль от 12 символов");
if (db.select().from(user).where(eq(user.email, email)).get())
  throw new Error(
    "Этот email уже существует. Создание не изменяет существующие аккаунты.",
  );
const id = randomUUID(),
  now = new Date(),
  hashed = await hashPassword(password);
db.transaction((tx) => {
  tx.insert(user)
    .values({
      id,
      email,
      name,
      role: "admin",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  tx.insert(account)
    .values({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      password: hashed,
      createdAt: now,
      updatedAt: now,
    })
    .run();
});
console.log("Администратор создан. Вход: /login?admin=1");
