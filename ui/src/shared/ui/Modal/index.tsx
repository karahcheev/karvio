// App modal shell on Radix Dialog plus reusable modal layout wrappers.

import * as React from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/Dialog";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

type DialogContentProps = React.ComponentProps<typeof DialogContent>;

type AppModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  contentClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  /** Called after overlay clicks are allowed; call `event.preventDefault()` to keep the dialog open. */
  onPointerDownOutside?: DialogContentProps["onPointerDownOutside"];
  children: React.ReactNode;
}>;

export function AppModal({
  isOpen,
  onClose,
  contentClassName,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  onPointerDownOutside,
  children,
}: AppModalProps) {
  // Dialog open state mirrors `isOpen` via `onOpenChange`

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn("gap-0 overflow-hidden p-0 [&>button]:hidden", contentClassName)}
        onPointerDownOutside={(event) => {
          if (!closeOnOverlayClick) {
            event.preventDefault();
            return;
          }
          onPointerDownOutside?.(event);
        }}
        onEscapeKeyDown={(event) => {
          if (!closeOnEscape) {
            event.preventDefault();
          }
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

type ModalLayoutProps = Readonly<{
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  onClose?: () => void;
  closeButtonDisabled?: boolean;
  hideCloseButton?: boolean;
}>;

function ModalHeader({
  title,
  description,
  onClose,
  closeButtonDisabled = false,
  hideCloseButton = false,
  headerClassName,
  titleClassName,
  descriptionClassName,
}: Readonly<
  Omit<ModalLayoutProps, "children" | "footer" | "className" | "bodyClassName" | "footerClassName">
>) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-[var(--border)] px-3 py-3", headerClassName)}>
      <div className="min-w-0">
        <DialogTitle className={cn("text-xl font-semibold text-[var(--foreground)]", titleClassName)}>{title}</DialogTitle>
        {description ? (
          <DialogDescription className={cn("mt-1 text-sm text-[var(--muted-foreground)]", descriptionClassName)}>
            {description}
          </DialogDescription>
        ) : null}
      </div>
      {!hideCloseButton && onClose ? (
        <Button
          unstyled
          type="button"
          onClick={onClose}
          disabled={closeButtonDisabled}
          className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      ) : null}
    </div>
  );
}

export function StandardModalLayout({
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  footerClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  onClose,
  closeButtonDisabled,
  hideCloseButton,
}: ModalLayoutProps) {
  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col bg-transparent", className)}>
      <ModalHeader
        title={title}
        description={description}
        onClose={onClose}
        closeButtonDisabled={closeButtonDisabled}
        hideCloseButton={hideCloseButton}
        headerClassName={headerClassName}
        titleClassName={titleClassName}
        descriptionClassName={descriptionClassName}
      />
      <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3", bodyClassName)}>{children}</div>
      {footer ? (
        <div className={cn("flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)] px-3 py-3", footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

type WizardModalLayoutProps = Readonly<
  Omit<ModalLayoutProps, "bodyClassName"> & {
    sidebar: React.ReactNode;
    mainHeader?: React.ReactNode;
    children: React.ReactNode;
    bodyClassName?: string;
    sidebarClassName?: string;
    mainClassName?: string;
    mainHeaderClassName?: string;
    mainBodyClassName?: string;
  }
>;

export function WizardModalLayout({
  title,
  description,
  sidebar,
  mainHeader,
  children,
  footer,
  className,
  bodyClassName,
  sidebarClassName,
  mainClassName,
  mainHeaderClassName,
  mainBodyClassName,
  footerClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  onClose,
  closeButtonDisabled,
  hideCloseButton,
}: WizardModalLayoutProps) {
  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col bg-transparent", className)}>
      <ModalHeader
        title={title}
        description={description}
        onClose={onClose}
        closeButtonDisabled={closeButtonDisabled}
        hideCloseButton={hideCloseButton}
        headerClassName={headerClassName}
        titleClassName={titleClassName}
        descriptionClassName={descriptionClassName}
      />
      <div className={cn("flex min-h-0 flex-1 overflow-hidden", bodyClassName)}>
        <div className={cn("w-2/5 overflow-y-auto border-r border-[var(--border)] p-3", sidebarClassName)}>{sidebar}</div>
        <div className={cn("flex min-h-0 w-3/5 flex-1 flex-col overflow-hidden", mainClassName)}>
          {mainHeader ? (
            <div className={cn("shrink-0 border-b border-[var(--border)] px-3 py-3", mainHeaderClassName)}>
              {mainHeader}
            </div>
          ) : null}
          <div className={cn("min-h-0 flex-1 overflow-y-auto p-3", mainBodyClassName)}>{children}</div>
        </div>
      </div>
      {footer ? (
        <div className={cn("flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border)] px-3 py-3", footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

type ConfirmModalLayoutProps = Readonly<
  ModalLayoutProps & {
    tone?: "default" | "warning" | "danger" | "success";
  }
>;

export function ConfirmModalLayout({
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  footerClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  onClose,
  closeButtonDisabled,
  hideCloseButton = true,
  tone = "default",
}: ConfirmModalLayoutProps) {
  const toneClasses = {
    default: {
      header: "border-[var(--border)]",
      footer: "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted),transparent_60%)]",
    },
    warning: {
      header: "border-[var(--tone-warning-border)]",
      footer: "border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg-soft)] dark:bg-[color-mix(in_srgb,var(--status-blocked),transparent_90%)]",
    },
    danger: {
      header: "border-[var(--tone-danger-border)]",
      footer: "border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg-soft)] dark:bg-[color-mix(in_srgb,var(--status-failure),transparent_90%)]",
    },
    success: {
      header: "border-[var(--tone-success-border)]",
      footer: "border-[var(--tone-success-border)] bg-[var(--tone-success-bg-soft)] dark:bg-[var(--tone-success-bg)]",
    },
  }[tone];

  return (
    <div className={cn("flex w-full flex-col bg-transparent", className)}>
      <ModalHeader
        title={title}
        description={description}
        onClose={onClose}
        closeButtonDisabled={closeButtonDisabled}
        hideCloseButton={hideCloseButton}
        headerClassName={cn("px-6 py-6", toneClasses.header, headerClassName)}
        titleClassName={cn("text-lg", titleClassName)}
        descriptionClassName={descriptionClassName}
      />
      <div className={cn("px-6 pb-6", bodyClassName)}>{children}</div>
      {footer ? (
        <div className={cn("flex flex-col-reverse gap-2 px-6 py-4 sm:flex-row sm:justify-end", toneClasses.footer, footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function ModalLayout(props: Readonly<ModalLayoutProps>) {
  return <StandardModalLayout {...props} hideCloseButton />;
}

export { AppModal as Modal };
