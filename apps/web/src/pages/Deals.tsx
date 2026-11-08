import { useState } from "react";
import { api, getSession } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, taka, toMinor, useLoad, formVals } from "../ui";

export default function Deals() {
  const deals = useLoad(api.deals);
  const leads = useLoad(api.leads);
  const listings = useLoad(api.listings);
  const props = useLoad(api.properties);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string>();
  const [err, setErr] = useState<string>();
  const sales = listings.data?.filter((l) => l.kind === "sale") ?? [];
  const title = (lid: string) => props.data?.find((p) => p.id === listings.data?.find((l) => l.id === lid)?.propertyId)?.title ?? "—";
  const who = (id: string) => leads.data?.find((l) => l.id === id)?.name ?? "—";
  const tone = { booking: "info", paying: "warn", completed: "ok", cancelled: "bad" } as const;

  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      await api.createDeal({ leadId: f.leadId, listingId: f.listingId, price: { amount: toMinor(f.price), currency: "BDT" }, installments: Number(f.n) });
      setOpen(false); setErr(undefined); deals.reload();
    } catch (x) { setErr((x as Error).message); }
  };
  const pay = async (d: string, i: string) => { try { await api.payInstallment(d, i); deals.reload(); } catch (x) { setErr((x as Error).message); } };

  return (
    <>
      <PageHead title="Deals" sub="Bookings and payment schedules" action={getSession()?.user.role === "agent" ? undefined : <Btn onClick={() => setOpen(true)}>New deal</Btn>} />
      <Err msg={err} />
      {!deals.data?.length ? <Empty>No deals yet.</Empty> : (
        <div className="space-y-3">
          {deals.data.map((d) => {
            const paid = d.installments.filter((i) => i.paidAt).reduce((s, i) => s + i.amount.amount, 0);
            const pct = Math.round((paid / d.price.amount) * 100);
            return (
              <Card key={d.id} className="p-5">
                <button className="w-full text-left" onClick={() => setSel(sel === d.id ? undefined : d.id)}>
                  <div className="flex justify-between items-start gap-3">
                    <div><div className="font-medium">{title(d.listingId)}</div><div className="text-xs text-ink-3 mt-0.5">{who(d.leadId)} · {taka(d.price.amount)}</div></div>
                    <Badge tone={tone[d.status]}>{d.status}</Badge>
                  </div>
                  <div className="h-2 rounded-full bg-surface mt-4"><div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                  <div className="text-xs text-ink-3 mt-1.5">{taka(paid)} paid · {pct}%</div>
                </button>
                {sel === d.id && (
                  <div className="mt-4 divide-y divide-line border-t border-line">
                    {d.installments.map((i, n) => (
                      <div key={i.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span>#{n + 1} · {i.dueDate}</span>
                        <span className="font-medium">{taka(i.amount.amount)}</span>
                        {i.paidAt ? <Badge tone="ok">paid</Badge> : <Btn kind="ghost" className="!py-1" onClick={() => pay(d.id, i.id)}>Mark paid</Btn>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Drawer open={open} title="New deal" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="space-y-3">
          <Err msg={err} />
          <Select name="leadId" label="Buyer" required>{leads.data?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          <Select name="listingId" label="Listing" required>{sales.map((l) => <option key={l.id} value={l.id}>{title(l.id)}</option>)}</Select>
          <Input name="price" type="number" min="1" label="Agreed price (৳)" required />
          <Input name="n" type="number" min="1" max="120" defaultValue="1" label="Monthly installments" required />
          <Btn type="submit" className="w-full">Create</Btn>
        </form>
      </Drawer>
    </>
  );
}
