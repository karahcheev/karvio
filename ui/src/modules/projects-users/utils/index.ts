import type { ProjectDto, ProjectsSortBy, UserDto, UsersSortBy } from "@/shared/api";

export function toNullable(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getUserLabel(user: UserDto): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username;
}

export type UserEditDraft = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
};

export function toUserEditDraft(user: UserDto): UserEditDraft {
  return {
    username: user.username,
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    email: user.email ?? "",
    team: user.team ?? "",
  };
}

export type ProjectColumn = "project" | "id" | "members" | "created";
export type UserColumn = "id" | "user" | "email" | "team" | "projects" | "status" | "last_login" | "created" | "updated";

export function mapProjectSorting(column: ProjectColumn): ProjectsSortBy {
  switch (column) {
    case "project":
      return "name";
    case "id":
      return "id";
    case "members":
      return "members_count";
    case "created":
      return "created_at";
  }
}

export function mapUserSorting(column: UserColumn): UsersSortBy {
  switch (column) {
    case "id":
      return "id";
    case "user":
      return "username";
    case "email":
      return "email";
    case "team":
      return "team";
    case "projects":
      return "project_count";
    case "status":
      return "is_enabled";
    case "last_login":
      return "last_login_at";
    case "created":
      return "created_at";
    case "updated":
      return "updated_at";
  }
}
