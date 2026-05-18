// Slide-in panel with overlay, rich header, scrollable body, and footer slot.

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button, buttonVariants } from "@/shared/ui/Button";
import { UnderlineTabs } from "@/shared/ui/Tabs";

export type SidePanelProps = Readonly<{
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  headerContent?: ReactNode;
  tabs?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  showOverlay?: boolean;
}>;

export type SidePanelTabItem<T extends string> = Readonly<{
  value: T;
  label: string;
  icon?: ReactNode;
}>;

/** Class strings for `<Link>` and legacy `unstyled` buttons — kept in sync with `Button` panel variants. */
export const sidePanelHeaderActions = {
  primary: buttonVariants({ variant: "primary", size: "panel" }),
  secondary: buttonVariants({ variant: "secondary", size: "panel" }),
  danger: buttonVariants({ variant: "danger", size: "panel" }),
} as const;

export function SidePanel({
  title,
  subtitle,
  eyebrow,
  onClose,
  children,
  actions,
  headerContent,
  tabs,
  footer,
  className,
  contentClassName,
  showOverlay = true,
}: SidePanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Keep a stable ref to onClose so the focus-trap effect doesn't re-run
  // every time the parent re-renders and passes a new arrow function reference.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Trap focus inside the modal panel, restore it on close, and prevent page scroll behind the overlay.
  // Dependencies: [] — intentionally runs only on mount/unmount.
  // onClose is accessed via onCloseRef so it always calls the latest version.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      {showOverlay ? (
        <div
          className="fixed inset-0 top-14 z-30"
          style={{
            backgroundColor: "var(--sidepanel-overlay)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          }}
          aria-hidden="true"
          onClick={onClose}
        />
      ) : null}

      {/* Panel shell */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "tms-sidepanel fixed bottom-0 right-0 top-14 z-40 flex w-full flex-col border-l bg-[var(--sidepanel-canvas)] shadow-2xl sm:w-[34rem] xl:w-[40rem]",
          className,
        )}
        style={{
          borderColor: "var(--sidepanel-border)",
          boxShadow: "0 16px 48px color-mix(in oklab, var(--sidepanel-overlay) 75%, transparent)",
        }}
      >
        {/* Header: title, optional slots, close */}
        <div
          className="border-b px-5 py-4"
          style={{
            borderColor: "var(--sidepanel-border)",
            backgroundColor: "color-mix(in oklab, var(--sidepanel-surface) 92%, transparent)",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold text-[var(--foreground)]">
                {title}
              </h2>
              {eyebrow ? <div className="mt-3 flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
              {subtitle ? <div className="mt-2">{subtitle}</div> : null}
            </div>
            <Button ref={closeButtonRef} type="button" variant="icon" size="panel" onClick={onClose} aria-label="Close panel">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {headerContent ? <div className="mt-4">{headerContent}</div> : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
          {tabs ? <div className="mt-4">{tabs}</div> : null}
        </div>

        {/* Scrollable body: min-w-0 + overflow-x so wide tables (e.g. perf panel) scroll instead of breaking layout */}
        <div className={cn("min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-5 py-5", contentClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer ? (
          <div className="border-t bg-[var(--sidepanel-surface)] px-5 py-4" style={{ borderColor: "var(--sidepanel-border)" }}>
            {footer}
          </div>
        ) : null}
      </aside>
    </>
  );
}

// Titled section inside the panel body

export function SidePanelSection({
  title,
  description,
  children,
  className,
}: Readonly<{
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || description ? (
        <div>
          {title ? <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3> : null}
          {description ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// Bordered content card

export function SidePanelCard({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={cn("rounded-2xl border bg-[var(--sidepanel-surface)] p-4 shadow-sm", className)}
      style={{
        borderColor: "var(--sidepanel-border)",
        boxShadow: "0 1px 10px color-mix(in oklab, var(--sidepanel-overlay) 28%, transparent)",
      }}
    >
      {children}
    </div>
  );
}

// Responsive stat tile grid

export function SidePanelStatGrid({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}>{children}</div>;
}

// Single label/value stat tile

export function SidePanelStat({
  label,
  value,
  helper,
  className,
}: Readonly<{
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  className?: string;
}>) {
  return (
    <SidePanelCard className={cn("space-y-1.5 p-3", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</div>
      <div className="text-lg font-semibold text-[var(--foreground)]">{value}</div>
      {helper ? <div className="text-xs text-[var(--muted-foreground)]">{helper}</div> : null}
    </SidePanelCard>
  );
}

// Label/value row for metadata lists

export function SidePanelMetaRow({
  label,
  value,
  alignTop = false,
  className,
}: Readonly<{
  label: ReactNode;
  value: ReactNode;
  alignTop?: boolean;
  className?: string;
}>) {
  return (
    <div className={cn("flex gap-4 border-b py-3 last:border-b-0 last:pb-0 first:pt-0", alignTop ? "items-start" : "items-center", className)} style={{ borderColor: "color-mix(in oklab, var(--sidepanel-border) 75%, transparent)" }}>
      <div className="w-28 shrink-0 text-sm font-medium text-[var(--muted-foreground)]">{label}</div>
      <div className="min-w-0 flex-1 break-words text-sm text-[var(--foreground)]">{value}</div>
    </div>
  );
}

// Underline tab strip (same as Projects / Users) with optional icons

export function SidePanelTabs<T extends string>({
  value,
  onChange,
  items,
  className,
}: Readonly<{
  value: T;
  onChange: (next: T) => void;
  items: SidePanelTabItem<T>[];
  className?: string;
}>) {
  return (
    <UnderlineTabs
      value={value}
      onChange={onChange}
      items={items}
      className={cn("-mx-5 border-b border-[var(--border)] bg-transparent px-5", className)}
    />
  );
}
