import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, useLoad, formVals } from "../ui";

export default function Visits() {
  const visits = useLoad(api.visits);
  const leads = useLoad(api.leads);
  const listings = useLoad(api.listings);
  const props = useLoad(api.properties);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string>();
  const lead = (id: string) => leads.data?.find((l) => l.id === id)?.name ?? "—";
  const place = (lid?: string) => {
    const l = listings.data?.find((x) => x.id === lid);
    return props.data?.find((p) => p.id === l?.propertyId)?.title ?? "—";
  };
  const sorted = [...(visits.data ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      await api.createVisit({ leadId: f.leadId, listingId: f.listingId || undefined, scheduledAt: new Date(f.when).toISOString() });
      setOpen(false); setErr(undefined); visits.reload();
    } catch (x) { setErr((x as Error).message); }
  };
  const set = async (id: string, s: string) => { await api.setVisit(id, s); visits.reload(); };

  return (
    <>
      <PageHead title="Site visits" sub="Schedule and track viewings" action={<Btn onClick={() => setOpen(true)}>Schedule</Btn>} />
      {!sorted.length ? <Empty>No visits scheduled.</Empty> : (
        <Card className="divide-y divide-line">
          {sorted.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium">{lead(v.leadId)}</div>
                <div className="text-xs text-ink-3">{place(v.listingId)} · {new Date(v.scheduledAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={v.status === "done" ? "ok" : v.status === "cancelled" ? "bad" : "info"}>{v.status}</Badge>
                {v.status === "scheduled" && (<><Btn kind="ghost" onClick={() => set(v.id, "done")}>Done</Btn><Btn kind="ghost" onClick={() => set(v.id, "cancelled")}>Cancel</Btn></>)}
              </div>
            </div>
          ))}
        </Card>
      )}
      <Drawer open={open} title="Schedule visit" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="space-y-3">
          <Err msg={err} />
          <Select name="leadId" label="Lead" required>{leads.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          <Select name="listingId" label="Listing"><option value="">—</option>{listings.data?.map((l) => <option key={l.id} value={l.id}>{place(l.id)} ({l.kind})</option>)}</Select>
          <Input name="when" type="datetime-local" label="When" required />
          <Btn type="submit" className="w-full">Save</Btn>
        </form>
      </Drawer>
    </>
  );
}
