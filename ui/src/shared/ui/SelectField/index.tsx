// Label + native select + optional hint/error.

import * as React from "react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/FormField";
import { Select, type SelectProps } from "@/shared/ui/Select";

export type SelectFieldProps = Readonly<
  Omit<SelectProps, "id" | "className" | "children" | "required"> & {
    label?: React.ReactNode;
    required?: boolean;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    selectClassName?: string;
    id?: string;
    children: React.ReactNode;
  }
>;

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, required, hint, error, className, labelClassName, selectClassName, id: idProp, children, ...selectProps },
  ref,
) {
  const uid = useId();
  const id = idProp ?? uid;
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      className={className}
      labelClassName={labelClassName}
    >
      <Select ref={ref} id={id} className={cn(selectClassName)} required={required} {...selectProps}>
        {children}
      </Select>
    </FormField>
  );
});
