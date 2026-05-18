// Button: CVA variants, sizes, loading/icons, optional unstyled mode, Radix Slot as-child.

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-[var(--ring)] focus-visible:ring-[color-mix(in_srgb,var(--ring),transparent_50%)] focus-visible:ring-[3px] aria-invalid:ring-[color-mix(in_srgb,var(--destructive),transparent_80%)] dark:aria-invalid:ring-[color-mix(in_srgb,var(--destructive),transparent_60%)] aria-invalid:border-[var(--destructive)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[color-mix(in_srgb,var(--primary),transparent_10%)]",
        primary:
          "border border-transparent bg-[var(--action-primary-fill)] text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] focus-visible:ring-[color-mix(in_srgb,var(--control-focus-ring),transparent_60%)]",
        secondary: "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[color-mix(in_srgb,var(--secondary),transparent_20%)]",
        outline:
          "border bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--accent-foreground)] dark:bg-[color-mix(in_srgb,var(--input),transparent_70%)] dark:border-[var(--input)] dark:hover:bg-[color-mix(in_srgb,var(--input),transparent_50%)]",
        ghost: "hover:bg-[var(--muted)] hover:text-[var(--accent-foreground)] dark:hover:bg-[color-mix(in_srgb,var(--accent),transparent_50%)]",
        destructive:
          "bg-[var(--destructive)] text-white hover:bg-[color-mix(in_srgb,var(--destructive),transparent_10%)] focus-visible:ring-[color-mix(in_srgb,var(--destructive),transparent_80%)] dark:focus-visible:ring-[color-mix(in_srgb,var(--destructive),transparent_60%)] dark:bg-[color-mix(in_srgb,var(--destructive),transparent_40%)]",
        /** Filled destructive; same intent as `destructive`, explicit app naming. */
        danger:
          "border border-transparent bg-[var(--action-danger-fill)] text-white hover:bg-[var(--action-danger-fill-hover)] focus-visible:ring-[color-mix(in_srgb,var(--action-danger-focus-ring),transparent_65%)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
        /** Icon-only / toolbar: neutral chrome, pairs with `size`. */
        icon: "border border-transparent bg-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:ring-[var(--control-focus-ring-soft)] dark:hover:border-[var(--border)] dark:hover:bg-[var(--popover)] dark:text-[var(--muted-foreground)] dark:hover:text-[var(--foreground)]",
      },
      size: {
        /** @deprecated use `md` — kept for Radix/shadcn call sites using `buttonVariants()` without size */
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 text-sm has-[>svg]:px-2.5",
        md: "h-9 px-4 py-2 has-[>svg]:px-3",
        lg: "h-10 rounded-md px-6 text-base has-[>svg]:px-4",
        /** Side panel header actions (rounded-xl, compact text). */
        panel:
          "h-auto min-h-0 rounded-xl px-3 py-2 text-xs font-medium has-[>svg]:px-3 [&_svg]:size-3.5",
        /** Square icon hit target for default/outline/destructive variants. */
        icon: "size-9 rounded-md p-0 has-[>svg]:p-0",
      },
    },
    compoundVariants: [
      {
        variant: "primary",
        size: "panel",
        class:
          "gap-1.5 border-transparent bg-[var(--action-primary-fill)] text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-[color-mix(in_srgb,var(--control-focus-ring),transparent_60%)]",
      },
      {
        variant: "secondary",
        size: "panel",
        class:
          "gap-1.5 border border-[var(--highlight-border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)] dark:border-[var(--highlight-border)] dark:bg-[var(--popover)] dark:text-[var(--foreground)] dark:hover:bg-[var(--muted)]",
      },
      {
        variant: "danger",
        size: "panel",
        class:
          "gap-1.5 border border-[color-mix(in_srgb,var(--destructive),transparent_60%)] bg-[var(--card)] text-[var(--destructive)] hover:bg-[color-mix(in_srgb,var(--destructive),transparent_90%)] dark:border-[color-mix(in_srgb,var(--destructive),transparent_45%)] dark:bg-[var(--popover)] dark:hover:bg-[color-mix(in_srgb,var(--destructive),transparent_85%)]",
      },
      {
        variant: "icon",
        size: "sm",
        class: "size-8 rounded-lg p-0 text-[var(--muted-foreground)] [&_svg]:size-4",
      },
      {
        variant: "icon",
        size: "md",
        class: "size-9 rounded-lg p-0 [&_svg]:size-4",
      },
      {
        variant: "icon",
        size: "lg",
        class: "size-10 rounded-lg p-0 [&_svg]:size-5",
      },
      {
        variant: "icon",
        size: "panel",
        class: "size-auto rounded-xl p-2 [&_svg]:size-5",
      },
      {
        variant: "icon",
        size: "default",
        class: "size-9 rounded-lg p-0 [&_svg]:size-4",
      },
      {
        variant: "icon",
        size: "icon",
        class: "size-9 rounded-md p-0 [&_svg]:size-4",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = Readonly<
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      unstyled?: boolean;
      asChild?: boolean;
      loading?: boolean;
      leftIcon?: React.ReactNode;
      rightIcon?: React.ReactNode;
    }
>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    unstyled = false,
    asChild = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const isDisabled = Boolean(disabled || loading);

  let leftAffordance: React.ReactNode = null;
  if (loading) {
    leftAffordance = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />;
  } else if (leftIcon) {
    leftAffordance = <span className="inline-flex shrink-0 [&_svg]:size-4">{leftIcon}</span>;
  }

  const content = (
    <>
      {leftAffordance}
      {children}
      {!loading && rightIcon ? <span className="inline-flex shrink-0 [&_svg]:size-4">{rightIcon}</span> : null}
    </>
  );

  return (
    <Comp
      ref={ref}
      data-slot="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        unstyled
          ? "cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none"
          : buttonVariants({ variant, size }),
        className,
      )}
      {...props}
    >
      {asChild ? children : content}
    </Comp>
  );
});

export { Button, buttonVariants };
export type { ButtonProps };
