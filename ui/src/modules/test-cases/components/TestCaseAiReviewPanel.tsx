import { Check, Loader2, Sparkles } from "lucide-react";
import type { ReviewAiTestCaseResponseDto } from "@/shared/api";
import { Button } from "@/shared/ui/Button";

type ApplyField = "title" | "preconditions" | "steps" | "priority" | "tags" | "component_coverages";

type Props = Readonly<{
  review: ReviewAiTestCaseResponseDto | null;
  isReviewing: boolean;
  onRunReview: () => void;
  onApplyField: (field: ApplyField) => void;
}>;

export function TestCaseAiReviewPanel({ review, isReviewing, onRunReview, onApplyField }: Props) {
  if (!review && !isReviewing) return null;

  return (
    <section className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">AI review</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {review ? `${Math.round(review.quality_score)} quality score` : "Reviewing test case quality"}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRunReview} disabled={isReviewing}>
          {isReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Review Again
        </Button>
      </div>

      {isReviewing && !review ? (
        <div className="mt-3 text-sm text-[var(--muted-foreground)]">Generating review...</div>
      ) : null}

      {review ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <p className="text-sm text-[var(--foreground)]">{review.summary}</p>
            {review.issues.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Issues</h3>
                {review.issues.map((issue, index) => (
                  <div key={`${issue.field}-${index}`} className="rounded-lg border border-[var(--border)] p-2 text-sm">
                    <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>{issue.severity}</span>
                      <span>{issue.field}</span>
                    </div>
                    <p className="mt-1 text-[var(--foreground)]">{issue.problem}</p>
                    <p className="mt-1 text-[var(--muted-foreground)]">{issue.recommendation}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <SuggestionActions review={review} onApplyField={onApplyField} />
            <ListBlock title="Missing edge cases" items={review.missing_edge_cases} />
            <ListBlock title={`Automation readiness ${Math.round(review.automation_readiness.score)}`} items={[
              ...review.automation_readiness.blocking_issues,
              ...review.automation_readiness.recommendations,
            ]} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SuggestionActions({
  review,
  onApplyField,
}: Readonly<{
  review: ReviewAiTestCaseResponseDto;
  onApplyField: (field: ApplyField) => void;
}>) {
  const revision = review.suggested_revision;
  const actions: Array<[ApplyField, string, boolean]> = [
    ["title", "Apply title", Boolean(revision.title)],
    ["preconditions", "Apply preconditions", revision.preconditions !== null],
    ["steps", "Apply steps", Boolean(revision.steps?.length)],
    ["priority", "Apply priority", Boolean(revision.priority)],
    ["tags", "Apply tags", Boolean(revision.tags?.length)],
    ["component_coverages", "Apply coverage", Boolean(revision.component_coverages?.length)],
  ];
  const visibleActions = actions.filter(([, , enabled]) => enabled);
  if (visibleActions.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Suggested revision</h3>
      <div className="flex flex-wrap gap-2">
        {visibleActions.map(([field, label]) => (
          <Button key={field} type="button" variant="secondary" onClick={() => onApplyField(field)}>
            <Check className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ title, items }: Readonly<{ title: string; items: string[] }>) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{title}</h3>
      <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

