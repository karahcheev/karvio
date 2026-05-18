// Global header: branding, project switcher, notifications, user menu, and account modals.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Bell, BellOff, User, ChevronDown, LogOut, KeyRound, CheckCircle2, AlertCircle, X, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { logout, useChangePasswordMutation, useProjectsQuery, useVersionQuery } from "@/shared/api";
import { clearSession } from "@/shared/auth";
import { getErrorMessage, notifyError, notifySuccess, useNotificationCenter } from "@/shared/lib/notifications";
import { PASSWORD_POLICY_HINT, validatePassword } from "@/shared/lib/password-policy";
import { useOnClickOutside } from "@/shared/lib/use-on-click-outside";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui";
import { DialogTitle } from "@/shared/ui/Dialog";
import { AppModal, StandardModalLayout } from "@/shared/ui/Modal";
import { Switch } from "@/shared/ui/Switch";
import { ApiKeysManagerModal } from "@/modules/api-keys-manager";

/** Formats notification timestamps for the notification center list. */
function formatNotificationTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

export function Topbar() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { resolvedTheme, setTheme } = useTheme();

  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showProductInfoModal, setShowProductInfoModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showApiKeysManagerModal, setShowApiKeysManagerModal] = useState(false);

  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const projectMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { items, unreadCount, uiEnabled, setUiEnabled, markSeen, clear, dismissNotification } = useNotificationCenter();
  const { data: versionData, isLoading: isVersionLoading } = useVersionQuery(showProductInfoModal);
  const { data: projects = [] } = useProjectsQuery();

  const changePasswordMutation = useChangePasswordMutation();
  const isChangingPassword = changePasswordMutation.isPending;

  useEffect(() => {
    if (notificationsOpen && unreadCount > 0) {
      markSeen();
    }
  }, [markSeen, notificationsOpen, unreadCount]);

  useOnClickOutside(projectMenuRef, () => setProjectMenuOpen(false), projectMenuOpen);
  useOnClickOutside(notificationsMenuRef, () => setNotificationsOpen(false), notificationsOpen);
  useOnClickOutside(userMenuRef, () => setUserMenuOpen(false), userMenuOpen);

  const currentProject = projects.find((p) => p.id === projectId);
  const showProjectSelector = projects.length > 0;
  const displayProject = currentProject || projects[0];
  const homePath = displayProject ? `/projects/${displayProject.id}/overview` : "/";
  const isDarkTheme = resolvedTheme === "dark";

  const resetChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setChangePasswordError(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const closeChangePasswordModal = () => {
    if (isChangingPassword) {
      return;
    }
    resetChangePasswordModal();
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout().catch(() => {});
    clearSession();
    navigate("/login", { replace: true });
  };

  const handleChangePassword = async () => {
    setChangePasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordError("All fields are required.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setChangePasswordError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      resetChangePasswordModal();
      notifySuccess("Password changed. Please sign in again.");
      await handleLogout();
    } catch (error) {
      const message = getErrorMessage(error, "Failed to change password.");
      setChangePasswordError(message);
      notifyError(error, "Failed to change password.");
    }
  };

  return (
    <div className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4">
      <div className="flex items-center gap-4">
        <Link
          to={homePath}
          className="flex shrink-0 items-center"
          aria-label="Karvio home"
        >
          <img
            src={isDarkTheme ? "/karvio-logo-dark.svg" : "/karvio-logo.svg"}
            alt=""
            width={1200}
            height={380}
            className="h-10 w-auto sm:h-11"
            decoding="async"
          />
        </Link>

        {showProjectSelector && (
          <div ref={projectMenuRef} className="relative">
            <Button
              unstyled
              onClick={() => setProjectMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
            >
              <span className="font-medium">{displayProject?.name ?? "No projects"}</span>
              <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
            </Button>

            {projectMenuOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
                <div className="p-2">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}/overview`}
                      onClick={() => setProjectMenuOpen(false)}
                      className={`block rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)] ${
                        project.id === projectId ? "bg-[var(--highlight-bg)] text-[var(--highlight-foreground)]" : ""
                      }`}
                    >
                      <div className="font-medium">{project.name}</div>
                    </Link>
                  ))}
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">No projects available</div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1"></div>

      <div className="flex items-center gap-3">
        <Button
          unstyled
          type="button"
          onClick={() => setTheme(isDarkTheme ? "light" : "dark")}
          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
          title={isDarkTheme ? "Light theme" : "Dark theme"}
        >
          {isDarkTheme ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button
          unstyled
          type="button"
          onClick={() => setShowProductInfoModal(true)}
          className="rounded-lg p-2 hover:bg-[var(--accent)]"
          aria-label="Product info"
        >
          <span className="box-border flex h-5 w-5 items-center justify-center rounded-full border-solid border-[var(--muted-foreground)] text-xs font-semibold text-[var(--muted-foreground)] [border-width:calc(1.25rem*2/24)]">
            ?
          </span>
        </Button>

        <div ref={notificationsMenuRef} className="relative">
          <Button
            unstyled
            className="relative rounded-lg p-2 hover:bg-[var(--accent)]"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-label="Notifications"
          >
            {uiEnabled ? <Bell className="h-5 w-5 text-[var(--muted-foreground)]" /> : <BellOff className="h-5 w-5 text-[var(--muted-foreground)]" />}
            {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--status-failure)]"></span> : null}
          </Button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-[360px] rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <div className="text-sm font-semibold text-[var(--foreground)]">Notification Center</div>
                <Button
                  unstyled
                  type="button"
                  onClick={clear}
                  className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ring),transparent_50%)]"
                >
                  Clear
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <label htmlFor="notifications-ui-switch" className="text-xs text-[var(--foreground)]">
                  Show pop-up notifications in UI
                </label>
                <Switch
                  id="notifications-ui-switch"
                  checked={uiEnabled}
                  onCheckedChange={setUiEnabled}
                  aria-label="Toggle pop-up notifications"
                />
              </div>

              <div className="max-h-80 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="px-2 py-3 text-center text-sm text-[var(--muted-foreground)]">No notifications yet.</div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="tms-notification-row relative">
                        <Button
                          unstyled
                          type="button"
                          onClick={() => dismissNotification(item.id)}
                          className="tms-notification-dismiss absolute right-1 top-1"
                          aria-label="Dismiss notification"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="flex items-start gap-2">
                          {item.level === "success" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-passed)]" />
                          ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-failure)]" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[var(--foreground)]">{item.message}</p>
                            <p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatNotificationTime(item.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={userMenuRef} className="relative">
          <Button unstyled onClick={() => setUserMenuOpen((prev) => !prev)} className="rounded-lg p-2 hover:bg-[var(--accent)]">
            <User className="h-5 w-5 text-[var(--muted-foreground)]" />
          </Button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
              <div className="p-1">
                {/* <Button
                  unstyled
                  onClick={() => setUserMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <Bug className="h-4 w-4" />
                  Report Bug
                </Button> */}
                <Button
                  unstyled
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShowChangePasswordModal(true);
                    setChangePasswordError(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Button>
                <Button
                  unstyled
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShowApiKeysManagerModal(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
                >
                  <KeyRound className="h-4 w-4" />
                  Manage API Keys
                </Button>
                <div className="my-1 border-t border-[var(--border)]"></div>
                <Button
                  unstyled
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--status-failure)] hover:bg-[var(--tone-danger-bg-soft)] hover:bg-[var(--tone-danger-bg)]"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AppModal
        isOpen={showProductInfoModal}
        onClose={() => setShowProductInfoModal(false)}
        contentClassName="max-w-md overflow-hidden rounded-xl border border-[var(--border)]"
      >
        <div className="relative bg-[var(--card)] p-3">
          <Button
            unstyled
            type="button"
            onClick={() => setShowProductInfoModal(false)}
            className="absolute right-4 top-4 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Close product info"
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="pr-8">
            <DialogTitle className="text-lg font-semibold text-[var(--foreground)]">About</DialogTitle>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface-muted)] to-[var(--surface)] p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="w-full min-w-0">
                <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Product</p>
                <img
                  src={isDarkTheme ? "/karvio-logo-dark.svg" : "/karvio-logo.svg"}
                  alt="Karvio"
                  width={1200}
                  height={380}
                  className="mt-2 h-auto w-full max-h-28 object-contain object-left sm:max-h-32"
                  decoding="async"
                />
              </div>
            </div>

            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Version</p>
              <p className="mt-1 text-base font-semibold text-[var(--foreground)]">
                {isVersionLoading ? "Loading..." : (versionData?.version ?? "Unavailable")}
              </p>
            </div>
          </div>
        </div>
      </AppModal>

      <ApiKeysManagerModal isOpen={showApiKeysManagerModal} onClose={() => setShowApiKeysManagerModal(false)} />

      {showChangePasswordModal && (
        <AppModal
          isOpen={showChangePasswordModal}
          onClose={closeChangePasswordModal}
          closeOnOverlayClick={!isChangingPassword}
          closeOnEscape={!isChangingPassword}
          contentClassName="max-w-md rounded-xl border border-[var(--border)]"
        >
          <StandardModalLayout
            title="Change Password"
            description={`Enter your current password and set a new one. ${PASSWORD_POLICY_HINT}`}
            onClose={closeChangePasswordModal}
            closeButtonDisabled={isChangingPassword}
            footer={
              <>
                <Button
                  unstyled
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]"
                  onClick={closeChangePasswordModal}
                  disabled={isChangingPassword}
                >
                  Cancel
                </Button>
                <Button
                  unstyled
                  className="flex-1 rounded-lg bg-[var(--action-primary-fill)] px-4 py-2 text-sm font-medium text-[var(--action-primary-foreground)] hover:bg-[var(--action-primary-fill-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void handleChangePassword()}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? "Changing..." : "Change"}
                </Button>
              </>
            }
          >
            <div className="space-y-3">
              <TextField
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoFocus
              />
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {changePasswordError ? <p className="mt-3 text-sm text-[var(--status-failure)]">{changePasswordError}</p> : null}
          </StandardModalLayout>
        </AppModal>
      )}
    </div>
  );
}
