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
        <span className="field-label-text">{label}</span>
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
          aria-describedby={error ? `${id}-error` : hint ? `${id}-help` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        {hint && (
          <span id={`${id}-help`} className="input-tooltip-bubble" role="tooltip">
            {hint}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
