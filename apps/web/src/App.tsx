import { useState } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { getSession, setSession, type Session } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Leads from "./pages/Leads";
import Visits from "./pages/Visits";
import Deals from "./pages/Deals";
import Rentals from "./pages/Rentals";
import Documents from "./pages/Documents";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";

const nav = [
  ["/", "Overview"], ["/properties", "Properties"], ["/leads", "Pipeline"], ["/visits", "Visits"],
  ["/deals", "Deals"], ["/rentals", "Rentals"], ["/documents", "Documents"], ["/tasks", "Tasks"], ["/team", "Team"],
] as const;

export default function App() {
  const [session, setS] = useState<Session | undefined>(getSession());
  if (!session) return <Login onLogin={setS} />;
  const items = nav.filter(([to]) => to !== "/team" || session.user.role === "owner");
  const logout = () => { setSession(undefined); setS(undefined); };
  const link = (mobile: boolean) => ({ isActive }: { isActive: boolean }) =>
    mobile
      ? `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${isActive ? "bg-white/10 text-glow" : "text-white/70"}`
      : `block px-3 py-2 rounded-xl text-sm transition ${isActive ? "bg-white/10 text-glow" : "text-white/70 hover:text-white hover:bg-white/5"}`;
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 bg-stage text-white p-5 hidden md:flex flex-col">
        <div className="flex items-center gap-2.5 mb-10">
          <span className="w-8 h-8 rounded-lg bg-accent grid place-items-center font-bold">P</span>
          <div className="leading-tight"><div className="font-semibold tracking-wide">PETRA</div><div className="text-[11px] text-glow">Real Estate OS</div></div>
        </div>
        <nav className="space-y-1 flex-1">
          {items.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={link(false)}>{label}</NavLink>)}
        </nav>
        <div className="border-t border-white/10 pt-4 text-xs">
          <div className="text-white/90">{session.user.name}</div>
          <div className="text-white/50 mb-2">{session.user.role}</div>
          <button onClick={logout} className="text-glow hover:underline">Sign out</button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <nav className="md:hidden flex gap-1 overflow-x-auto bg-stage p-2 items-center">
          {items.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={link(true)}>{label}</NavLink>)}
          <button onClick={logout} className="ml-auto px-3 text-sm text-glow">Out</button>
        </nav>
        <main className="flex-1 overflow-auto p-5 md:p-10 max-w-6xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/rentals" element={<Rentals />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/team" element={session.user.role === "owner" ? <Team /> : <Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
