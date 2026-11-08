import { useState } from "react";
import type { Property } from "@petra/domain";
import { api } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, formVals, taka, toMinor, useLoad } from "../ui";

const types = ["apartment", "house", "land", "plot", "commercial"];

export default function Properties() {
  const props = useLoad(api.properties);
  const listings = useLoad(api.listings);
  const [open, setOpen] = useState<"property" | "listing" | null>(null);
  const [editing, setEditing] = useState<Property>();
  const [err, setErr] = useState<string>();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const byProp = (id: string) => listings.data?.filter((l) => l.propertyId === id) ?? [];
  const reload = () => { props.reload(); listings.reload(); };
  const shown = props.data?.filter((p) => (!type || p.type === type) && (`${p.title} ${p.address}`.toLowerCase().includes(q.toLowerCase()))) ?? [];
  const close = () => { setOpen(null); setEditing(undefined); setErr(undefined); };
  const run = (fn: () => Promise<unknown>, ask?: string) => async () => {
    if (ask && !confirm(ask)) return;
    try { await fn(); setErr(undefined); reload(); } catch (x) { setErr((x as Error).message); }
  };

  const submit = (kind: "property" | "listing") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      if (kind === "property") {
        const body = { type: f.type, title: f.title, address: f.address, areaSqft: f.area ? Number(f.area) : undefined, bedrooms: f.beds ? Number(f.beds) : undefined };
        if (editing) await api.patchProperty(editing.id, body); else await api.createProperty(body);
      } else await api.createListing({ propertyId: f.propertyId, kind: f.kind, status: "active", price: { amount: toMinor(f.price), currency: "BDT" } });
      close(); reload();
    } catch (x) { setErr((x as Error).message); }
  };

  return (
    <>
      <PageHead title="Properties" sub="Physical assets and their sale or rent listings"
        action={<div className="flex gap-2"><Btn kind="ghost" onClick={() => setOpen("listing")}>New listing</Btn><Btn onClick={() => setOpen("property")}>Add property</Btn></div>} />
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or address…" className="flex-1 min-w-48 px-3 py-2 rounded-xl border border-line bg-white text-sm outline-none focus:border-accent" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 rounded-xl border border-line bg-white text-sm outline-none">
          <option value="">All types</option>{types.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {!open && <Err msg={err} />}
      {!shown.length ? <Empty>{props.data?.length ? "No match." : "No properties yet. Add one, or load demo data in Settings."}</Empty> : (
        <div className="grid md:grid-cols-2 gap-3">
          {shown.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex justify-between items-start gap-2">
                <div><div className="font-medium">{p.title}</div><div className="text-xs text-ink-3 mt-0.5">{p.address}</div></div>
                <Badge tone="info">{p.type}</Badge>
              </div>
              <div className="text-xs text-ink-3 mt-3">{[p.areaSqft && `${p.areaSqft} sqft`, p.bedrooms && `${p.bedrooms} bed`, p.bathrooms && `${p.bathrooms} bath`].filter(Boolean).join(" · ")}</div>
              <div className="mt-4 space-y-1.5">
                {byProp(p.id).map((l) => (
                  <div key={l.id} className="flex justify-between items-center gap-2 text-sm bg-page rounded-xl px-3 py-2">
                    <span>{l.kind === "sale" ? "For sale" : "For rent"} <span className="font-semibold">{taka(l.price.amount)}</span>{l.kind === "rent" && <span className="text-ink-3">/mo</span>}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={l.status === "active" ? "ok" : l.status === "reserved" ? "warn" : "mute"}>{l.status}</Badge>
                      <button title={l.status === "active" ? "Close listing" : "Activate listing"} className="text-xs text-accent-text"
                        onClick={run(() => api.patchListing(l.id, { status: l.status === "active" ? "closed" : "active" }))}>{l.status === "active" ? "Close" : "Activate"}</button>
                      <button title="Delete listing" aria-label="Delete listing" className="text-bad text-base leading-none" onClick={run(() => api.deleteListing(l.id), "Delete this listing?")}>×</button>
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-4 text-xs">
                <button className="text-accent-text" onClick={() => { setEditing(p); setOpen("property"); }}>Edit</button>
                <button className="text-bad" onClick={run(() => api.deleteProperty(p.id), `Delete "${p.title}" and its listings?`)}>Delete</button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Drawer open={open === "property"} title={editing ? "Edit property" : "Add property"} onClose={close}>
        <form key={editing?.id ?? "new"} onSubmit={submit("property")} className="space-y-3">
          <Err msg={err} />
          <Input name="title" label="Title" defaultValue={editing?.title} required />
          <Input name="address" label="Address" defaultValue={editing?.address} required />
          <Select name="type" label="Type" defaultValue={editing?.type}>{types.map((t) => <option key={t}>{t}</option>)}</Select>
          <div className="grid grid-cols-2 gap-3">
            <Input name="area" type="number" label="Area (sqft)" defaultValue={editing?.areaSqft} />
            <Input name="beds" type="number" label="Bedrooms" defaultValue={editing?.bedrooms} />
          </div>
          <Btn type="submit" className="w-full">{editing ? "Save changes" : "Save"}</Btn>
        </form>
      </Drawer>
      <Drawer open={open === "listing"} title="New listing" onClose={close}>
        <form onSubmit={submit("listing")} className="space-y-3">
          <Err msg={err} />
          <Select name="propertyId" label="Property" required>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</Select>
          <Select name="kind" label="Kind"><option value="sale">Sale</option><option value="rent">Rent</option></Select>
          <Input name="price" type="number" min="1" label="Price (৳)" required />
          <Btn type="submit" className="w-full">Publish</Btn>
        </form>
      </Drawer>
    </>
  );
}
