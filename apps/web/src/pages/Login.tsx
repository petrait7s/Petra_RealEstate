import { useState } from "react";
import { api, setSession, type Session } from "../api";
import { Btn, Err, Input } from "../ui";

export default function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const s = await api.login(String(f.get("email")), String(f.get("password")));
      setSession(s); onLogin(s);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="min-h-full grid place-items-center bg-stage p-5">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl p-8 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="w-9 h-9 rounded-xl bg-accent text-white grid place-items-center font-bold">P</span>
          <div className="leading-tight"><div className="font-semibold tracking-wide">PETRA</div><div className="text-[11px] text-accent-text">Real Estate OS</div></div>
        </div>
        <Err msg={err} />
        <Input name="email" type="email" label="Email" autoComplete="username" required />
        <Input name="password" type="password" label="Password" autoComplete="current-password" required />
        <Btn type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Btn>
      </form>
    </div>
  );
}
