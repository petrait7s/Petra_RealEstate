import { z } from "zod";
import { Money } from "./money.js";

export const Visit = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  leadId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  status: z.enum(["scheduled", "done", "cancelled"]).default("scheduled"),
  notes: z.string().optional(),
});
export type Visit = z.infer<typeof Visit>;

export const Installment = z.object({
  id: z.string().uuid(),
  dueDate: z.string(),
  amount: Money,
  paidAt: z.string().datetime().optional(),
});
export type Installment = z.infer<typeof Installment>;

export const DealStatus = z.enum(["booking", "paying", "completed", "cancelled"]);
export const Deal = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  leadId: z.string().uuid(),
  listingId: z.string().uuid(),
  price: Money,
  status: DealStatus,
  installments: z.array(Installment),
  createdAt: z.string().datetime(),
});
export type Deal = z.infer<typeof Deal>;

export const Lease = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  occupant: z.string().min(1),
  rent: Money,
  startDate: z.string(),
  dueDay: z.number().int().min(1).max(28).default(5),
});
export type Lease = z.infer<typeof Lease>;

export const RentInvoice = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  leaseId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: Money,
  paidAt: z.string().datetime().optional(),
});
export type RentInvoice = z.infer<typeof RentInvoice>;

/** Split price into n equal monthly installments; remainder goes to the first. */
export function splitInstallments(total: Money, n: number, firstDue: Date, newId: () => string): Installment[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("n must be >= 1");
  const base = Math.floor(total.amount / n);
  const rem = total.amount - base * n;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(firstDue);
    d.setUTCMonth(d.getUTCMonth() + i);
    return { id: newId(), dueDate: d.toISOString().slice(0, 10), amount: { amount: base + (i === 0 ? rem : 0), currency: total.currency } };
  });
}
