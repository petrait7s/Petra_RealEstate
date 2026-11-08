import type { FastifyPluginAsync } from "fastify";
import { db } from "../../db.js";
import { tid } from "../../store.js";

export const dashboardModule: FastifyPluginAsync = async (app) => {
  app.get("/", async (req) => {
    const t = tid(req);
    const today = new Date().toISOString().slice(0, 10);
    const leads = db.leads.list(t);
    const deals = db.deals.list(t).filter((d) => d.status !== "cancelled");
    const insts = deals.flatMap((d) => d.installments);
    const sum = (xs: { amount: { amount: number } }[]) => xs.reduce((s, x) => s + x.amount.amount, 0);
    const invoices = db.invoices.list(t);
    const leases = db.leases.list(t);
    const stages: Record<string, number> = {};
    for (const l of leads) stages[l.stage] = (stages[l.stage] ?? 0) + 1;
    const overdueInst = insts.filter((i) => !i.paidAt && i.dueDate < today);
    const overdueInv = invoices.filter((i) => {
      const day = String(leases.find((l) => l.id === i.leaseId)?.dueDay ?? 5).padStart(2, "0");
      return !i.paidAt && `${i.month}-${day}` < today;
    });
    return {
      counts: {
        properties: db.properties.list(t).length,
        activeListings: db.listings.list(t).filter((l) => l.status === "active").length,
        leads: leads.length,
        upcomingVisits: db.visits.list(t).filter((v) => v.status === "scheduled").length,
        deals: deals.length,
        leases: leases.length,
        openTasks: db.tasks.list(t).filter((x) => !x.done).length,
        documents: db.docs.list(t).length,
      },
      pipeline: stages,
      sales: { collected: sum(insts.filter((i) => i.paidAt)), outstanding: sum(insts.filter((i) => !i.paidAt)) },
      rent: { collected: sum(invoices.filter((i) => i.paidAt)), due: sum(invoices.filter((i) => !i.paidAt)) },
      overdue: { installments: overdueInst.length, installmentAmount: sum(overdueInst), invoices: overdueInv.length, invoiceAmount: sum(overdueInv) },
    };
  });
};
