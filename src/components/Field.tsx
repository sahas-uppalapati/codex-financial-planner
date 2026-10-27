import { useId } from "react";
interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  error?: string;
  hint?: string;
  integer?: boolean;
}
export function Field({
  label,
  value,
  onChange,
  unit,
  error,
  hint,
  integer,
}: Props) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {unit && <span className="unit-label">{unit}</span>}
      </label>
      <div className={`input-wrap ${error ? "invalid" : ""}`}>
        <input
          id={id}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? "error" : "hint"}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
