// Vertical field layout: label, control slot, then error or hint.

import type { PropsWithChildren, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export function FieldHint({ children, className }: Readonly<{ children?: ReactNode; className?: string }>) {
  if (children == null || children === false) {
    return null;
  }
  return <p className={cn("text-xs text-[var(--muted-foreground)]", className)}>{children}</p>;
}

export function FieldError({ children, className }: Readonly<{ children?: ReactNode; className?: string }>) {
  if (children == null || children === false) {
    return null;
  }
  return <p className={cn("text-xs text-[var(--status-failure)]", className)}>{children}</p>;
}

export function FieldLabel({
  htmlFor,
  children,
  required,
  className,
}: Readonly<{
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}>) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-sm font-medium text-[var(--foreground)]", className)}>
      {children}
      {required ? (
        <span className="text-[var(--status-failure)]" aria-hidden>
          {" "}
          *
        </span>
      ) : null}
    </label>
  );
}

export type FormFieldProps = PropsWithChildren<
  Readonly<{
    label?: ReactNode;
    htmlFor?: string;
    hint?: ReactNode;
    error?: ReactNode;
    className?: string;
    required?: boolean;
    labelClassName?: string;
  }>
>;

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  className,
  required,
  labelClassName,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <FieldLabel htmlFor={htmlFor} required={required} className={labelClassName}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
      {!error && hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
