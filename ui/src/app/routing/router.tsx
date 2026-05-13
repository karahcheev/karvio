// Route configuration: public login, authenticated shell, workspace vs project routes.
import { createBrowserRouter, Navigate, useParams } from "react-router";
import { AdminLayout, ProtectedLayout, RootLayout } from "@/widgets/layouts";
import { AuditLogsModulePage } from "@/modules/audit-logs/page";
import { DatasetsModulePage } from "@/modules/datasets/page";
import { DefaultProjectRedirectPage } from "@/modules/default-project-redirect/page";
import { EnvironmentsModulePage } from "@/modules/environments/page";
import { LoginPage } from "@/modules/login/page";
import { MilestonesModulePage } from "@/modules/milestones/page";
import { MilestoneDetailsPage } from "@/modules/milestones/details-page";
import { OverviewPage } from "@/modules/overview/page";
import { PerformanceComparisonPage } from "@/modules/performance/PerformanceComparisonPage";
import { PerformanceRunDetailsModulePage, PerformanceRunsModulePage } from "@/modules/performance/page";
import { PublicPerformanceComparisonPage } from "@/modules/comparison-public/page";
import { ProjectDetailsModulePage, ProjectsUsersModulePage } from "@/modules/projects-users/page";
import { ProductsModulePage } from "@/modules/products/page";
import { SettingsModulePage } from "@/modules/settings/page";
import { TestCaseDetailModulePage, TestCasesModulePage } from "@/modules/test-cases/page";
import { TestPlansModulePage } from "@/modules/test-plans/page";
import { TestRunOverviewModulePage, TestRunsModulePage } from "@/modules/test-runs/page";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const pageErrorElement = <RouteErrorBoundary />;
const detailErrorElement = (
  <RouteErrorBoundary
    title="Unable to open details"
    description="The detail page failed to render. Retry or go back to the list."
  />
);

function TestPlansRedirectPage() {
  const { projectId } = useParams();
  return <Navigate to={projectId ? `/projects/${projectId}/products/test-plans` : "/"} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
    errorElement: <RouteErrorBoundary showBack={false} />,
  },
  {
    path: "/c/:token",
    Component: PublicPerformanceComparisonPage,
    errorElement: <RouteErrorBoundary showBack={false} />,
  },
  {
    Component: ProtectedLayout,
    errorElement: <RouteErrorBoundary showBack={false} />,
    children: [
      {
        path: "/",
        Component: RootLayout,
        errorElement: pageErrorElement,
        children: [
          // Workspace level
          { index: true, Component: DefaultProjectRedirectPage, errorElement: pageErrorElement },
          { path: "settings", Component: SettingsModulePage, errorElement: pageErrorElement },
          { path: "audit-logs", Component: AuditLogsModulePage, errorElement: pageErrorElement },
          {
            Component: AdminLayout,
            errorElement: pageErrorElement,
            children: [
              { path: "projects-and-users", Component: ProjectsUsersModulePage, errorElement: pageErrorElement },
              { path: "projects/:projectId/details", Component: ProjectDetailsModulePage, errorElement: detailErrorElement },
            ],
          },
          
          // Project level
          { path: "projects/:projectId/overview", Component: OverviewPage, errorElement: pageErrorElement },
          { path: "projects/:projectId/test-cases", Component: TestCasesModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/test-cases/:testCaseId", Component: TestCaseDetailModulePage, errorElement: detailErrorElement },
          { path: "projects/:projectId/datasets", Component: DatasetsModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/environments", Component: EnvironmentsModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/products/milestones", Component: MilestonesModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/products/milestones/:milestoneId", Component: MilestoneDetailsPage, errorElement: detailErrorElement },
          { path: "projects/:projectId/products/test-plans", Component: TestPlansModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/test-plans", Component: TestPlansRedirectPage, errorElement: pageErrorElement },
          { path: "projects/:projectId/test-runs", Component: TestRunsModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/test-runs/:runId", Component: TestRunOverviewModulePage, errorElement: detailErrorElement },
          { path: "projects/:projectId/performance", Component: PerformanceRunsModulePage, errorElement: pageErrorElement },
          { path: "projects/:projectId/performance/comparisons/:comparisonId", Component: PerformanceComparisonPage, errorElement: detailErrorElement },
          { path: "projects/:projectId/performance/:runId", Component: PerformanceRunDetailsModulePage, errorElement: detailErrorElement },
          { path: "projects/:projectId/products", Component: ProductsModulePage, errorElement: pageErrorElement },
        ],
      },
    ],
  },
]);
