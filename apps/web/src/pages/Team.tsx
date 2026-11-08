import { useState } from "react";
import { api } from "../api";
import { Badge, Btn, Card, Drawer, Err, Input, PageHead, Select, formVals, useLoad } from "../ui";

export default function Team() {
  const users = useLoad(api.users);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string>();
  const add = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try { await api.createUser(formVals(e.currentTarget)); setOpen(false); setErr(undefined); users.reload(); }
    catch (x) { setErr((x as Error).message); }
  };
  return (
    <>
      <PageHead title="Team" sub="Owner: everything. Manager: everything except team. Agent: leads, visits, documents." action={<Btn onClick={() => setOpen(true)}>Add member</Btn>} />
      <Card className="divide-y divide-line">
        {users.data?.map((u) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div><div className="text-sm font-medium">{u.name}</div><div className="text-xs text-ink-3">{u.email}</div></div>
            <Badge tone={u.role === "owner" ? "ok" : u.role === "manager" ? "info" : "mute"}>{u.role}</Badge>
          </div>
        ))}
      </Card>
      <Drawer open={open} title="Add member" onClose={() => setOpen(false)}>
        <form onSubmit={add} className="space-y-3">
          <Err msg={err} />
          <Input name="name" label="Name" required /><Input name="email" type="email" label="Email" required />
          <Select name="role" label="Role"><option value="agent">Agent</option><option value="manager">Manager</option><option value="owner">Owner</option></Select>
          <Input name="password" type="password" minLength={6} label="Temporary password (min 6)" required />
          <Btn type="submit" className="w-full">Create</Btn>
        </form>
      </Drawer>
    </>
  );
}
