import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleAlert,
  CircleDot,
  Clock,
  PlayCircle,
  SkipForward,
  XCircle,
} from "lucide-react";
import type { RunCaseDto } from "@/shared/api";

export type RunItemStatus = RunCaseDto["status"];

export type StatusOption = {
  value: RunItemStatus;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  requiresComment?: boolean;
};

export type StatusUpdatePayload = {
  status: RunItemStatus;
  time: string;
  comment: string;
  defectRefs: string[];
  failedStepId?: string;
  actualResult?: string;
  autoCreateJiraIssue?: boolean;
};

export interface TestStep {
  id: string;
  action: string;
  expectedResult: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "untested",
    label: "Untested",
    icon: Clock,
    color: "text-[var(--foreground)]",
    bgColor: "bg-[var(--accent)] hover:bg-[var(--secondary)]",
  },
  {
    value: "in_progress",
    label: "In Progress",
    icon: PlayCircle,
    color: "text-[var(--highlight-foreground)]",
    bgColor: "bg-[var(--highlight-bg)] hover:bg-[var(--highlight-bg-hover)]",
  },
  {
    value: "passed",
    label: "Passed",
    icon: CheckCircle2,
    color: "text-[var(--status-passed)]",
    bgColor: "bg-[var(--tone-success-bg)] hover:bg-[var(--tone-success-bg)]",
  },
  {
    value: "error",
    label: "Error",
    icon: AlertTriangle,
    color: "text-[var(--status-error)]",
    bgColor: "bg-[var(--tone-error-bg-soft)] hover:bg-[var(--tone-error-bg)]",
    requiresComment: true,
  },
  {
    value: "failure",
    label: "Failure",
    icon: XCircle,
    color: "text-[var(--status-failure)]",
    bgColor: "bg-[var(--tone-danger-bg)] hover:bg-[var(--tone-danger-bg)]",
    requiresComment: true,
  },
  {
    value: "blocked",
    label: "Blocked",
    icon: Ban,
    color: "text-[var(--status-blocked)]",
    bgColor: "bg-[var(--tone-warning-bg)] hover:bg-[var(--tone-warning-bg)]",
    requiresComment: true,
  },
  {
    value: "skipped",
    label: "Skipped",
    icon: SkipForward,
    color: "text-[var(--foreground)]",
    bgColor: "bg-[var(--tone-neutral-bg)] hover:bg-[var(--tone-neutral-bg)]",
  },
  {
    value: "xfailed",
    label: "XFailed",
    icon: CircleDot,
    color: "text-[var(--foreground)]",
    bgColor: "bg-violet-100 hover:bg-violet-200",
  },
  {
    value: "xpassed",
    label: "XPassed",
    icon: CircleAlert,
    color: "text-[var(--status-failure)]",
    bgColor: "bg-[var(--tone-danger-bg)] hover:bg-[var(--tone-danger-bg)]",
    requiresComment: true,
  },
];

type Params = {
  isOpen: boolean;
  loading: boolean;
  currentStatus: RunItemStatus;
  testSteps?: TestStep[];
  onUpdate: (payload: StatusUpdatePayload) => void;
};

export function useUpdateRunItemStatusFormState({
  isOpen,
  loading,
  currentStatus,
  testSteps,
  onUpdate,
}: Params) {
  const [selectedStatus, setSelectedStatus] = useState<RunItemStatus>(currentStatus);
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [defectRefsInput, setDefectRefsInput] = useState("");
  const [failedStepId, setFailedStepId] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [autoCreateJiraIssue, setAutoCreateJiraIssue] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStatus(currentStatus);
    setTime("");
    setComment("");
    setDefectRefsInput("");
    setFailedStepId("");
    setActualResult("");
    setAutoCreateJiraIssue(false);
  }, [currentStatus, isOpen]);

  const selectedOption = useMemo(
    () => STATUS_OPTIONS.find((option) => option.value === selectedStatus),
    [selectedStatus],
  );

  const requiresComment = selectedOption?.requiresComment ?? false;
  const isFailureStatus = selectedStatus === "failure";
  const isErrorStatus = selectedStatus === "error";
  const showDefectField =
    isErrorStatus || isFailureStatus || selectedStatus === "blocked" || selectedStatus === "xpassed";
  const hasStepOptions = Boolean(testSteps && testSteps.length > 0);
  const requiresFailedStep = isFailureStatus && hasStepOptions;
  const requiresActualResult = isFailureStatus;
  const isValid =
    (!requiresComment || comment.trim().length > 0) &&
    (!requiresFailedStep || failedStepId.trim().length > 0) &&
    (!requiresActualResult || actualResult.trim().length > 0);

  const handleSubmit = () => {
    if (!isValid || loading) return;
    const defectRefs = defectRefsInput
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    onUpdate({
      status: selectedStatus,
      time: time.trim(),
      comment: comment.trim(),
      defectRefs,
      failedStepId: failedStepId.trim() || undefined,
      actualResult: actualResult.trim() || undefined,
      autoCreateJiraIssue: autoCreateJiraIssue && selectedStatus === "failure" && defectRefs.length === 0,
    });
  };

  return {
    selectedStatus,
    setSelectedStatus,
    time,
    setTime,
    comment,
    setComment,
    defectRefsInput,
    setDefectRefsInput,
    failedStepId,
    setFailedStepId,
    actualResult,
    setActualResult,
    autoCreateJiraIssue,
    setAutoCreateJiraIssue,
    selectedOption,
    requiresComment,
    isErrorStatus,
    isFailureStatus,
    showDefectField,
    hasStepOptions,
    isValid,
    handleSubmit,
  };
}
