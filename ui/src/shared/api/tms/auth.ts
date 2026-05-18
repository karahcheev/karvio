import { apiFetch, apiRequest } from "@/shared/api/client";
import type { LoginResponseDto, UserDto } from "./types";

export async function login(payload: { username: string; password: string }): Promise<LoginResponseDto> {
  return apiRequest<LoginResponseDto>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<UserDto> {
  return apiRequest<UserDto>("/auth/me");
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  await apiRequest<void>("/users/me/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
