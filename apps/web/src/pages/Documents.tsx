import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, Card, Empty, Err, PageHead, Select, formVals, useLoad } from "../ui";

const MAX = 10 * 1024 * 1024;
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const toBase64 = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });

export default function Documents() {
  const docs = useLoad(api.documents);
  const props = useLoad(api.properties);
  const leads = useLoad(api.leads);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const entityName = (t?: string, id?: string) =>
    t === "property" ? props.data?.find((p) => p.id === id)?.title : t === "lead" ? leads.data?.find((l) => l.id === id)?.name : undefined;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX) return setErr("File too large (max 10MB)");
    const f = formVals(form);
    const [entityType, entityId] = f.link ? f.link.split(":") : [undefined, undefined];
    setBusy(true);
    try {
      await api.upload({ name: file.name, mime: file.type || "application/octet-stream", entityType, entityId, dataBase64: await toBase64(file) });
      form.reset(); setErr(undefined); docs.reload();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <PageHead title="Documents" sub="Deeds, agreements, IDs: attached to a property or lead" />
      <Err msg={err} />
      <Card className="p-5 mb-4">
        <form onSubmit={submit} className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="block text-xs text-ink-3">File
            <input name="file" type="file" required className="mt-1 w-full text-sm file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-accent-soft file:text-accent-text" />
          </label>
          <Select name="link" label="Attach to">
            <option value="">— none —</option>
            {props.data?.map((p) => <option key={p.id} value={`property:${p.id}`}>Property · {p.title}</option>)}
            {leads.data?.map((l) => <option key={l.id} value={`lead:${l.id}`}>Lead · {l.name}</option>)}
          </Select>
          <Btn type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</Btn>
        </form>
      </Card>
      {!docs.data?.length ? <Empty>No documents yet.</Empty> : (
        <Card className="divide-y divide-line">
          {docs.data.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-ink-3">{kb(d.size)} · {new Date(d.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.entityType && <Badge tone="info">{d.entityType}: {entityName(d.entityType, d.entityId) ?? "…"}</Badge>}
                <Btn kind="ghost" onClick={() => api.download(d).catch((x) => setErr(x.message))}>Download</Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
