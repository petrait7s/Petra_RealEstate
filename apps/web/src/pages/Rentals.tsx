import { useState } from "react";
import { api, getSession } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, taka, toMinor, useLoad, formVals } from "../ui";

const month = () => new Date().toISOString().slice(0, 7);

export default function Rentals() {
  const leases = useLoad(api.leases);
  const invoices = useLoad(api.invoices);
  const props = useLoad(api.properties);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string>();
  const place = (id: string) => props.data?.find((p) => p.id === id)?.title ?? "—";
  const reload = () => { leases.reload(); invoices.reload(); };

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      await api.createLease({ propertyId: f.propertyId, occupant: f.occupant, rent: { amount: toMinor(f.rent), currency: "BDT" }, startDate: f.start, dueDay: Number(f.day) });
      setOpen(false); setErr(undefined); reload();
    } catch (x) { setErr((x as Error).message); }
  };
  const run = (fn: () => Promise<unknown>) => async () => { try { await fn(); setErr(undefined); reload(); } catch (x) { setErr((x as Error).message); } };

  return (
    <>
      <PageHead title="Rentals" sub="Leases and monthly rent collection" action={getSession()?.user.role === "agent" ? undefined : <Btn onClick={() => setOpen(true)}>New lease</Btn>} />
      <Err msg={err} />
      {!leases.data?.length ? <Empty>No leases yet.</Empty> : (
        <div className="space-y-3">
          {leases.data.map((l) => {
            const inv = invoices.data?.filter((i) => i.leaseId === l.id).sort((a, b) => b.month.localeCompare(a.month)) ?? [];
            return (
              <Card key={l.id} className="p-5">
                <div className="flex justify-between items-start gap-3">
                  <div><div className="font-medium">{place(l.propertyId)}</div><div className="text-xs text-ink-3 mt-0.5">{l.occupant} · {taka(l.rent.amount)}/mo · due day {l.dueDay}</div></div>
                  <Btn kind="ghost" onClick={run(() => api.genInvoice(l.id, month()))}>Invoice {month()}</Btn>
                </div>
                {inv.length > 0 && (
                  <div className="mt-4 divide-y divide-line border-t border-line">
                    {inv.map((i) => (
                      <div key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span>{i.month}</span><span className="font-medium">{taka(i.amount.amount)}</span>
                        {i.paidAt ? <Badge tone="ok">paid</Badge> : <Btn kind="ghost" className="!py-1" onClick={run(() => api.payInvoice(i.id))}>Mark paid</Btn>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Drawer open={open} title="New lease" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="space-y-3">
          <Select name="propertyId" label="Property" required>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>
          <Input name="occupant" label="Tenant name" required />
          <Input name="rent" type="number" min="1" label="Monthly rent (৳)" required />
          <div className="grid grid-cols-2 gap-3"><Input name="start" type="date" label="Start" required /><Input name="day" type="number" min="1" max="28" defaultValue="5" label="Due day" required /></div>
          <Btn type="submit" className="w-full">Create</Btn>
        </form>
      </Drawer>
    </>
  );
}
