"use client";

// Radix Switch with thumb animation and focus ring.

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/shared/lib/cn";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-[var(--primary)] data-[state=unchecked]:bg-[var(--switch-background)] focus-visible:border-[var(--ring)] focus-visible:ring-[color-mix(in_srgb,var(--ring),transparent_50%)] dark:data-[state=unchecked]:bg-[color-mix(in_srgb,var(--input),transparent_20%)] inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-[var(--card)] dark:data-[state=unchecked]:bg-[var(--card-foreground)] dark:data-[state=checked]:bg-[var(--primary-foreground)] pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
