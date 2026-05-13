import { useCallback, useEffect, useRef, useState } from "react";

export const UNASSIGNED_ASSIGNEE = "unassigned";

export type RunMetadataFormState = {
  name: string;
  description: string;
  environmentId: string;
  milestoneId: string;
  build: string;
  assignee: string;
};

type UseRunMetadataFormStateParams = {
  isOpen: boolean;
  getInitialState: () => RunMetadataFormState;
};

export function useRunMetadataFormState({
  isOpen,
  getInitialState,
}: UseRunMetadataFormStateParams) {
  const getInitialStateRef = useRef(getInitialState);

  useEffect(() => {
    getInitialStateRef.current = getInitialState;
  }, [getInitialState]);

  const [state, setState] = useState<RunMetadataFormState>(getInitialState);

  const reset = useCallback(() => {
    setState(getInitialStateRef.current());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reset();
  }, [isOpen, reset]);

  const setName = useCallback((name: string) => {
    setState((current) => ({ ...current, name }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setState((current) => ({ ...current, description }));
  }, []);

  const setEnvironmentId = useCallback((environmentId: string) => {
    setState((current) => ({ ...current, environmentId }));
  }, []);

  const setBuild = useCallback((build: string) => {
    setState((current) => ({ ...current, build }));
  }, []);

  const setMilestoneId = useCallback((milestoneId: string) => {
    setState((current) => ({ ...current, milestoneId }));
  }, []);

  const setAssignee = useCallback((assignee: string) => {
    setState((current) => ({ ...current, assignee }));
  }, []);

  return {
    state,
    setName,
    setDescription,
    setEnvironmentId,
    setMilestoneId,
    setBuild,
    setAssignee,
    reset,
  };
}
