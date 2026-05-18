import { cn } from "@/shared/lib/cn";

const CODE_LANGUAGE_OPTIONS = [
  "python",
  "typescript",
  "javascript",
  "java",
  "kotlin",
  "csharp",
  "go",
  "ruby",
  "php",
  "swift",
  "bash",
  "sql",
  "text",
] as const;

type Props = Readonly<{
  title: string;
  value: string | null;
  language: string | null;
  isEditing: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  /** When true, drops the outer bordered card so the block sits flat inside another container. */
  unboxed?: boolean;
}>;

export function TestCaseCodeBlock({
  title,
  value,
  language,
  isEditing,
  placeholder,
  onChange,
  onLanguageChange,
  unboxed = false,
}: Props) {
  const effectiveLanguage = language?.trim() || "text";

  const headerClass = unboxed
    ? "mb-3 flex items-center justify-between gap-3"
    : "flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--muted)] px-4 py-3";
  const bodyClass = unboxed ? "" : "bg-[var(--tone-neutral-bg-soft)] p-3";

  return (
    <section
      className={cn(
        unboxed
          ? "space-y-3"
          : "overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm shadow-gray-100/60"
      )}
    >
      <div className={headerClass}>
        <div>
          <h2 className={cn("font-semibold text-[var(--foreground)]", unboxed ? "text-lg" : "text-base")}>{title}</h2>
          <p className="text-xs text-[var(--muted-foreground)]">Stored as source code for the automated case.</p>
        </div>
        {isEditing ? (
          <select
            value={effectiveLanguage}
            onChange={(event) => onLanguageChange(event.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--highlight-border)] focus:ring-1 focus:ring-[var(--control-focus-ring)]"
          >
            {CODE_LANGUAGE_OPTIONS.map((option) => (
              <option key={option} value={option} className="text-[var(--foreground)]">
                {option}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            {effectiveLanguage}
          </span>
        )}
      </div>

      {isEditing ? (
        <div className={bodyClass}>
          <textarea
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            rows={16}
            className="min-h-[320px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 font-mono text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--highlight-border)] focus:ring-2 focus:ring-[var(--control-focus-ring-soft)]"
          />
        </div>
      ) : (
        <div className={bodyClass}>
          <pre className="overflow-x-auto rounded-xl border border-[var(--tone-neutral-border)] bg-[var(--card)] px-4 py-4 text-sm leading-6 text-[var(--tone-neutral-text)]">
            <code>{value?.trim() ? value : "// No raw test available."}</code>
          </pre>
        </div>
      )}
    </section>
  );
}
