import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type DatasetWizardStepStatus = "current" | "complete" | "error" | "upcoming";

export type DatasetWizardStepItem = {
  id: "metadata" | "table";
  title: string;
  description: string;
  status: DatasetWizardStepStatus;
};

type Props = Readonly<{
  steps: DatasetWizardStepItem[];
  onStepClick: (stepId: DatasetWizardStepItem["id"]) => void;
}>;

function StepIcon({ status }: Readonly<{ status: DatasetWizardStepStatus }>) {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 text-[var(--status-passed)]" />;
  }
  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-[var(--status-failure)]" />;
  }
  if (status === "current") {
    return <Circle className="h-4 w-4 fill-[var(--highlight-bg)] text-[var(--highlight-border)]" />;
  }
  return <Circle className="h-4 w-4 text-[var(--muted-foreground)]" />;
}

export function DatasetWizardSteps({ steps, onStepClick }: Props) {
  return (
    <nav aria-label="Dataset wizard steps">
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "rounded-xl border px-3 py-2",
              (() => {
                if (step.status === "current") {
                  return "border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)]";
                }
                if (step.status === "error") {
                  return "border-[var(--tone-danger-border-strong)] bg-[var(--tone-danger-bg-soft)]";
                }
                return "border-[var(--border)] bg-[var(--card)]";
              })(),
            )}
          >
            <button
              type="button"
              onClick={() => onStepClick(step.id)}
              className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--control-focus-ring),transparent_60%)]"
              aria-current={step.status === "current" ? "step" : undefined}
            >
              <div className="flex items-start gap-2">
                <StepIcon status={step.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{step.description}</p>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
