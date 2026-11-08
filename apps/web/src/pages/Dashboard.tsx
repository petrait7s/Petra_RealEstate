import { Link } from "react-router-dom";
import { api, getSession } from "../api";
import { Card, Err, PageHead, taka, useLoad } from "../ui";

const stageLabel: Record<string, string> = { new: "New", contacted: "Contacted", site_visit: "Site visit", negotiation: "Negotiation", won: "Won", lost: "Lost" };

export default function Dashboard() {
  const { data, error } = useLoad(api.dashboard);
  if (!data) return <Err msg={error ?? "Loading…"} />;
  const c = data.counts;
  const empty = c.properties + c.leads + c.deals + c.leases === 0;
  const stats = [
    ["Properties", c.properties], ["Active listings", c.activeListings], ["Leads", c.leads],
    ["Visits scheduled", c.upcomingVisits], ["Deals", c.deals], ["Open tasks", c.openTasks],
  ];
  const max = Math.max(1, ...Object.values(data.pipeline));
  const money = [
    ["Sales collected", data.sales.collected, "text-ok"], ["Sales outstanding", data.sales.outstanding, "text-warn"],
    ["Rent collected", data.rent.collected, "text-ok"], ["Rent due", data.rent.due, "text-warn"],
  ] as const;
  return (
    <>
      <PageHead title="Overview" sub="Where the business stands today" />
      {empty && (
        <Card className="p-6 mb-4 bg-accent-soft/60 border-accent/30">
          <h2 className="font-semibold">Nothing here yet</h2>
          <p className="text-sm text-ink-2 mt-1">Add your first property or lead, or fill the app with sample data to look around.</p>
          <div className="flex gap-2 mt-4">
            <Link to="/properties" className="px-4 py-2 rounded-xl text-sm font-medium bg-accent text-white">Add property</Link>
            {getSession()?.user.role !== "agent" && <Link to="/settings" className="px-4 py-2 rounded-xl text-sm font-medium border border-line bg-white text-ink-2">Load demo data</Link>}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {stats.map(([k, v]) => (
          <Card key={k} className="p-5"><div className="text-3xl font-semibold">{v}</div><div className="text-xs text-ink-3 mt-1">{k}</div></Card>
        ))}
      </div>
      {(data.overdue.installments > 0 || data.overdue.invoices > 0) && (
        <Card className="p-5 mb-3 border-bad/40 bg-bad/5">
          <h2 className="text-sm font-semibold text-bad mb-1">Overdue</h2>
          <p className="text-sm text-ink-2">
            {data.overdue.installments > 0 && <>{data.overdue.installments} sale installment(s), {taka(data.overdue.installmentAmount)}. </>}
            {data.overdue.invoices > 0 && <>{data.overdue.invoices} rent invoice(s), {taka(data.overdue.invoiceAmount)}.</>}
          </p>
        </Card>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4">Pipeline</h2>
          <div className="space-y-3">
            {Object.entries(stageLabel).map(([k, label]) => (
              <div key={k}>
                <div className="flex justify-between text-xs text-ink-3 mb-1"><span>{label}</span><span>{data.pipeline[k] ?? 0}</span></div>
                <div className="h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-accent" style={{ width: `${((data.pipeline[k] ?? 0) / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4">Money</h2>
          <div className="grid grid-cols-2 gap-5">
            {money.map(([k, v, tone]) => (
              <div key={k}><div className={`text-xl font-semibold ${tone}`}>{taka(v)}</div><div className="text-xs text-ink-3 mt-1">{k}</div></div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
