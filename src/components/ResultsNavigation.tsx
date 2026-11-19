import {
  LayoutDashboard,
  ArrowLeftRight,
  ReceiptText,
  CalendarDays,
  SlidersHorizontal,
  Calculator,
} from "lucide-react";
import { Button } from "./ui/button";

export type Destination = "overview" | "cash" | "taxes" | "yearly" | "calculators";
export const destinations = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "cash", label: "Cash Flow", icon: ArrowLeftRight },
  { id: "taxes", label: "Taxes", icon: ReceiptText },
  { id: "yearly", label: "Annual Schedule", icon: CalendarDays },
  { id: "calculators", label: "Calculators", icon: Calculator },
] as const;

export function ResultsNavigation({
  destination,
  onNavigate,
  onEditInputs,
}: {
  destination: Destination;
  onNavigate: (value: Destination) => void;
  onEditInputs: () => void;
}) {
  return (
    <nav className="results-nav" aria-label="Results navigation">
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
        <Button variant="ghost" className="nav-button nav-inputs" onClick={onEditInputs}>
          <SlidersHorizontal aria-hidden="true" />
          <span>Inputs</span>
        </Button>
      </div>
    </nav>
  );
}
