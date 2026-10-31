import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as schema from "./schema";

export const auth = betterAuth({
  appName: "Жак-Андрэ",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  plugins: [username({ displayUsername: false }), nextCookies()],
  disabledPaths: ["/send-verification-email"],
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
    },
  },
  account: { accountLinking: { enabled: false } },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: true, window: 60, max: 30,
    customRules: {
      "/sign-up/email": { window: 60, max: 3 },
      "/sign-in/username": { window: 60, max: 10 },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.VK_CLIENT_ID && process.env.VK_CLIENT_SECRET
      ? {
          vk: {
            clientId: process.env.VK_CLIENT_ID,
            clientSecret: process.env.VK_CLIENT_SECRET,
            disableDefaultScope: true,
            scope: ["email"],
          },
        }
      : {}),
  },
});
