import {
  LayoutDashboard,
  ArrowLeftRight,
  ReceiptText,
  CalendarDays,
  LockKeyhole,
} from "lucide-react";
import { Button } from "./ui/button";

export type Destination = "overview" | "cash" | "taxes" | "yearly";
export const destinations = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cash", label: "Cash Flow", icon: ArrowLeftRight },
  { id: "taxes", label: "Taxes", icon: ReceiptText },
  { id: "yearly", label: "Annual Schedule", icon: CalendarDays },
] as const;

export function ResultsNavigation({
  destination,
  onNavigate,
}: {
  destination: Destination;
  onNavigate: (value: Destination) => void;
}) {
  return (
    <nav className="results-nav" aria-label="Results navigation">
      <span className="nav-label">Workspace</span>
      <div className="nav-items">
        {destinations.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            className={`nav-button ${destination === id ? "active" : ""}`}
            aria-current={destination === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
      <div className="rail-note">
        <LockKeyhole size={16} aria-hidden="true" />
        <span>
          Local to this browser
          <br />
          <small>No account needed</small>
        </span>
      </div>
    </nav>
  );
}
