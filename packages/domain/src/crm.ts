import { z } from "zod";
import { Money } from "./money.js";

export const LeadStage = z.enum(["new", "contacted", "site_visit", "negotiation", "won", "lost"]);
export type LeadStage = z.infer<typeof LeadStage>;

export const Lead = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().default("manual"),
  stage: LeadStage.default("new"),
  assigneeId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  budget: Money.optional(),
});
export type Lead = z.infer<typeof Lead>;

/** Allowed stage transitions (state machine). */
const NEXT: Record<LeadStage, LeadStage[]> = {
  new: ["contacted", "lost"],
  contacted: ["site_visit", "negotiation", "lost"],
  site_visit: ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won: [],
  lost: ["new"],
};
export const canTransition = (from: LeadStage, to: LeadStage) => NEXT[from].includes(to);
