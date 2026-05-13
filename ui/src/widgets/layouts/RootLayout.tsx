// Authenticated app chrome: top bar, sidebar, and scrollable main outlet.
import { useEffect, useState } from "react";
import { Outlet, useParams } from "react-router";
import { useProjectsQuery } from "@/shared/api";
import { getSessionUser } from "@/shared/auth";
import { getLastProjectId, setLastProjectId, clearLastProjectId } from "@/shared/lib/last-project";
import { Sidebar, Topbar } from "@/widgets/navigation";

export function RootLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(() => getLastProjectId());
  const { projectId } = useParams();
  const { data: projects = [] } = useProjectsQuery();
  const isAdmin = getSessionUser()?.role === "admin";

  // Sync selected project with URL and persist last-opened project.
  useEffect(() => {
    if (projectId) {
      setCurrentProjectId(projectId);
      setLastProjectId(projectId);
    }
  }, [projectId]);

  // Clear stale last-project if it no longer exists in the project list.
  useEffect(() => {
    if (!currentProjectId) {
      return;
    }

    const hasCurrentProject = projects.length === 0 || projects.some((project) => project.id === currentProjectId);
    if (!hasCurrentProject) {
      setCurrentProjectId(undefined);
      clearLastProjectId();
    }
  }, [currentProjectId, projects]);

  // When no project in URL or state, default to the first available project.
  useEffect(() => {
    if (projectId || currentProjectId) {
      return;
    }

    const firstProjectId = projects[0]?.id;
    if (firstProjectId) {
      setCurrentProjectId(firstProjectId);
      setLastProjectId(firstProjectId);
    }
  }, [currentProjectId, projectId, projects]);

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      {/* Shell: navigation + content */}
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentProjectId={currentProjectId}
          isAdmin={isAdmin}
        />
        <main className="flex-1 overflow-auto bg-[var(--table-canvas)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
