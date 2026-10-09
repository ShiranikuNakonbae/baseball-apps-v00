import type { ReactNode } from "react";

export function ErrorBanner({ message }: { message?: string | string[] }) {
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;
  return (
    <p role="alert" className="rounded-lg border border-club-bad/50 bg-club-bad/10 px-3 py-2 text-sm">
      {text}
    </p>
  );
}

export function SectionTitle({ children, href, hrefLabel }: { children: ReactNode; href?: string; hrefLabel?: string }) {
  return (
    <div className="row-between">
      <h2 className="card-title">{children}</h2>
      {href ? (
        <a href={href} className="link text-xs">
          {hrefLabel ?? "View"}
        </a>
      ) : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="card card-body text-center text-sm text-club-muted">
      {children}
    </p>
  );
}

export function StatGrid({ items, columns = 4 }: { items: { label: string; value: string }[]; columns?: 2 | 3 | 4 }) {
  const widths = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" } as const;
  return (
    <dl className={`grid gap-2 ${widths[columns]}`}>
      {items.map((item) => (
        <div key={item.label} className="stat">
          <dt className="stat-label">{item.label}</dt>
          <dd className="stat-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Totals({ pairs }: { pairs: [string, string | number | null | undefined][] }) {
  return (
    <p className="text-sm text-club-muted">
      {pairs.map(([label, value], i) => (
        <span key={label}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          <span className="font-semibold text-club-text">{label}</span> {value ?? "—"}
        </span>
      ))}
    </p>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required,
  inputMode,
  options,
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: "text" | "email" | "tel" | "url" | "date" | "datetime-local" | "number";
  defaultValue?: string;
  required?: boolean;
  inputMode?: "numeric" | "decimal";
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {options ? (
        <select className="select" id={id} name={name} defaultValue={defaultValue}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          inputMode={inputMode}
          placeholder={placeholder}
          min={min}
          max={max}
        />
      )}
    </div>
  );
}
