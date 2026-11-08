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
  const [editing, setEditing] = useState<Lead>();
  const [q, setQ] = useState("");
  const shown = data?.filter((l) => `${l.name} ${l.phone ?? ""} ${l.source}`.toLowerCase().includes(q.toLowerCase()));
  const close = () => { setOpen(false); setEditing(undefined); setErr(undefined); };

  const move = async (l: Lead, to: LeadStage) => {
    if (l.stage === to || !canTransition(l.stage, to)) return setErr(`Cannot move ${l.stage} → ${to}`);
    try { await api.moveLead(l.id, to); setErr(undefined); reload(); } catch (e) { setErr((e as Error).message); }
  };
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      const body = { name: f.name, phone: f.phone || undefined, source: f.source || "manual", budget: f.budget ? { amount: toMinor(f.budget), currency: "BDT" } : undefined };
      if (editing) await api.patchLead(editing.id, body); else await api.createLead(body);
      close(); reload();
    } catch (x) { setErr((x as Error).message); }
  };

  const remove = async () => {
    if (!editing || !confirm(`Delete lead "${editing.name}" and their visits?`)) return;
    try { await api.deleteLead(editing.id); close(); reload(); } catch (x) { setErr((x as Error).message); }
  };

  return (
    <>
      <PageHead title="Pipeline" sub="Drag a card to the next stage" action={<Btn onClick={() => { setEditing(undefined); setOpen(true); }}>Add lead</Btn>} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, source…" className="w-full md:w-80 mb-4 px-3 py-2 rounded-xl border border-line bg-white text-sm outline-none focus:border-accent" />
      {!open && <Err msg={err} />}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {cols.map(([stage, label]) => {
          const items = shown?.filter((l) => l.stage === stage) ?? [];
          return (
            <div key={stage} className="min-w-44 flex-1" onDragOver={(e) => e.preventDefault()} onDrop={() => drag && move(drag, stage)}>
              <div className="flex justify-between text-xs font-medium text-ink-3 px-1 mb-2"><span>{label}</span><span>{items.length}</span></div>
              <div className="space-y-2 min-h-24 rounded-2xl bg-surface/60 p-2">
                {items.map((l) => (
                  <Card key={l.id} className="p-3 cursor-grab active:cursor-grabbing">
                    <div draggable onDragStart={() => setDrag(l)} onClick={() => { setEditing(l); setOpen(true); }}>
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
      <Drawer open={open} title={editing ? "Edit lead" : "Add lead"} onClose={close}>
        <form key={editing?.id ?? "new"} onSubmit={add} className="space-y-3">
          <Err msg={err} />
          <Input name="name" label="Name" defaultValue={editing?.name} required /><Input name="phone" label="Phone" defaultValue={editing?.phone} />
          <Input name="source" label="Source" defaultValue={editing?.source} placeholder="facebook, referral…" />
          <Input name="budget" type="number" label="Budget (৳)" defaultValue={editing?.budget ? editing.budget.amount / 100 : undefined} />
          <Btn type="submit" className="w-full">{editing ? "Save changes" : "Save"}</Btn>
          {editing && <button type="button" onClick={remove} className="w-full text-sm text-bad py-2">Delete lead</button>}
        </form>
      </Drawer>
    </>
  );
}
