// Label + single-line input + optional hint/error (controlled; forwards ref to input).

import * as React from "react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/FormField";
import { Input, type InputProps } from "@/shared/ui/Input";

export type TextFieldProps = Readonly<
  Omit<InputProps, "id" | "className" | "required"> & {
    label?: React.ReactNode;
    /** Shown on the label and forwarded to the input element. */
    required?: boolean;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    inputClassName?: string;
    id?: string;
  }
>;

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, required, hint, error, className, labelClassName, inputClassName, id: idProp, ...inputProps },
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
      <Input ref={ref} id={id} className={cn(inputClassName)} required={required} {...inputProps} />
    </FormField>
  );
});
