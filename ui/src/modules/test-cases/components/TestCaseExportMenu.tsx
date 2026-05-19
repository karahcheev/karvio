// Dropdown that exports test case(s) into a TMS-compatible format.
import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { useOnClickOutside } from "@/shared/lib/use-on-click-outside";
import {
  TEST_CASE_EXPORT_FORMATS,
  type TestCaseExportFormat,
} from "@/shared/api";

type Props = Readonly<{
  label: string;
  disabled?: boolean;
  busy?: boolean;
  align?: "left" | "right";
  onSelect: (format: TestCaseExportFormat) => void | Promise<void>;
}>;

export function TestCaseExportMenu({ label, disabled, busy, align = "right", onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        unstyled
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
      </Button>

      {open ? (
        <div
          className={`absolute top-full z-50 mt-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="p-1">
            <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Export as
            </div>
            {TEST_CASE_EXPORT_FORMATS.map((format) => (
              <Button
                key={format.value}
                unstyled
                type="button"
                onClick={() => {
                  setOpen(false);
                  void onSelect(format.value);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                {format.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
