"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/client";

export default function Login({ admin = false, oauthError = false }: { admin?: boolean; oauthError?: boolean }) {
  const [providers, setProviders] = useState({ google: false, vk: false, emailRegistration: false });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(oauthError ? "Вход не завершён. Попробуйте снова или продолжите покупки без регистрации." : "");
  useEffect(() => {
    api<typeof providers>("config").then(setProviders).catch(() => setError("Не удалось загрузить настройки входа." )).finally(() => setReady(true));
  }, []);

  const social = async (provider: "google" | "vk") => {
    setBusy(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: "/account", errorCallbackURL: "/login?error=oauth" });
      if (result.error) throw new Error("Не удалось начать вход. Проверьте настройки подключения.");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const f = new FormData(event.currentTarget);
    const login = String(f.get("email")).trim().toLowerCase();
    const password = String(f.get("password"));
    try {
      if (register && !admin) {
        const result = await authClient.signUp.email({ name: String(f.get("name")).trim(), email: login, password, callbackURL: "/account" });
        if (result.error) throw new Error("Не удалось зарегистрироваться. Проверьте данные и попробуйте снова.");
        setEmail(login);
        setNotice("Если адрес доступен для регистрации, на него придёт письмо со ссылкой подтверждения. Проверьте также папку «Спам».");
      } else {
        const result = await authClient.signIn.email({ email: admin && login === "admin" ? "admin@bakery.invalid" : login, password });
        if (result.error) {
          if (!admin && result.error.code === "EMAIL_NOT_VERIFIED") {
            setEmail(login);
            throw new Error("Подтвердите адрес почты по ссылке в письме. При необходимости запросите письмо ещё раз.");
          }
          throw new Error("Неверный логин или пароль.");
        }
        window.location.assign(admin ? "/admin" : "/account");
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
      if (result.error) throw new Error("Не удалось отправить письмо. Попробуйте позже.");
      setNotice("Если адрес ожидает подтверждения, письмо отправлено. Проверьте папку «Спам».");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="form-card login-card">
      <h2>{admin ? "Вход для сотрудников" : register ? "Создать аккаунт" : "Рады видеть вас снова"}</h2>
      <p className="muted">{admin ? "Используйте аккаунт, созданный владельцем сайта." : register ? "Подтвердите почту, чтобы завершить регистрацию." : "Войдите, чтобы ваши любимые покупки всегда были под рукой."}</p>
      <form onSubmit={submit}>
        {register && !admin && <label className="form-field">Имя<input name="name" required minLength={1} maxLength={100} autoComplete="name" /></label>}
        <label className="form-field">{admin ? "Логин или email" : "Электронная почта"}<input name="email" type={admin ? "text" : "email"} required autoComplete="username" /></label>
        <label className="form-field">Пароль<input name="password" type="password" required minLength={register && !admin ? 8 : undefined} autoComplete={register && !admin ? "new-password" : "current-password"} /></label>
        {register && !admin && <p className="fine-print">Пароль должен содержать не менее 8 символов.</p>}
        <button className="button full-width" disabled={busy || (register && !providers.emailRegistration)}>{busy ? "Подождите…" : admin ? "Войти в админку" : register ? "Зарегистрироваться" : "Войти"}</button>
      </form>
      {!admin && <>
        <button type="button" className="text-link" style={{ marginTop: 18 }} onClick={() => { setRegister(!register); setError(""); setNotice(""); setEmail(""); }}>
          {register ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
        </button>
        {register && ready && !providers.emailRegistration && <p className="fine-print">Регистрация временно недоступна: почта для подтверждения ещё не настроена.</p>}
        {email && providers.emailRegistration && <button type="button" className="text-link" style={{ marginTop: 12 }} disabled={busy} onClick={() => void resend()}>Отправить письмо ещё раз</button>}
        {(["vk", "google"] as const).filter((provider) => providers[provider]).map((provider) => <button key={provider} className="social-button" disabled={busy || !ready} onClick={() => void social(provider)}><b>{provider === "vk" ? "VK" : "G"}</b> Войти через {provider === "vk" ? "VK ID" : "Google"}</button>)}
      </>}
      {notice && <p role="status">{notice}</p>}
      {error && <div className="error" role="alert">{error}</div>}
      <Link href="/menu" className="text-link" style={{ marginTop: 25 }}>Продолжить без регистрации →</Link>
    </div>
  );
}
