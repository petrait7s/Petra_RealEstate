import { useState } from "react";
import { canTransition, type Lead, type LeadStage } from "@petra/domain";
import { api } from "../api";
import { Btn, Card, Drawer, Err, Input, PageHead, taka, toMinor, useLoad, formVals } from "../ui";

const cols: [LeadStage, string][] = [["new", "New"], ["contacted", "Contacted"], ["site_visit", "Site visit"], ["negotiation", "Negotiation"], ["won", "Won"], ["lost", "Lost"]];

export default function Leads() {
  const { data, reload } = useLoad(api.leads);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string>();
  const [drag, setDrag] = useState<Lead>();

  const move = async (l: Lead, to: LeadStage) => {
    if (l.stage === to || !canTransition(l.stage, to)) return setErr(`Cannot move ${l.stage} → ${to}`);
    try { await api.moveLead(l.id, to); setErr(undefined); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      await api.createLead({ name: f.name, phone: f.phone || undefined, source: f.source || "manual", budget: f.budget ? { amount: toMinor(f.budget), currency: "BDT" } : undefined });
      setOpen(false); setErr(undefined); reload();
    } catch (x) { setErr((x as Error).message); }
  };

  return (
    <>
      <PageHead title="Pipeline" sub="Drag a card to the next stage" action={<Btn onClick={() => setOpen(true)}>Add lead</Btn>} />
      <Err msg={err} />
      <div className="flex gap-3 overflow-x-auto pb-3">
        {cols.map(([stage, label]) => {
          const items = data?.filter((l) => l.stage === stage) ?? [];
          return (
            <div key={stage} className="min-w-44 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, stage)}>
              <div className="flex justify-between text-xs font-medium text-ink-3 px-1 mb-2"><span>{label}</span><span>{items.length}</span></div>
              <div className="space-y-2 min-h-24 rounded-2xl bg-surface/60 p-2">
                {items.map((l) => (
                  <Card key={l.id} className="p-3 cursor-grab active:cursor-grabbing">
                    <div draggable onDragStart={() => setDrag(l)}>
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-ink-3 mt-0.5">{l.source}{l.phone && ` · ${l.phone}`}</div>
                      {l.budget && <div className="text-xs text-accent-text font-medium mt-2">{taka(l.budget.amount)}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Drawer open={open} title="Add lead" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="space-y-3">
          <Input name="name" label="Name" required /><Input name="phone" label="Phone" />
          <Input name="source" label="Source" placeholder="facebook, referral…" /><Input name="budget" type="number" label="Budget (৳)" />
          <Btn type="submit" className="w-full">Save</Btn>
        </form>
      </Drawer>
    </>
  );
}
