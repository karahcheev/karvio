// Horizontal wrap container for tag chips with consistent spacing.

import * as React from "react";
import { cn } from "@/shared/lib/cn";

const gapClasses = {
  xs: "gap-1",
  sm: "gap-1.5",
  md: "gap-2",
} as const;

export type TagListGap = keyof typeof gapClasses;

export type TagListProps = Readonly<
  React.ComponentProps<"div"> & {
    gap?: TagListGap;
  }
>;

export function TagList({ gap = "xs", className, ...props }: TagListProps) {
  return <div className={cn("flex flex-wrap items-center", gapClasses[gap], className)} {...props} />;
}
