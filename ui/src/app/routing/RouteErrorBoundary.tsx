import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { Button } from "@/shared/ui/Button";

type Props = Readonly<{
  title?: string;
  description?: string;
  showBack?: boolean;
}>;

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.statusText || error.data?.message || `Request failed with status ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return "The page failed to render.";
}

export function RouteErrorBoundary({
  title = "Something went wrong",
  description = "This page hit an unexpected error. You can retry or go back without leaving the app.",
  showBack = true,
}: Props) {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = getErrorMessage(error);

  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--table-canvas)] p-6">
      <section className="w-full max-w-xl rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[color-mix(in_srgb,var(--destructive),transparent_88%)] p-2 text-[var(--destructive)]">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--foreground)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <pre className="mt-4 max-h-36 overflow-auto rounded-md border border-[var(--border)] bg-[var(--muted)] p-3 text-xs text-[var(--muted-foreground)]">
          {message}
        </pre>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {showBack ? (
            <Button type="button" variant="outline" size="md" leftIcon={<ArrowLeft />} onClick={() => navigate(-1)}>
              Back
            </Button>
          ) : null}
          <Button type="button" variant="primary" size="md" leftIcon={<RotateCw />} onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </section>
    </div>
  );
}
