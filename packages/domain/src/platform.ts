import { z } from "zod";

export const Role = z.enum(["owner", "manager", "agent"]);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: Role,
});
export type User = z.infer<typeof User>;

export const Doc = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  mime: z.string(),
  size: z.number().int().nonnegative(),
  entityType: z.enum(["property", "lead", "deal", "lease"]).optional(),
  entityId: z.string().uuid().optional(),
  uploadedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type Doc = z.infer<typeof Doc>;

export const Task = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string().min(1),
  done: z.boolean().default(false),
  source: z.string().default("manual"),
  createdAt: z.string().datetime(),
});
export type Task = z.infer<typeof Task>;

export const AutomationTrigger = z.enum(["lead.created", "lead.stage", "visit.done", "deal.created", "installment.paid", "invoice.created"]);
export type AutomationTrigger = z.infer<typeof AutomationTrigger>;

/** trigger + optional stage match -> create a task. Title supports {name} and {stage}. */
export const Automation = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1),
  trigger: AutomationTrigger,
  stage: z.string().optional(),
  taskTitle: z.string().min(1),
  enabled: z.boolean().default(true),
});
export type Automation = z.infer<typeof Automation>;

export const renderTemplate = (tpl: string, vars: Record<string, string | undefined>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
