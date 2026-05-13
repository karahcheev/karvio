// Label + checkbox on one row; optional hint below (FormField layout).
import * as React from "react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { Checkbox, type CheckboxProps } from "@/shared/ui/Checkbox";
import { FormField } from "@/shared/ui/FormField";

export type CheckboxFieldProps = Readonly<
  Omit<CheckboxProps, "id" | "className"> & {
    label: React.ReactNode;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    id?: string;
  }
>;

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField(
    { label, hint, error, className, labelClassName, id: idProp, disabled, ...checkboxProps },
    ref,
  ) {
    const uid = useId();
    const id = idProp ?? uid;
    return (
      <FormField hint={hint} error={error} className={className}>
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]",
            disabled && "cursor-not-allowed opacity-60",
            labelClassName,
          )}
        >
          <Checkbox ref={ref} id={id} disabled={disabled} {...checkboxProps} />
          <span className="select-none">{label}</span>
        </label>
      </FormField>
    );
  },
);
