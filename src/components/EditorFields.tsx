import { useEffect, useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Field } from "./Field";
import { numberError } from "../lib/planner";
export function NumberField({
  label,
  value,
  onChange,
  unit = "USD / year",
  min = 0,
  max = 10000000,
  integer = false,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  min?: number;
  max?: number;
  integer?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={onChange}
      unit={unit}
      integer={integer}
      error={error || numberError(value, min, max, integer)}
      hint={hint}
    />
  );
}
export function TextField({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "month";
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={type === "text" ? 100 : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  children,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-help` : undefined}
      >
        {children}
      </select>
      {(error || hint) && (
        <p className={error ? "error" : "hint"} id={`${id}-help`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="toggle-field">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
export function ErrorList({
  errors,
  prefix,
}: {
  errors: Record<string, string>;
  prefix: string;
}) {
  const matches = Object.entries(errors).filter(
    ([key]) => key === prefix || key.startsWith(`${prefix}.`),
  );
  return matches.length ? (
    <div className="editor-errors" role="status">
      {[...new Set(matches.map(([, message]) => message))].map((message) => (
        <p className="error" key={message}>
          {message}
        </p>
      ))}
    </div>
  ) : null;
}

// Keep a section open after an invalid draft is repaired. The browser's native toggle
// remains keyboard accessible; validation opens the section without later closing it.
export function AutoDetails({
  hasErrors = false,
  ...props
}: { hasErrors?: boolean } & Omit<
  ComponentProps<"details">,
  "open" | "onToggle"
>) {
  const [expanded, setExpanded] = useState(hasErrors);
  useEffect(() => {
    if (hasErrors) setExpanded(true);
  }, [hasErrors]);
  return (
    <details
      {...props}
      open={expanded}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    />
  );
}
