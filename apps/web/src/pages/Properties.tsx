import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, taka, toMinor, useLoad, formVals } from "../ui";

export default function Properties() {
  const props = useLoad(api.properties);
  const listings = useLoad(api.listings);
  const [open, setOpen] = useState<"property" | "listing" | null>(null);
  const [err, setErr] = useState<string>();
  const byProp = (id: string) => listings.data?.filter((l) => l.propertyId === id) ?? [];
  const reload = () => { props.reload(); listings.reload(); };

  const submit = (kind: "property" | "listing") => async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      if (kind === "property")
        await api.createProperty({ type: f.type, title: f.title, address: f.address, areaSqft: f.area ? Number(f.area) : undefined, bedrooms: f.beds ? Number(f.beds) : undefined });
      else await api.createListing({ propertyId: f.propertyId, kind: f.kind, status: "active", price: { amount: toMinor(f.price), currency: "BDT" } });
      setOpen(null); setErr(undefined); reload();
    } catch (x) { setErr((x as Error).message); }
  };

  return (
    <>
      <PageHead title="Properties" sub="Physical assets and their sale or rent listings"
        action={<div className="flex gap-2"><Btn kind="ghost" onClick={() => setOpen("listing")}>New listing</Btn><Btn onClick={() => setOpen("property")}>Add property</Btn></div>} />
      {!props.data?.length ? <Empty>No properties yet.</Empty> : (
        <div className="grid md:grid-cols-2 gap-3">
          {props.data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex justify-between items-start">
                <div><div className="font-medium">{p.title}</div><div className="text-xs text-ink-3 mt-0.5">{p.address}</div></div>
                <Badge tone="info">{p.type}</Badge>
              </div>
              <div className="text-xs text-ink-3 mt-3">{[p.areaSqft && `${p.areaSqft} sqft`, p.bedrooms && `${p.bedrooms} bed`, p.bathrooms && `${p.bathrooms} bath`].filter(Boolean).join(" · ")}</div>
              <div className="mt-4 space-y-1.5">
                {byProp(p.id).map((l) => (
                  <div key={l.id} className="flex justify-between items-center text-sm bg-page rounded-xl px-3 py-2">
                    <span>{l.kind === "sale" ? "For sale" : "For rent"} <span className="font-semibold">{taka(l.price.amount)}</span>{l.kind === "rent" && <span className="text-ink-3">/mo</span>}</span>
                    <Badge tone={l.status === "active" ? "ok" : "mute"}>{l.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Drawer open={open === "property"} title="Add property" onClose={() => setOpen(null)}>
        <form onSubmit={submit("property")} className="space-y-3">
          <Err msg={err} />
          <Input name="title" label="Title" required />
          <Input name="address" label="Address" required />
          <Select name="type" label="Type"><option>apartment</option><option>house</option><option>land</option><option>plot</option><option>commercial</option></Select>
          <div className="grid grid-cols-2 gap-3"><Input name="area" type="number" label="Area (sqft)" /><Input name="beds" type="number" label="Bedrooms" /></div>
          <Btn type="submit" className="w-full">Save</Btn>
        </form>
      </Drawer>
      <Drawer open={open === "listing"} title="New listing" onClose={() => setOpen(null)}>
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
