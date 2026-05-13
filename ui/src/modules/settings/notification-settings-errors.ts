export function isProjectNotificationSettingsNotFound(error: unknown): boolean {
  return error instanceof Error && error.message.trim() === "notification_settings not found";
}
