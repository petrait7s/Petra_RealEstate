import { useState } from "react";
import type { AutomationTrigger } from "@petra/domain";
import { api, getSession } from "../api";
import { Badge, Btn, Card, Drawer, Empty, Err, Input, PageHead, Select, formVals, useLoad } from "../ui";

const triggers: [AutomationTrigger, string][] = [
  ["lead.created", "Lead created"], ["lead.stage", "Lead stage changes"], ["visit.done", "Visit completed"],
  ["deal.created", "Deal created"], ["installment.paid", "Installment paid"], ["invoice.created", "Rent invoice created"],
];

export default function Tasks() {
  const tasks = useLoad(api.tasks);
  const rules = useLoad(api.automations);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string>();
  const canRules = getSession()?.user.role !== "agent";
  const run = (fn: () => Promise<unknown>) => async () => { try { await fn(); setErr(undefined); tasks.reload(); rules.reload(); } catch (x) { setErr((x as Error).message); } };

  const addTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    await run(() => api.createTask(formVals(form).title))();
    form.reset();
  };
  const addRule = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = formVals(e.currentTarget);
    try {
      await api.createAutomation({ name: f.name, trigger: f.trigger, stage: f.stage || undefined, taskTitle: f.taskTitle });
      setOpen(false); setErr(undefined); rules.reload();
    } catch (x) { setErr((x as Error).message); }
  };
  const open_ = tasks.data?.filter((t) => !t.done) ?? [];
  const done = tasks.data?.filter((t) => t.done) ?? [];

  return (
    <>
      <PageHead title="Tasks & automation" sub="Rules create tasks when things happen" />
      <Err msg={err} />
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3">Tasks</h2>
          <form onSubmit={addTask} className="flex gap-2 mb-4">
            <input name="title" required placeholder="Add a task…" className="flex-1 px-3 py-2 rounded-xl border border-line text-sm focus:border-accent outline-none" />
            <Btn type="submit">Add</Btn>
          </form>
          {!tasks.data?.length && <Empty>Nothing to do.</Empty>}
          <div className="space-y-1.5">
            {[...open_, ...done].map((t) => (
              <label key={t.id} className="flex items-start gap-3 text-sm bg-page rounded-xl px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={t.done} onChange={run(() => api.toggleTask(t.id))} className="mt-0.5 accent-[#038d91]" />
                <span className={`flex-1 ${t.done ? "line-through text-ink-3" : ""}`}>{t.title}</span>
                {t.source !== "manual" && <Badge tone="info">{t.source}</Badge>}
              </label>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold">Automation rules</h2>
            {canRules && <Btn kind="ghost" onClick={() => setOpen(true)}>New rule</Btn>}
          </div>
          {!rules.data?.length && <Empty>No rules.</Empty>}
          <div className="space-y-2">
            {rules.data?.map((r) => (
              <div key={r.id} className="bg-page rounded-xl px-3 py-2.5 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <Badge tone={r.enabled ? "ok" : "mute"}>{r.enabled ? "on" : "off"}</Badge>
                </div>
                <div className="text-xs text-ink-3 mt-1">When {triggers.find(([k]) => k === r.trigger)?.[1].toLowerCase()}{r.stage && ` → ${r.stage}`}: “{r.taskTitle}”</div>
                {canRules && (
                  <div className="flex gap-3 mt-2 text-xs">
                    <button className="text-accent-text" onClick={run(() => api.toggleAutomation(r.id))}>{r.enabled ? "Turn off" : "Turn on"}</button>
                    <button className="text-bad" onClick={run(() => api.deleteAutomation(r.id))}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Drawer open={open} title="New rule" onClose={() => setOpen(false)}>
        <form onSubmit={addRule} className="space-y-3">
          <Err msg={err} />
          <Input name="name" label="Name" required />
          <Select name="trigger" label="When">{triggers.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <Input name="stage" label="Only if stage / value is (optional)" placeholder="e.g. site_visit" />
          <Input name="taskTitle" label="Create task" placeholder="Call {name}" required />
          <p className="text-xs text-ink-3">Use {"{name}"} and {"{stage}"} in the task text.</p>
          <Btn type="submit" className="w-full">Save</Btn>
        </form>
      </Drawer>
    </>
  );
}
