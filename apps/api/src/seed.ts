import { randomUUID as id } from "node:crypto";
import { splitInstallments, type Deal, type LeadStage } from "@petra/domain";
import { db } from "./db.js";
import { tx } from "./store.js";
import { createUser } from "./modules/auth/routes.js";
import { removeDocFile } from "./modules/documents/routes.js";

export const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";
export const DEMO_PASSWORD = "petra123";

/** Collections that hold business data (cleared by "clear data"). Users and automation rules are configuration, kept. */
export const BUSINESS = ["properties", "listings", "leads", "visits", "deals", "leases", "invoices", "docs", "tasks"] as const;

export function businessCounts(t: string): Record<(typeof BUSINESS)[number], number> {
  return Object.fromEntries(BUSINESS.map((k) => [k, db[k].list(t).length])) as never;
}
export const isEmpty = (t: string) => Object.values(businessCounts(t)).every((n) => n === 0);

/** Tombstone every business record of the tenant (sync-safe), and drop uploaded files. */
export function clearBusiness(t: string) {
  tx(() => {
    for (const d of db.docs.list(t)) removeDocFile(d.id);
    for (const k of BUSINESS) for (const r of db[k].list(t)) db[k].remove(t, r.id);
  });
}

const DAY = 86400000;
const bdt = (taka: number) => ({ amount: Math.round(taka * 100), currency: "BDT" });
const monthOf = (offset: number) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 7); };
const dealStatus = (d: Deal): Deal["status"] => {
  const paid = d.installments.filter((i) => i.paidAt).length;
  return paid === 0 ? "booking" : paid === d.installments.length ? "completed" : "paying";
};

export function ensureDefaultRules(t: string) {
  if (db.automations.list(t).length) return;
  const rule = (name: string, trigger: "lead.created" | "lead.stage" | "deal.created" | "invoice.created", taskTitle: string, stage?: string) =>
    db.automations.add({ id: id(), tenantId: t, name, trigger, taskTitle, stage, enabled: true });
  rule("Follow up new lead", "lead.created", "Call {name} within 24h");
  rule("Book visit", "lead.stage", "Schedule site visit for {name}", "site_visit");
  rule("Prepare agreement", "deal.created", "Prepare booking agreement for {name}");
  rule("Send rent invoice", "invoice.created", "Send {stage} rent invoice to {name}");
}

/** Realistic Bangladesh demo data. Direct inserts: no events, so no automation tasks are generated. */
export function seedBusiness(t: string) {
  ensureDefaultRules(t);
  const P = (type: string, title: string, address: string, areaSqft?: number, bedrooms?: number, bathrooms?: number) =>
    db.properties.add({ id: id(), tenantId: t, type, title, address, areaSqft, bedrooms, bathrooms, attributes: {} } as never);
  const p = {
    lake: P("apartment", "Lakeview Residency, 8B", "Sector 7, Uttara, Dhaka", 1450, 3, 3),
    green: P("apartment", "Green Court, 4A", "Block C, Bashundhara R/A, Dhaka", 1200, 3, 2),
    plot: P("plot", "Plot 12, Block C", "Purbachal New Town, Dhaka", 3600),
    shop: P("commercial", "Shop 3, Zindabazar Arcade", "Zindabazar, Sylhet", 520),
    sky: P("apartment", "Skyline Heights, 12C", "GEC Circle, Chattogram", 1650, 4, 3),
    nest: P("apartment", "Nest Apartments, 2B", "Mirpur DOHS, Dhaka", 980, 2, 2),
    villa: P("house", "Rose Villa", "Shahjalal Upashahar, Sylhet", 2800, 5, 4),
    office: P("commercial", "Office 5F, Trade Tower", "Motijheel, Dhaka", 1100),
    land: P("land", "12 Katha Land, Savar", "Savar, Dhaka", 8640),
    flat: P("apartment", "Palm Garden, 6A", "Dhanmondi 27, Dhaka", 1350, 3, 2),
  };
  const L = (property: { id: string }, kind: "sale" | "rent", taka: number, status: "draft" | "active" | "reserved" | "closed" = "active") =>
    db.listings.add({ id: id(), tenantId: t, propertyId: property.id, kind, status, price: bdt(taka) });
  const ls = {
    lake: L(p.lake, "sale", 14500000), green: L(p.green, "rent", 38000), plot: L(p.plot, "sale", 9800000), shop: L(p.shop, "rent", 45000, "draft"),
    sky: L(p.sky, "sale", 17800000), nest: L(p.nest, "rent", 28000), villa: L(p.villa, "sale", 32000000, "reserved"), office: L(p.office, "rent", 85000),
    land: L(p.land, "sale", 6400000), flat: L(p.flat, "sale", 15200000),
  };

  const lead = (name: string, stage: LeadStage, budget: number, source: string, phone: string) =>
    db.leads.add({ id: id(), tenantId: t, name, stage, source, phone, budget: bdt(budget) });
  const l = {
    rahim: lead("Rahim Uddin", "negotiation", 15000000, "facebook", "01711000001"),
    nusrat: lead("Nusrat Jahan", "new", 8000000, "website", "01711000002"),
    karim: lead("Karim Hossain", "site_visit", 10000000, "referral", "01711000003"),
    sadia: lead("Sadia Islam", "contacted", 12000000, "facebook", "01711000004"),
    tanvir: lead("Tanvir Ahmed", "won", 14500000, "referral", "01711000005"),
    farhana: lead("Farhana Akter", "site_visit", 17000000, "walk-in", "01711000006"),
    jamal: lead("Jamal Chowdhury", "negotiation", 30000000, "referral", "01711000007"),
    mitu: lead("Mitu Rahman", "new", 9000000, "facebook", "01711000008"),
    sohel: lead("Sohel Rana", "contacted", 6500000, "website", "01711000009"),
    ayesha: lead("Ayesha Siddika", "won", 9800000, "facebook", "01711000010"),
    imran: lead("Imran Hasan", "lost", 12000000, "walk-in", "01711000011"),
    lipi: lead("Lipi Begum", "new", 30000, "website", "01711000012"),
    shahin: lead("Shahin Alam", "contacted", 15000000, "referral", "01711000013"),
    rubel: lead("Rubel Mia", "won", 6400000, "facebook", "01711000014"),
  };

  const V = (lead: { id: string }, listing: { id: string }, days: number, status: "scheduled" | "done" | "cancelled", notes?: string) =>
    db.visits.add({ id: id(), tenantId: t, leadId: lead.id, listingId: listing.id, scheduledAt: new Date(Date.now() + days * DAY).toISOString(), status, notes });
  V(l.karim, ls.plot, 1, "scheduled"); V(l.farhana, ls.sky, 2, "scheduled"); V(l.sadia, ls.flat, 4, "scheduled", "Wants evening slot");
  V(l.rahim, ls.lake, -3, "done"); V(l.jamal, ls.villa, -5, "done"); V(l.imran, ls.flat, -9, "cancelled");

  const deal = (lead: { id: string }, listing: { id: string }, price: number, n: number, firstOffsetMonths: number, paid: number) => {
    const first = new Date(); first.setUTCMonth(first.getUTCMonth() + firstOffsetMonths);
    const d: Deal = {
      id: id(), tenantId: t, leadId: lead.id, listingId: listing.id, price: bdt(price), status: "booking",
      installments: splitInstallments(bdt(price), n, first, id), createdAt: new Date(Date.now() - 60 * DAY).toISOString(),
    };
    d.installments.slice(0, paid).forEach((i) => { i.paidAt = new Date(Date.now() - 20 * DAY).toISOString(); });
    d.status = dealStatus(d);
    return db.deals.add(d);
  };
  deal(l.rahim, ls.lake, 14500000, 6, -3, 2);   // 3rd installment overdue
  deal(l.ayesha, ls.plot, 9800000, 4, -2, 1);   // paying, 2nd overdue
  deal(l.rubel, ls.land, 6400000, 1, -2, 1);    // completed
  deal(l.tanvir, ls.flat, 15200000, 8, 0, 0);   // just booked

  const lease = (prop: { id: string }, occupant: string, rent: number, dueDay: number, start: string) =>
    db.leases.add({ id: id(), tenantId: t, propertyId: prop.id, occupant, rent: bdt(rent), startDate: start, dueDay });
  const leases = [lease(p.green, "Mahmud Hasan", 38000, 5, "2026-01-01"), lease(p.nest, "Rokeya Khatun", 28000, 10, "2026-02-01"), lease(p.office, "Delta Traders", 85000, 7, "2025-11-01")];
  const unpaid = new Set(["1:-1", "2:0"]); // lease index : month offset
  leases.forEach((ls_, i) => [-2, -1, 0].forEach((off) =>
    db.invoices.add({ id: id(), tenantId: t, leaseId: ls_.id, month: monthOf(off), amount: ls_.rent, paidAt: unpaid.has(`${i}:${off}`) ? undefined : new Date(Date.now() + off * 30 * DAY).toISOString() })));

  const task = (title: string, done = false, source = "manual") => db.tasks.add({ id: id(), tenantId: t, title, done, source, createdAt: new Date().toISOString() });
  task("Collect pending installment from Rahim Uddin");
  task("Call Nusrat Jahan within 24h", false, "Follow up new lead");
  task("Schedule site visit for Farhana Akter", false, "Book visit");
  task("Send rent reminder to Rokeya Khatun");
  task("Upload signed agreement for Plot 12", true);
}

/** Dev bootstrap: demo users + demo data. Never used for real installs (SEED=0). */
export function seed(t = DEMO_TENANT) {
  createUser(t, "owner@petra.test", "Petra Owner", "owner", DEMO_PASSWORD);
  createUser(t, "manager@petra.test", "Project Manager", "manager", DEMO_PASSWORD);
  createUser(t, "agent@petra.test", "Field Agent", "agent", DEMO_PASSWORD);
  seedBusiness(t);
}
