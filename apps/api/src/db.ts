import type { Property, Listing, Lead, Visit, Deal, Lease, RentInvoice, User, Doc, Task, Automation } from "@petra/domain";
import { Collection } from "./store.js";

export type UserRow = User & { passHash: string };

export const db = {
  users: new Collection<UserRow>("users"),
  properties: new Collection<Property>("properties"),
  listings: new Collection<Listing>("listings"),
  leads: new Collection<Lead>("leads"),
  visits: new Collection<Visit>("visits"),
  deals: new Collection<Deal>("deals"),
  leases: new Collection<Lease>("leases"),
  invoices: new Collection<RentInvoice>("invoices"),
  docs: new Collection<Doc>("docs"),
  tasks: new Collection<Task>("tasks"),
  automations: new Collection<Automation>("automations"),
};
export const resetDb = () => Object.values(db).forEach((c) => c.clear());
