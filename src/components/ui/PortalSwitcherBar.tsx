import { Link } from "@tanstack/react-router";
import { ScanLine, FolderLock, ShieldCheck, LayoutGrid } from "lucide-react";

export type PortalId = "kiosk" | "consumer" | "super" | "official" | "user" | "home";

interface PortalSwitcherBarProps {
  /** Which portal is currently active — will be highlighted */
  active: PortalId;
}

const PORTALS = [
  {
    id: "kiosk" as PortalId,
    label: "Kiosk Terminal",
    shortLabel: "Kiosk",
    to: "/kiosk",
    icon: ScanLine,
    accent:
      "text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
    activeAccent: "bg-amber-500 text-ink border-amber-500 shadow-sm",
  },
  {
    id: "consumer" as PortalId,
    label: "Consumer App",
    shortLabel: "Consumer",
    to: "/consumer",
    icon: FolderLock,
    accent:
      "text-teal-400 border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20",
    activeAccent: "bg-teal-500 text-ink border-teal-500 shadow-sm",
  },
  {
    id: "super" as PortalId,
    label: "Super Admin",
    shortLabel: "Admin",
    to: "/super",
    icon: ShieldCheck,
    accent:
      "text-violet-400 border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20",
    activeAccent: "bg-violet-500 text-white border-violet-500 shadow-sm",
  },
] as const;

/**
 * Compact portal switcher — embed inside authenticated portal headers.
 * Shows which portal is active and lets the user jump between portals.
 */
export function PortalSwitcherBar({ active }: PortalSwitcherBarProps) {
  return (
    <nav
      aria-label="Portal switcher"
      className="flex items-center gap-1 rounded-xl border border-border/60 bg-secondary/40 p-1 backdrop-blur-sm"
    >
      {PORTALS.map(({ id, label, shortLabel, to, icon: Icon, accent, activeAccent }) => {
        const isActive = active === id;
        return (
          <Link
            key={id}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] transition-all duration-150 active:scale-[0.97] ${
              isActive ? activeAccent : accent
            }`}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </Link>
        );
      })}

      {/* Divider + Home */}
      <div className="mx-1 h-4 w-px bg-border/60" />
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white/50 transition-all hover:bg-white/10 hover:text-white/80 active:scale-[0.97]"
      >
        <LayoutGrid className="size-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>
    </nav>
  );
}
