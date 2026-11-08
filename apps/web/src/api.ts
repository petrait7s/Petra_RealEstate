import type { Property, Listing, Lead, Visit, Deal, Lease, RentInvoice, LeadStage, User, Doc, Task, Automation } from "@petra/domain";

const KEY = "petra.session";
export type Session = { token: string; user: Pick<User, "id" | "name" | "role" | "email"> };
export const getSession = (): Session | undefined => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? undefined; } catch { return undefined; }
};
export const setSession = (s?: Session) => {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* storage blocked */ }
};

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getSession()?.token;
  const r = await fetch(url, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && token) { setSession(undefined); location.reload(); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data as T;
}

export type Dashboard = {
  counts: Record<string, number>;
  overdue: { installments: number; installmentAmount: number; invoices: number; invoiceAmount: number };
  pipeline: Record<string, number>;
  sales: { collected: number; outstanding: number };
  rent: { collected: number; due: number };
};

export const api = {
  status: () => req<{ needsSetup: boolean }>("GET", "/v1/auth/status"),
  setup: (b: unknown) => req<Session>("POST", "/v1/auth/setup", b),
  login: (email: string, password: string) => req<Session>("POST", "/v1/auth/login", { email, password }),
  users: () => req<User[]>("GET", "/v1/users"),
  createUser: (b: unknown) => req<User>("POST", "/v1/users", b),
  tasks: () => req<Task[]>("GET", "/v1/tasks"),
  createTask: (title: string) => req<Task>("POST", "/v1/tasks", { title }),
  toggleTask: (id: string) => req<Task>("POST", `/v1/tasks/${id}/toggle`),
  automations: () => req<Automation[]>("GET", "/v1/automations"),
  createAutomation: (b: unknown) => req<Automation>("POST", "/v1/automations", b),
  toggleAutomation: (id: string) => req<Automation>("POST", `/v1/automations/${id}/toggle`),
  deleteAutomation: (id: string) => req<unknown>("DELETE", `/v1/automations/${id}`),
  documents: () => req<Doc[]>("GET", "/v1/documents"),
  upload: (b: unknown) => req<Doc>("POST", "/v1/documents", b),
  download: async (d: Doc) => {
    const r = await fetch(`/v1/documents/${d.id}/download`, { headers: { authorization: `Bearer ${getSession()?.token}` } });
    if (!r.ok) throw new Error("download failed");
    const url = URL.createObjectURL(await r.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: d.name });
    a.click(); URL.revokeObjectURL(url);
  },
  dashboard: () => req<Dashboard>("GET", "/v1/dashboard"),
  properties: () => req<Property[]>("GET", "/v1/properties"),
  createProperty: (b: unknown) => req<Property>("POST", "/v1/properties", b),
  listings: () => req<Listing[]>("GET", "/v1/listings"),
  createListing: (b: unknown) => req<Listing>("POST", "/v1/listings", b),
  leads: () => req<Lead[]>("GET", "/v1/leads"),
  createLead: (b: unknown) => req<Lead>("POST", "/v1/leads", b),
  moveLead: (id: string, stage: LeadStage) => req<Lead>("POST", `/v1/leads/${id}/stage`, { stage }),
  visits: () => req<Visit[]>("GET", "/v1/visits"),
  createVisit: (b: unknown) => req<Visit>("POST", "/v1/visits", b),
  setVisit: (id: string, status: string) => req<Visit>("POST", `/v1/visits/${id}/status`, { status }),
  deals: () => req<Deal[]>("GET", "/v1/deals"),
  createDeal: (b: unknown) => req<Deal>("POST", "/v1/deals", b),
  payInstallment: (d: string, i: string) => req<Deal>("POST", `/v1/deals/${d}/installments/${i}/pay`),
  leases: () => req<Lease[]>("GET", "/v1/leases"),
  createLease: (b: unknown) => req<Lease>("POST", "/v1/leases", b),
  invoices: () => req<RentInvoice[]>("GET", "/v1/leases/invoices"),
  genInvoice: (leaseId: string, month: string) => req<RentInvoice>("POST", `/v1/leases/${leaseId}/invoices`, { month }),
  payInvoice: (id: string) => req<RentInvoice>("POST", `/v1/leases/invoices/${id}/pay`),
};
