import { useEffect, useState, type ReactNode } from "react";

/** BDT from minor units, lakh/crore grouping. */
export const taka = (minor: number) => "৳" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(minor / 100));
export const toMinor = (takaStr: string) => Math.round(Number(takaStr) * 100);

export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const load = () => fn().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line
  return { data, error, reload: load };
}

export const PageHead = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="flex items-end justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="text-sm text-ink-3 mt-1">{sub}</p>}
    </div>
    {action}
  </div>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white border border-line rounded-2xl ${className}`}>{children}</div>
);

export const Btn = ({ kind = "primary", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" }) => (
  <button
    {...p}
    className={`px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-40 ${
      kind === "primary" ? "bg-accent text-white hover:bg-accent-text" : "border border-line text-ink-2 hover:bg-surface"
    } ${p.className ?? ""}`}
  />
);

const tones: Record<string, string> = {
  ok: "bg-ok/10 text-ok", warn: "bg-warn/15 text-warn", bad: "bg-bad/10 text-bad", info: "bg-accent-soft text-accent-text", mute: "bg-surface text-ink-3",
};
export const Badge = ({ tone = "mute", children }: { tone?: keyof typeof tones; children: ReactNode }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>
);

export const Input = (p: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => {
  const { label, ...rest } = p;
  return (
    <label className="block text-xs text-ink-3">
      {label}
      <input {...rest} className="mt-1 w-full px-3 py-2 rounded-xl border border-line bg-white text-sm text-ink focus:border-accent outline-none" />
    </label>
  );
};
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) => {
  const { label, children, ...rest } = p;
  return (
    <label className="block text-xs text-ink-3">
      {label}
      <select {...rest} className="mt-1 w-full px-3 py-2 rounded-xl border border-line bg-white text-sm text-ink focus:border-accent outline-none">{children}</select>
    </label>
  );
};

export const Drawer = ({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) =>
  !open ? null : (
    <div className="fixed inset-0 z-20 flex justify-end bg-stage/40" onClick={onClose}>
      <div className="w-full max-w-sm bg-page h-full p-6 overflow-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-ink-3 text-xl leading-none" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );

export const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-ink-3 py-10 text-center">{children}</p>;
export const Err = ({ msg }: { msg?: string }) => (msg ? <p className="text-sm text-bad mb-3">{msg}</p> : null);

export const formVals = (f: HTMLFormElement) =>
  Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, String(v)])) as Record<string, string>;
