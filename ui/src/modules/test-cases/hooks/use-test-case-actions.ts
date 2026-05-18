import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useDeleteTestCaseMutation, useSetTestCaseStatusMutation } from "@/shared/api";
import { useDeleteConfirmation } from "@/shared/lib/use-delete-confirmation";
import { notifyError, notifySuccess } from "@/shared/lib/notifications";
import { cloneSnapshot } from "@/modules/test-cases/utils/testCaseEditorUtils";
import type { EditorSnapshot } from "@/modules/test-cases/utils/testCaseEditorTypes";

export type UseTestCaseActionsProps = Readonly<{
  title: string;
  key: string;
  locationSearch: string;
  savedSnapshot: EditorSnapshot | null;
  setSavedSnapshot: (v: EditorSnapshot | null | ((prev: EditorSnapshot | null) => EditorSnapshot | null)) => void;
  status: "draft" | "active" | "archived";
  setStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  persistedStatus: "draft" | "active" | "archived";
  setPersistedStatus: (v: "draft" | "active" | "archived" | ((prev: "draft" | "active" | "archived") => "draft" | "active" | "archived")) => void;
  setUpdatedAt: (v: string | null | ((prev: string | null) => string | null)) => void;
  onEditStart: () => void;
}>;

export function useTestCaseActions(props: UseTestCaseActionsProps) {
  const { confirmDelete } = useDeleteConfirmation();
  const { projectId, testCaseId } = useParams();
  const navigate = useNavigate();
  const setStatusMutation = useSetTestCaseStatusMutation();
  const deleteMutation = useDeleteTestCaseMutation();
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    };

    if (actionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [actionsMenuOpen]);

  const handleArchive = useCallback(async () => {
    if (!testCaseId) return;
    try {
      const updated = await setStatusMutation.mutateAsync({ testCaseId, projectId, status: "archived" });
      props.setStatus(updated.status);
      props.setPersistedStatus(updated.status);
      props.setUpdatedAt(updated.updated_at);
      setActionsMenuOpen(false);
      props.setSavedSnapshot((current) =>
        current
          ? cloneSnapshot({
              ...current,
              status: updated.status,
            })
          : current
      );
      notifySuccess(`Test case "${props.title || props.key}" archived`);
    } catch (error) {
      notifyError(error, "Failed to archive test case.");
    }
  }, [testCaseId, setStatusMutation, props.setStatus, props.setPersistedStatus, props.setUpdatedAt, props.setSavedSnapshot, props.title, props.key]);

  const handleDelete = useCallback(async () => {
    if (!testCaseId || !projectId) return;
    const confirmed = await confirmDelete({
      title: "Delete Test Case",
      description: "Delete this test case? This action cannot be undone.",
      confirmLabel: "Delete Test Case",
    });
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync({ testCaseId, projectId });
      setActionsMenuOpen(false);
      notifySuccess(`Test case "${props.title || props.key}" deleted`);
      navigate({
        pathname: `/projects/${projectId}/test-cases`,
        search: props.locationSearch,
      });
    } catch (error) {
      notifyError(error, "Failed to delete test case.");
    }
  }, [testCaseId, projectId, confirmDelete, deleteMutation, props.title, props.key, props.locationSearch, navigate]);

  const handleEditStart = useCallback(() => {
    props.onEditStart();
    setActionsMenuOpen(false);
  }, [props.onEditStart]);

  const closeActionsMenu = useCallback(() => {
    setActionsMenuOpen(false);
  }, []);

  return {
    actionsMenuOpen,
    setActionsMenuOpen,
    actionsMenuRef,
    handleArchive,
    handleDelete,
    handleEditStart,
    closeActionsMenu,
  };
}
