// Renders stored markdown as styled HTML with images, links, and a lightbox.

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { apiFetch } from "@/shared/api/client";
import { invokeMaybeAsync } from "@/shared/lib/invoke-maybe-async";
import { Button } from "@/shared/ui/Button";
import type { AttachmentDto } from "@/shared/api/tms/types";

// Attachment URL helpers

function isInternalAttachmentPath(src?: string): boolean {
  if (!src) return false;
  return src.startsWith("/attachments/");
}

// Inline markdown tokens within a single line (several small regexes — Sonar S5843 complexity limit)

type InlineTokenMatch =
  | { kind: "image"; alt: string; src?: string; length: number }
  | { kind: "link"; label: string; href: string; length: number }
  | { kind: "code"; content: string; length: number }
  | { kind: "bold"; content: string; length: number }
  | { kind: "italic"; content: string; length: number };

function matchInlineTokenAt(text: string, start: number): InlineTokenMatch | null {
  const rest = text.slice(start);

  const image = rest.match(/^!\[([^\]]*)\](?:\(([^)\s]+)\))?/);
  if (image) {
    return { kind: "image", alt: image[1] || "Step image", src: image[2], length: image[0].length };
  }

  const link = rest.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (link) {
    return { kind: "link", label: link[1], href: link[2], length: link[0].length };
  }

  const code = rest.match(/^`([^`]+)`/);
  if (code) {
    return { kind: "code", content: code[1], length: code[0].length };
  }

  const bold = rest.match(/^\*\*([^*]+)\*\*/);
  if (bold) {
    return { kind: "bold", content: bold[1], length: bold[0].length };
  }

  const italic = rest.match(/^\*([^*]+)\*/);
  if (italic) {
    return { kind: "italic", content: italic[1], length: italic[0].length };
  }

  return null;
}

function renderInlineTokenElement(
  token: InlineTokenMatch,
  key: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): ReactNode {
  switch (token.kind) {
    case "image": {
      if (imageResolver) {
        return imageResolver(token.alt, token.src);
      }
      return <MarkdownImage key={key} src={token.src} alt={token.alt} />;
    }
    case "link":
      return (
        <a
          key={key}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--highlight-foreground)] underline decoration-[var(--highlight-border)] underline-offset-2 hover:text-[var(--highlight-strong)]"
        >
          {token.label}
        </a>
      );
    case "code":
      return (
        <code key={key} className="rounded bg-[var(--secondary)] px-1 py-0.5 font-mono text-[0.9em] text-[var(--foreground)]">
          {token.content}
        </code>
      );
    case "bold":
      return (
        <strong key={key} className="font-semibold text-[var(--foreground)]">
          {token.content}
        </strong>
      );
    case "italic":
      return (
        <em key={key} className="italic">
          {token.content}
        </em>
      );
    default: {
      const _exhaustive: never = token;
      return _exhaustive;
    }
  }
}

function renderInlineMarkdown(
  text: string,
  imageResolver?: (alt: string, src?: string) => ReactNode
): ReactNode[] {
  const result: ReactNode[] = [];
  let i = 0;
  let plainStart = 0;

  while (i < text.length) {
    const token = matchInlineTokenAt(text, i);
    if (token) {
      if (plainStart < i) {
        result.push(text.slice(plainStart, i));
      }

      result.push(renderInlineTokenElement(token, `inline-${i}`, imageResolver));

      i += token.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }

  if (plainStart < text.length) {
    result.push(text.slice(plainStart));
  }

  return result;
}

// Inline image: resolves internal attachments and optional fullscreen preview

function MarkdownImage({ src, alt }: Readonly<{ src?: string; alt: string }>) {
  const previewDialogRef = useRef<HTMLDialogElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!src) return null;
    return isInternalAttachmentPath(src) ? null : src;
  });
  const [hasError, setHasError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch blob URL for `/attachments/...` paths

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setHasError(false);
      return;
    }

    if (!isInternalAttachmentPath(src)) {
      setResolvedSrc(src);
      setHasError(false);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;
    setResolvedSrc(null);
    setHasError(false);

    invokeMaybeAsync(() =>
      apiFetch(src)
        .then(async (response) => {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setResolvedSrc(objectUrl);
          }
        })
        .catch(() => {
          if (isMounted) {
            setHasError(true);
          }
        }),
    );

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const dialog = previewDialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, [isPreviewOpen]);

  if (!src) {
    return <span className="text-sm text-[var(--muted-foreground)]">Image "{alt}"</span>;
  }

  if (hasError) {
    return <span className="text-sm text-[var(--status-failure)]">Failed to load image.</span>;
  }

  if (!resolvedSrc) {
    return (
      <span className="inline-flex h-24 w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--muted-foreground)]">
        Loading image...
      </span>
    );
  }

  return (
    <>
      {/* Thumbnail */}
      <Button unstyled
        type="button"
        onClick={() => setIsPreviewOpen(true)}
        className="my-2 block w-fit rounded-lg border border-[var(--border)] bg-[var(--card)]"
        title="Open image preview"
      >
        <img
          src={resolvedSrc}
          alt={alt}
          className="max-h-80 rounded-lg object-contain transition-opacity hover:opacity-95"
        />
      </Button>

      {/* Fullscreen preview — native <dialog> for a11y (Sonar S6819, S6847) */}
      {isPreviewOpen ? (
        <dialog
          ref={previewDialogRef}
          className="fixed inset-0 z-50 m-0 flex max-h-none min-h-0 w-full max-w-none min-w-0 items-center justify-center border-0 bg-transparent p-3 backdrop:bg-black/80 open:flex"
          aria-label={`Image preview: ${alt}`}
          onCancel={(event) => {
            event.preventDefault();
            setIsPreviewOpen(false);
          }}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 min-h-full min-w-full cursor-default border-0 bg-transparent p-0"
            aria-label="Close preview"
            onClick={() => setIsPreviewOpen(false)}
          />
          <Button unstyled
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-[color-mix(in_srgb,var(--card),transparent_90%)] p-2 text-white transition hover:bg-[color-mix(in_srgb,var(--card),transparent_80%)]"
            onClick={(event) => {
              event.stopPropagation();
              setIsPreviewOpen(false);
            }}
            title="Close preview"
          >
            <X className="h-5 w-5" />
          </Button>
          <button
            type="button"
            className="relative z-10 max-h-[90vh] max-w-[90vw] cursor-default border-0 bg-transparent p-0"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={resolvedSrc}
              alt={alt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </button>
        </dialog>
      ) : null}
    </>
  );
}

// Block-level markdown: code fences, headings, quotes, lists, paragraphs

function consumeMarkdownCodeFence(
  lines: string[],
  startIndex: number,
  blockKey: string,
): { nextIndex: number; node: ReactNode } {
  let index = startIndex + 1;
  const codeLines: string[] = [];
  while (index < lines.length && !lines[index].trim().startsWith("```")) {
    codeLines.push(lines[index]);
    index += 1;
  }
  if (index < lines.length) {
    index += 1;
  }
  return {
    nextIndex: index,
    node: (
      <pre
        key={blockKey}
        className="overflow-x-auto rounded-lg bg-[var(--popover)] px-3 py-2 text-xs text-[var(--foreground)]"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>
    ),
  };
}

function consumeMarkdownQuoteBlock(
  lines: string[],
  startIndex: number,
  blockKey: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): { nextIndex: number; node: ReactNode } {
  let index = startIndex;
  const quoteLines: string[] = [];
  while (index < lines.length && lines[index].trim().startsWith("> ")) {
    quoteLines.push(lines[index].trim().slice(2));
    index += 1;
  }
  let quoteOffset = 0;
  return {
    nextIndex: index,
    node: (
      <blockquote key={blockKey} className="border-l-4 border-[var(--border)] pl-3 italic text-[var(--muted-foreground)]">
        {quoteLines.map((quoteLine) => {
          const key = `${blockKey}-quote-${quoteOffset}`;
          const isFirst = quoteOffset === 0;
          quoteOffset += quoteLine.length + 1;
          return (
            <Fragment key={key}>
              {!isFirst ? <br /> : null}
              {renderInlineMarkdown(quoteLine, imageResolver)}
            </Fragment>
          );
        })}
      </blockquote>
    ),
  };
}

function consumeMarkdownBulletList(
  lines: string[],
  startIndex: number,
  blockKey: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): { nextIndex: number; node: ReactNode } {
  let index = startIndex;
  const items: string[] = [];
  while (index < lines.length && lines[index].trim().startsWith("- ")) {
    items.push(lines[index].trim().slice(2));
    index += 1;
  }
  let bulletOffset = 0;
  return {
    nextIndex: index,
    node: (
      <ul key={blockKey} className="list-disc space-y-1 pl-5">
        {items.map((item) => {
          const key = `${blockKey}-bullet-${bulletOffset}`;
          bulletOffset += item.length + 1;
          return (
            <li key={key}>{renderInlineMarkdown(item, imageResolver)}</li>
          );
        })}
      </ul>
    ),
  };
}

function consumeMarkdownOrderedList(
  lines: string[],
  startIndex: number,
  blockKey: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): { nextIndex: number; node: ReactNode } {
  let index = startIndex;
  const items: string[] = [];
  while (index < lines.length && /^\d+\. /.test(lines[index].trim())) {
    items.push(lines[index].trim().replace(/^\d+\. /, ""));
    index += 1;
  }
  let orderedOffset = 0;
  return {
    nextIndex: index,
    node: (
      <ol key={blockKey} className="list-decimal space-y-1 pl-5">
        {items.map((item) => {
          const key = `${blockKey}-ordered-${orderedOffset}`;
          orderedOffset += item.length + 1;
          return (
            <li key={key}>{renderInlineMarkdown(item, imageResolver)}</li>
          );
        })}
      </ol>
    ),
  };
}

function isParagraphBoundary(trimmed: string): boolean {
  return (
    !trimmed ||
    trimmed.startsWith("```") ||
    trimmed.startsWith("## ") ||
    trimmed.startsWith("> ") ||
    trimmed.startsWith("- ") ||
    /^\d+\. /.test(trimmed)
  );
}

function consumeMarkdownParagraph(
  lines: string[],
  startIndex: number,
  blockKey: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): { nextIndex: number; node: ReactNode } {
  const paragraphLines: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const paragraphLine = lines[index];
    const paragraphTrimmed = paragraphLine.trim();
    if (isParagraphBoundary(paragraphTrimmed)) {
      break;
    }
    paragraphLines.push(paragraphLine);
    index += 1;
  }
  let paragraphOffset = 0;
  return {
    nextIndex: index,
    node: (
      <p key={blockKey} className="leading-6 text-[var(--foreground)]">
        {paragraphLines.map((paragraphLine) => {
          const key = `${blockKey}-paragraph-${paragraphOffset}`;
          const isFirst = paragraphOffset === 0;
          paragraphOffset += paragraphLine.length + 1;
          return (
            <Fragment key={key}>
              {!isFirst ? <br /> : null}
              {renderInlineMarkdown(paragraphLine, imageResolver)}
            </Fragment>
          );
        })}
      </p>
    ),
  };
}

function renderMarkdownBlocks(
  value: string,
  imageResolver?: (alt: string, src?: string) => ReactNode,
): ReactNode[] {
  const lines = value.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const blockKey = `block-${blocks.length}`;

    if (trimmed.startsWith("```")) {
      const consumed = consumeMarkdownCodeFence(lines, index, blockKey);
      blocks.push(consumed.node);
      index = consumed.nextIndex;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3 key={blockKey} className="text-base font-semibold text-[var(--foreground)]">
          {renderInlineMarkdown(trimmed.slice(3), imageResolver)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      const consumed = consumeMarkdownQuoteBlock(lines, index, blockKey, imageResolver);
      blocks.push(consumed.node);
      index = consumed.nextIndex;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const consumed = consumeMarkdownBulletList(lines, index, blockKey, imageResolver);
      blocks.push(consumed.node);
      index = consumed.nextIndex;
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      const consumed = consumeMarkdownOrderedList(lines, index, blockKey, imageResolver);
      blocks.push(consumed.node);
      index = consumed.nextIndex;
      continue;
    }

    const consumed = consumeMarkdownParagraph(lines, index, blockKey, imageResolver);
    blocks.push(consumed.node);
    index = consumed.nextIndex;
  }

  return blocks;
}

export type RichTextPreviewProps = Readonly<{
  /** Optional caption rendered above the preview. Omit when the surrounding container already provides a heading. */
  label?: string;
  value: string;
  emptyMessage: string;
  attachments?: AttachmentDto[];
  testCaseId?: string;
  stepId?: string;
}>;

export function RichTextPreview({
  label,
  value,
  emptyMessage,
  attachments = [],
  testCaseId,
  stepId: _stepId = "preview",
}: RichTextPreviewProps) {
  if (!value.trim()) {
    return (
      <div>
        {label ? (
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
        ) : null}
        {/* Empty state */}
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-sm text-[var(--muted-foreground)]">
          {emptyMessage}
        </div>
      </div>
    );
  }

  // Map attachment filenames to fetched image URLs when `src` is omitted

  const resolveImage = (alt: string, src?: string): ReactNode => {
    if (src) {
      return (
        <Fragment key={`${alt}-${src}`}>
          <MarkdownImage src={src} alt={alt} />
        </Fragment>
      );
    }

    const attachment = attachments.find((item) => item.filename === alt);
    if (!attachment || !testCaseId) {
      return (
        <Fragment key={alt}>
          <MarkdownImage alt={alt} />
        </Fragment>
      );
    }

    return (
      <Fragment key={attachment.id}>
        <MarkdownImage src={`/attachments/${attachment.id}`} alt={alt} />
      </Fragment>
    );
  };

  return (
    <div>
      {label ? (
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      ) : null}
      {/* Rendered document */}
      <div className="min-h-[140px] space-y-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3 py-3 text-sm break-words">
        {renderMarkdownBlocks(value, resolveImage)}
      </div>
    </div>
  );
}
