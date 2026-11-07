import {
  LayoutDashboard,
  Calendar,
  Wallet,
  MessageSquare,
  Calculator,
  Bell,
  Settings,
  Plane,
  Lock,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Ticket,
  Search,
  Filter,
} from "lucide-react";

export function AppMockupPreview() {
  const sidebarItems = [
    { name: "Dashboard", icon: LayoutDashboard, active: true },
    { name: "Bookings", icon: Calendar, active: false },
    { name: "Accounts", icon: Wallet, active: false },
    { name: "Queries & Quotes", icon: MessageSquare, active: false },
    { name: "Umrah Calculator", icon: Calculator, active: false },
    { name: "Notifications", icon: Bell, active: false, badge: "3" },
    { name: "Settings", icon: Settings, active: false },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-slate-700/80 bg-slate-950/90 shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-xl transition-all duration-300 hover:border-[#d4af37]/40">
      {/* Browser Chrome / Header Bar */}
      <div className="h-10 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4 select-none">
        {/* Window controls */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>

        {/* Address Bar */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 font-mono max-w-xs sm:max-w-md w-full justify-center">
          <Lock className="w-3 h-3 text-[#d4af37]" />
          <span className="text-slate-300">app.tamspro.online</span>
          <span className="text-slate-500 hidden sm:inline">/app/dashboard</span>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">Cloud Synced</span>
        </div>
      </div>

      {/* App Workspace Simulation */}
      <div className="flex flex-col md:flex-row min-h-[440px] text-slate-200">
        {/* Real App Sidebar (HTML/CSS) */}
        <aside className="w-full md:w-56 bg-[#08121f] border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 flex flex-col justify-between shrink-0">
          <div>
            {/* Agency Brand Head in Sidebar */}
            <div className="flex items-center gap-2.5 px-2 py-2 mb-4 border-b border-slate-800/80 pb-3">
              <div className="w-8 h-8 rounded-lg bg-[#0b192c] border border-[#d4af37]/40 flex items-center justify-center shrink-0">
                <Plane className="w-4 h-4 text-[#d4af37]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Al-Harmain Premier</div>
                <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Agency Manager</div>
              </div>
            </div>

            {/* Exactly the 7 real navigation items */}
            <div className="space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      item.active
                        ? "bg-[#12243d] text-white border-l-2 border-[#d4af37] font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-3.5 h-3.5 ${item.active ? "text-[#d4af37]" : "text-slate-400"}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick System Badge */}
          <div className="hidden md:block pt-3 border-t border-slate-800/80 text-[10px] text-slate-500">
            <div className="flex items-center justify-between">
              <span>Database RLS</span>
              <span className="text-emerald-400 font-mono">Isolated</span>
            </div>
          </div>
        </aside>

        {/* Dashboard Main Canvas */}
        <main className="flex-1 p-4 sm:p-5 bg-slate-950/70 overflow-x-auto space-y-4">
          {/* Top Bar inside App */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Business Overview & Operations
              </h3>
              <p className="text-[11px] text-slate-400">
                Live performance for current fiscal month • Auto-reconciled
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono">
                Nov 2026
              </span>
              <div className="px-2.5 py-1 rounded-md bg-[#d4af37]/15 border border-[#d4af37]/30 text-[11px] font-semibold text-[#d4af37] flex items-center gap-1">
                <span>+ New Booking</span>
              </div>
            </div>
          </div>

          {/* 4 Real KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Total Bookings
              </div>
              <div className="text-base sm:text-lg font-bold text-white font-mono">142</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>+14 this week</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                B2B Agent Balance
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-300 font-mono">
                PKR 4.82M
              </div>
              <div className="text-[10px] text-slate-400">18 Active Agents</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Gross Revenue (MTD)
              </div>
              <div className="text-base sm:text-lg font-bold text-[#d4af37] font-mono">
                PKR 18.45M
              </div>
              <div className="text-[10px] text-emerald-400">100% Ledger Synced</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Bank & Cash
              </div>
              <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono">
                PKR 7.12M
              </div>
              <div className="text-[10px] text-slate-400">3 Banks + Cash Drawer</div>
            </div>
          </div>

          {/* Unified Bookings Table Preview */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="font-semibold text-white flex items-center gap-2">
                <Ticket className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Client Bookings & Service Vouchers</span>
              </div>
              <span className="text-[10px] text-slate-400">Direct Clients & B2B</span>
            </div>

            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-950/40">
                    <th className="py-2 px-3 font-semibold">Client / Agent</th>
                    <th className="py-2 px-3 font-semibold">Service Type</th>
                    <th className="py-2 px-3 font-semibold">PNR / Ref</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                    <th className="py-2 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2 px-3 font-semibold text-right">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-200 font-sans font-medium">Tariq Mahmood</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">15-Days Umrah (Makkah/Madinah)</td>
                    <td className="py-2 px-3 text-slate-400">PK-89412</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Confirmed
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">PKR 485,000</td>
                    <td className="py-2 px-3 text-right font-sans text-[10px] text-[#d4af37]">
                      Voucher Issued
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-200 font-sans font-medium">
                      Al-Rehman Voyages <span className="text-[9px] text-[#d4af37]">(B2B)</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-sans">4x Jeddah Flights</td>
                    <td className="py-2 px-3 text-slate-400">SV-77209</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        Ticketed
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">PKR 820,000</td>
                    <td className="py-2 px-3 text-right font-sans text-[10px] text-emerald-400">
                      Ledger Synced
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-200 font-sans font-medium">Usman Qureshi</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Dubai Hotel & Visa</td>
                    <td className="py-2 px-3 text-slate-400">EK-30411</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        In Progress
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">PKR 340,000</td>
                    <td className="py-2 px-3 text-right font-sans text-[10px] text-slate-400">
                      Invoice PDF
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppMockupPreview;
