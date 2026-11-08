import { randomUUID as id } from "node:crypto";
import { splitInstallments } from "@petra/domain";
import { db } from "./db.js";
import { createUser } from "./modules/auth/routes.js";

export const DEMO_TENANT = "11111111-1111-1111-1111-111111111111";
export const DEMO_PASSWORD = "petra123";

export function seed(t = DEMO_TENANT) {
  createUser(t, "owner@petra.test", "Petra Owner", "owner", DEMO_PASSWORD);
  createUser(t, "manager@petra.test", "Project Manager", "manager", DEMO_PASSWORD);
  createUser(t, "agent@petra.test", "Field Agent", "agent", DEMO_PASSWORD);

  const rule = (name: string, trigger: never, taskTitle: string, stage?: string) =>
    db.automations.add({ id: id(), tenantId: t, name, trigger, taskTitle, stage, enabled: true });
  rule("Follow up new lead", "lead.created" as never, "Call {name} within 24h");
  rule("Book visit", "lead.stage" as never, "Schedule site visit for {name}", "site_visit");
  rule("Prepare agreement", "deal.created" as never, "Prepare booking agreement for {name}");
  rule("Send rent invoice", "invoice.created" as never, "Send {stage} rent invoice to {name}");

  const bdt = (taka: number) => ({ amount: taka * 100, currency: "BDT" });
  const props = [
    { type: "apartment", title: "Lakeview Residency, 8B", address: "Uttara, Dhaka", areaSqft: 1450, bedrooms: 3, bathrooms: 3 },
    { type: "apartment", title: "Green Court, 4A", address: "Bashundhara R/A, Dhaka", areaSqft: 1200, bedrooms: 3, bathrooms: 2 },
    { type: "plot", title: "Plot 12, Block C", address: "Purbachal, Dhaka", areaSqft: 3600 },
    { type: "commercial", title: "Shop 3, Zindabazar Arcade", address: "Zindabazar, Sylhet", areaSqft: 520 },
  ].map((p) => db.properties.add({ ...p, id: id(), tenantId: t, attributes: {} } as never));
  const [a, b, c, d] = props;
  const sale = db.listings.add({ id: id(), tenantId: t, propertyId: a.id, kind: "sale", status: "active", price: bdt(14500000) });
  db.listings.add({ id: id(), tenantId: t, propertyId: b.id, kind: "rent", status: "active", price: bdt(38000) });
  db.listings.add({ id: id(), tenantId: t, propertyId: c.id, kind: "sale", status: "active", price: bdt(9800000) });
  db.listings.add({ id: id(), tenantId: t, propertyId: d.id, kind: "rent", status: "draft", price: bdt(45000) });
  const mk = (name: string, stage: "new" | "contacted" | "site_visit" | "negotiation" | "won", budget: number, source = "facebook") =>
    db.leads.add({ id: id(), tenantId: t, name, stage, source, phone: "01700000000", budget: bdt(budget) });
  const l1 = mk("Rahim Uddin", "negotiation", 15000000);
  mk("Nusrat Jahan", "new", 8000000, "website");
  const l3 = mk("Karim Hossain", "site_visit", 10000000, "referral");
  mk("Sadia Islam", "contacted", 12000000);
  mk("Tanvir Ahmed", "won", 14500000, "referral");
  db.visits.add({ id: id(), tenantId: t, leadId: l3.id, listingId: sale.id, scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: "scheduled" });
  db.visits.add({ id: id(), tenantId: t, leadId: l1.id, listingId: sale.id, scheduledAt: new Date(Date.now() - 86400000).toISOString(), status: "done" });
  const first = new Date(); first.setUTCMonth(first.getUTCMonth() - 2);
  const deal = db.deals.add({
    id: id(), tenantId: t, leadId: l1.id, listingId: sale.id, price: bdt(14500000), status: "booking",
    installments: splitInstallments(bdt(14500000), 6, first, id), createdAt: new Date().toISOString(),
  });
  deal.installments[0].paidAt = new Date().toISOString();
  deal.status = "paying";
  db.deals.save(deal); // installments 2 and 3 are overdue by construction
  const lease = db.leases.add({ id: id(), tenantId: t, propertyId: b.id, occupant: "Mahmud Hasan", rent: bdt(38000), startDate: "2026-01-01", dueDay: 5 });
  db.invoices.add({ id: id(), tenantId: t, leaseId: lease.id, month: new Date().toISOString().slice(0, 7), amount: lease.rent });
  db.tasks.add({ id: id(), tenantId: t, title: "Collect pending installment from Rahim Uddin", done: false, source: "manual", createdAt: new Date().toISOString() });
}
