import type { Property, Listing, Lead, Visit, Deal, Lease, RentInvoice } from "@petra/domain";
import { Collection } from "./store.js";

export const db = {
  properties: new Collection<Property>(),
  listings: new Collection<Listing>(),
  leads: new Collection<Lead>(),
  visits: new Collection<Visit>(),
  deals: new Collection<Deal>(),
  leases: new Collection<Lease>(),
  invoices: new Collection<RentInvoice>(),
};
export const resetDb = () => Object.values(db).forEach((c) => c.clear());
