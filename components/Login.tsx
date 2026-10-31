"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient, usernameEmail } from "@/lib/auth-client";
import { api } from "@/lib/client";

export default function Login({ admin = false, oauthError = false }: { admin?: boolean; oauthError?: boolean }) {
  const [providers, setProviders] = useState({ google: false, vk: false });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [register, setRegister] = useState(false);
  const [error, setError] = useState(oauthError ? "Вход не завершён. Попробуйте снова или продолжите покупки без регистрации." : "");
  useEffect(() => {
    api<typeof providers>("config").then(setProviders).catch(() => setError("Не удалось загрузить настройки входа."));
  }, []);

  const social = async (provider: "google" | "vk") => {
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: "/account", errorCallbackURL: "/login?error=oauth" });
      if (result.error) throw new Error("Не удалось начать вход. Проверьте настройки подключения.");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    const f = new FormData(event.currentTarget);
    const login = String(f.get("login")).trim();
    const password = String(f.get("password"));
    try {
      if (register && !admin) {
        const username = login.toLowerCase();
        // Better Auth requires an internal email field; customers only enter a username.
        const result = await authClient.signUp.email({ name: login, username, email: usernameEmail(username), password });
        if (result.error) {
          const code = result.error.code;
          if (code === "USERNAME_IS_ALREADY_TAKEN" || code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL")
            throw new Error("Этот логин уже занят. Выберите другой или войдите в свой аккаунт.");
          throw new Error("Не удалось зарегистрироваться. Логин: от 3 до 30 латинских букв, цифр, точек или знаков подчёркивания. Пароль: от 8 символов.");
        }
      } else {
        const email = admin && login.toLowerCase() === "admin" ? "admin@bakery.invalid" : login.toLowerCase();
        const result = email.includes("@")
          ? await authClient.signIn.email({ email, password })
          : await authClient.signIn.username({ username: login.toLowerCase(), password });
        if (result.error) throw new Error("Неверный логин или пароль.");
      }
      window.location.assign(admin ? "/admin" : "/account");
    } catch (e) { setError((e as Error).message); }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <div className="form-card login-card">
      <h2>{admin ? "Вход для сотрудников" : register ? "Создать аккаунт" : "Рады видеть вас снова"}</h2>
      <p className="muted">{admin ? "Используйте аккаунт, созданный владельцем сайта." : register ? "Придумайте логин и пароль — и аккаунт готов." : "Войдите, чтобы ваши любимые покупки всегда были под рукой."}</p>
      <form onSubmit={submit}>
        <label className="form-field">{register ? "Логин" : "Логин или email"}<input name="login" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} minLength={register ? 3 : undefined} maxLength={register ? 30 : 254} pattern={register ? "[A-Za-z0-9_.]{3,30}" : undefined} aria-describedby={register ? "login-hint" : undefined} /></label>
        {register && <p className="fine-print" id="login-hint">От 3 до 30 латинских букв, цифр, точек или знаков подчёркивания.</p>}
        <label className="form-field">Пароль<input name="password" type="password" required minLength={register ? 8 : undefined} maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>
        {register && <p className="fine-print">Пароль должен содержать не менее 8 символов.</p>}
        <button className="button full-width" disabled={busy}>{busy ? "Подождите…" : admin ? "Войти в админку" : register ? "Зарегистрироваться" : "Войти"}</button>
      </form>
      {!admin && <>
        <button type="button" className="text-link" style={{ marginTop: 18 }} disabled={busy} onClick={() => { setRegister(!register); setError(""); }}>
          {register ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
        {(["vk", "google"] as const).filter((provider) => providers[provider]).map((provider) => <button key={provider} className="social-button" disabled={busy} onClick={() => void social(provider)}><b>{provider === "vk" ? "VK" : "G"}</b> Войти через {provider === "vk" ? "VK ID" : "Google"}</button>)}
      </>}
      {error && <div className="error" role="alert">{error}</div>}
      <Link href="/menu" className="text-link" style={{ marginTop: 25 }}>Продолжить без регистрации →</Link>
    </div>
  );
}
