import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Leads from "./pages/Leads";
import Visits from "./pages/Visits";
import Deals from "./pages/Deals";
import Rentals from "./pages/Rentals";

const nav = [
  ["/", "Overview"], ["/properties", "Properties"], ["/leads", "Pipeline"],
  ["/visits", "Visits"], ["/deals", "Deals"], ["/rentals", "Rentals"],
] as const;

export default function App() {
  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 bg-stage text-white p-5 hidden md:flex flex-col">
        <div className="flex items-center gap-2.5 mb-10">
          <span className="w-8 h-8 rounded-lg bg-accent grid place-items-center font-bold">P</span>
          <div className="leading-tight"><div className="font-semibold tracking-wide">PETRA</div><div className="text-[11px] text-glow">Real Estate OS</div></div>
        </div>
        <nav className="space-y-1">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) => `block px-3 py-2 rounded-xl text-sm transition ${isActive ? "bg-white/10 text-glow" : "text-white/70 hover:text-white hover:bg-white/5"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <nav className="md:hidden flex gap-1 overflow-x-auto bg-stage p-2">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${isActive ? "bg-white/10 text-glow" : "text-white/70"}`}>{label}</NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-auto p-5 md:p-10 max-w-6xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/visits" element={<Visits />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/rentals" element={<Rentals />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
