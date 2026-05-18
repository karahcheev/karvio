// Global providers: data fetching, confirmations, and toast notifications.
import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { DeleteConfirmationProvider } from "@/shared/lib/use-delete-confirmation";
import { queryClient } from "@/shared/api/query-client";
import { Toaster } from "@/shared/ui/Sonner";

export function AppProviders({ children }: Readonly<PropsWithChildren>) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        storageKey="tms-ui-theme"
      >
        <DeleteConfirmationProvider>
          {children}
          <Toaster closeButton position="bottom-right" />
        </DeleteConfirmationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
