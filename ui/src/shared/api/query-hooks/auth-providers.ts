import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAuthProvider,
  deleteAuthProvider,
  getAuthProviders,
  getPublicAuthConfig,
  rotateAuthProviderSecret,
  testAuthProvider,
  updateAuthProvider,
} from "../tms";
import type { AuthProviderCreatePayload, AuthProviderUpdatePayload } from "../tms";
import { queryKeys } from "../query-keys";
import { invalidateGroups } from "./shared";

export function usePublicAuthConfigQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.auth.config,
    queryFn: () => getPublicAuthConfig(),
    enabled,
    retry: false,
  });
}

export function useAuthProvidersQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings.authProviders,
    queryFn: () => getAuthProviders(),
    enabled,
    retry: false,
  });
}

function useInvalidateAuthProviders() {
  const queryClient = useQueryClient();
  return () =>
    invalidateGroups(queryClient, [queryKeys.settings.authProviders, queryKeys.auth.config]);
}

export function useCreateAuthProviderMutation() {
  const invalidate = useInvalidateAuthProviders();
  return useMutation({
    mutationFn: (payload: AuthProviderCreatePayload) => createAuthProvider(payload),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateAuthProviderMutation() {
  const invalidate = useInvalidateAuthProviders();
  return useMutation({
    mutationFn: ({ providerId, payload }: { providerId: string; payload: AuthProviderUpdatePayload }) =>
      updateAuthProvider(providerId, payload),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAuthProviderMutation() {
  const invalidate = useInvalidateAuthProviders();
  return useMutation({
    mutationFn: (providerId: string) => deleteAuthProvider(providerId),
    onSuccess: () => invalidate(),
  });
}

export function useTestAuthProviderMutation() {
  const invalidate = useInvalidateAuthProviders();
  return useMutation({
    mutationFn: (providerId: string) => testAuthProvider(providerId),
    onSuccess: () => invalidate(),
  });
}

export function useRotateAuthProviderSecretMutation() {
  const invalidate = useInvalidateAuthProviders();
  return useMutation({
    mutationFn: ({
      providerId,
      payload,
    }: {
      providerId: string;
      payload: { secret_name: string; value: string | null };
    }) => rotateAuthProviderSecret(providerId, payload),
    onSuccess: () => invalidate(),
  });
}
