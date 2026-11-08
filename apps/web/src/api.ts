import type { Property, Listing, Lead, Visit, Deal, Lease, RentInvoice, LeadStage } from "@petra/domain";

const TENANT = "11111111-1111-1111-1111-111111111111"; // demo tenant until auth lands

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "x-tenant-id": TENANT, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data as T;
}

export type Dashboard = {
  counts: Record<string, number>;
  pipeline: Record<string, number>;
  sales: { collected: number; outstanding: number };
  rent: { collected: number; due: number };
};

export const api = {
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
