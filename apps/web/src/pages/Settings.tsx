import { useState } from "react";
import { api } from "../api";
import { Btn, Card, Err, PageHead, useLoad } from "../ui";

const labels: Record<string, string> = {
  properties: "Properties", listings: "Listings", leads: "Leads", visits: "Visits", deals: "Deals",
  leases: "Leases", invoices: "Rent invoices", docs: "Documents", tasks: "Tasks",
};

export default function Settings() {
  const status = useLoad(api.demoStatus);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");

  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try { await fn(); setErr(undefined); setConfirm(false); setTyped(""); status.reload(); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  const d = status.data;

  return (
    <>
      <PageHead title="Settings" sub="Data tools" />
      <Err msg={err ?? status.error} />
      <Card className="p-6 max-w-2xl">
        <h2 className="text-sm font-semibold">Demo data</h2>
        <p className="text-sm text-ink-3 mt-1">Fill the app with a realistic sample (10 properties, 14 leads, deals, rentals) to explore it. Clear it any time to start real work.</p>
        {d && (
          <div className="grid grid-cols-3 gap-3 my-5">
            {Object.entries(d.counts).map(([k, v]) => (
              <div key={k} className="bg-page rounded-xl px-3 py-2.5"><div className="text-lg font-semibold">{v}</div><div className="text-xs text-ink-3">{labels[k] ?? k}</div></div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Btn disabled={busy || !d?.empty} onClick={run(api.demoLoad)}>Load demo data</Btn>
          <Btn kind="ghost" disabled={busy || d?.empty} onClick={() => setConfirm(true)}>Clear all data…</Btn>
        </div>
        {d && !d.empty && <p className="text-xs text-ink-3 mt-3">Load is available only when the app is empty. Clear first to reload.</p>}
        {confirm && (
          <div className="mt-5 border border-bad/40 bg-bad/5 rounded-xl p-4">
            <p className="text-sm text-ink-2">This deletes <b>all</b> properties, leads, deals, rentals, documents and tasks. Users and automation rules are kept. Type <b>CLEAR</b> to confirm.</p>
            <div className="flex gap-2 mt-3">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="CLEAR" className="px-3 py-2 rounded-xl border border-line text-sm outline-none focus:border-bad" />
              <button disabled={typed !== "CLEAR" || busy} onClick={run(() => api.demoClear(typed))}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-bad text-white disabled:opacity-40">Delete everything</button>
              <Btn kind="ghost" onClick={() => { setConfirm(false); setTyped(""); }}>Cancel</Btn>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
