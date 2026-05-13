// Label + textarea + optional hint/error.

import * as React from "react";
import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/FormField";
import { Textarea, type TextareaProps } from "@/shared/ui/Textarea";

export type TextareaFieldProps = Readonly<
  Omit<TextareaProps, "id" | "className" | "required"> & {
    label?: React.ReactNode;
    required?: boolean;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    textareaClassName?: string;
    id?: string;
  }
>;

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, required, hint, error, className, labelClassName, textareaClassName, id: idProp, ...textareaProps },
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
      <Textarea ref={ref} id={id} className={cn(textareaClassName)} required={required} {...textareaProps} />
    </FormField>
  );
});
