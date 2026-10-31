"use client";
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({ plugins: [usernameClient({ displayUsername: false })] });

export function usernameEmail(username: string) {
  // Hex keeps every allowed ASCII username valid as an email local part.
  const encoded = Array.from(username.toLowerCase(), (character) =>
    character.charCodeAt(0).toString(16).padStart(2, "0"),
  ).join("");
  return `${encoded}@username.bakery.invalid`;
}
