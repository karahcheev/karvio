import { describe, expect, it } from "vitest";
import { isProjectNotificationSettingsNotFound } from "./notification-settings-errors";

describe("NotificationsSettingsContent", () => {
  it("treats missing notification settings as an empty configuration state", () => {
    expect(isProjectNotificationSettingsNotFound(new Error("notification_settings not found"))).toBe(
      true,
    );
  });

  it("does not hide unrelated notification settings errors", () => {
    expect(isProjectNotificationSettingsNotFound(new Error("Request failed: 500"))).toBe(false);
    expect(isProjectNotificationSettingsNotFound("notification_settings not found")).toBe(false);
  });
});
