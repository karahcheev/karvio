import { useCallback, useState } from "react";
import type { TestCaseListItem } from "../utils/types";

export function useTestCasesPreview(
  testCases: TestCaseListItem[],
  isCreatingTestCase: boolean,
  openActionsTestId: string | null,
  setOpenActionsTestId: (updater: (prev: string | null) => string | null) => void,
) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTestId, setPreviewTestId] = useState<string | null>(null);

  const previewTest = testCases.find((test) => test.testCaseId === previewTestId);

  const handleRowClick = useCallback(
    (testId: string) => {
      setOpenActionsTestId(() => null);
      if (previewOpen && previewTestId === testId) {
        setPreviewOpen(false);
        setPreviewTestId(null);
      } else {
        setPreviewTestId(testId);
        setPreviewOpen(true);
      }
    },
    [previewOpen, previewTestId, setOpenActionsTestId],
  );

  const handleClose = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewTestId(null);
  }, []);

  return {
    previewOpen,
    previewTestId,
    setPreviewOpen,
    setPreviewTestId,
    previewTest,
    isPreviewVisible: previewOpen && Boolean(previewTest) && !isCreatingTestCase,
    onRowClick: handleRowClick,
    onClose: handleClose,
    closePreview,
  };
}
