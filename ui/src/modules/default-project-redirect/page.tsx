// Resolves default project from API and last-used id, then redirects to overview.
import { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { getProjects } from "@/shared/api";
import { getLastProjectId, setLastProjectId, clearLastProjectId } from "@/shared/lib/last-project";

export function DefaultProjectRedirectPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);

  // Load projects and pick last or first
  useEffect(() => {
    let isCancelled = false;

    getProjects()
      .then((projects) => {
        if (!isCancelled) {
          const lastProjectId = getLastProjectId();
          const fallbackProjectId = projects[0]?.id ?? null;
          const resolvedProjectId =
            lastProjectId && projects.some((project) => project.id === lastProjectId) ? lastProjectId : fallbackProjectId;

          if (resolvedProjectId) {
            setLastProjectId(resolvedProjectId);
          } else {
            clearLastProjectId();
          }

          setTargetProjectId(resolvedProjectId);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setTargetProjectId(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading) {
    return <div className="p-3 text-sm text-[var(--muted-foreground)]">Loading projects...</div>;
  }

  if (!targetProjectId) {
    return <div className="p-3 text-sm text-[var(--muted-foreground)]">No projects available.</div>;
  }

  return <Navigate to={`/projects/${targetProjectId}/overview`} replace />;
}
