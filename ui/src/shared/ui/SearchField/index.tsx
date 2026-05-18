// Search icon + input inside standard field layout (optional label).

import * as React from "react";
import { useId } from "react";
import { Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { FormField } from "@/shared/ui/FormField";
import { Input, type InputProps } from "@/shared/ui/Input";

export type SearchFieldProps = Readonly<
  Omit<InputProps, "id" | "className" | "required"> & {
    label?: React.ReactNode;
    required?: boolean;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    labelClassName?: string;
    inputWrapperClassName?: string;
    inputClassName?: string;
    id?: string;
  }
>;

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    label,
    required,
    hint,
    error,
    className,
    labelClassName,
    inputWrapperClassName,
    inputClassName,
    id: idProp,
    type = "text",
    ...inputProps
  },
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
      <div className={cn("relative", inputWrapperClassName)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input ref={ref} id={id} type={type} className={cn("pl-10", inputClassName)} required={required} {...inputProps} />
      </div>
    </FormField>
  );
});
