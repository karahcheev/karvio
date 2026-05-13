// Markdown-oriented rich text editor: toolbar formatters, image upload, and textarea.

import {
  Bold,
  Code,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  WrapText,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/shared/ui/Button";

type Formatter = {
  label: string;
  icon: typeof Bold;
  title: string;
  apply: (selectedText: string) => { text: string; selectionStart?: number; selectionEnd?: number };
};

// Built-in markdown insertion actions for the toolbar

const formatters: Formatter[] = [
  { label: "H2", icon: Heading2, title: "Heading", apply: (t = "Heading") => ({ text: `## ${t}` }) },
  {
    label: "Bold",
    icon: Bold,
    title: "Bold",
    apply: (t = "bold text") => ({
      text: `**${t}**`,
      selectionStart: 2,
      selectionEnd: 2 + t.length,
    }),
  },
  {
    label: "Italic",
    icon: Italic,
    title: "Italic",
    apply: (t = "italic text") => ({
      text: `*${t}*`,
      selectionStart: 1,
      selectionEnd: 1 + t.length,
    }),
  },
  {
    label: "Link",
    icon: LinkIcon,
    title: "Link",
    apply: (t = "link text") => {
      const text = `[${t}](https://example.com)`;
      return { text, selectionStart: t.length + 3, selectionEnd: text.length - 1 };
    },
  },
  {
    label: "List",
    icon: List,
    title: "Bullet list",
    apply: (t = "Item 1\nItem 2") => ({
      text: t.split("\n").map((line) => `- ${line}`).join("\n"),
    }),
  },
  {
    label: "Ordered",
    icon: ListOrdered,
    title: "Numbered list",
    apply: (t = "First item\nSecond item") => ({
      text: t.split("\n").map((line, i) => `${i + 1}. ${line}`).join("\n"),
    }),
  },
  {
    label: "Quote",
    icon: Quote,
    title: "Quote",
    apply: (t = "Quoted text") => ({ text: t.split("\n").map((line) => `> ${line}`).join("\n") }),
  },
  {
    label: "Code",
    icon: Code,
    title: "Inline code",
    apply: (t = "code") => ({
      text: `\`${t}\``,
      selectionStart: 1,
      selectionEnd: 1 + t.length,
    }),
  },
  {
    label: "Code block",
    icon: WrapText,
    title: "Code block",
    apply: (t = "const value = true;") => {
      const text = `\`\`\`\n${t}\n\`\`\``;
      return { text, selectionStart: 4, selectionEnd: 4 + t.length };
    },
  },
];

export type RichTextEditorProps = Readonly<{
  label: string;
  value: string;
  placeholder: string;
  minRows?: number;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
  canUploadImage?: boolean;
  imageUploadTitle?: string;
}>;

export function RichTextEditor({
  label,
  value,
  placeholder,
  minRows = 5,
  onChange,
  onImageUpload,
  canUploadImage = true,
  imageUploadTitle = "Upload image",
}: RichTextEditorProps) {
  // Refs and upload state

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Toolbar and image insertion handlers

  const applyFormatting = (formatter: Formatter) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? selectionStart;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const result = formatter.apply(selectedText);
    const nextValue = `${before}${result.text}${after}`;
    const baseOffset = before.length;

    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const start =
        result.selectionStart !== undefined ? baseOffset + result.selectionStart : baseOffset + result.text.length;
      const end = result.selectionEnd !== undefined ? baseOffset + result.selectionEnd : start;
      textarea.setSelectionRange(start, end);
    });
  };

  const handleImageButtonClick = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      imageSelectionRef.current = {
        start: textarea.selectionStart ?? 0,
        end: textarea.selectionEnd ?? textarea.selectionStart ?? 0,
      };
    }
    imageInputRef.current?.click();
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImageUpload) return;

    const textarea = textareaRef.current;
    const selection = imageSelectionRef.current ?? {
      start: textarea?.selectionStart ?? value.length,
      end: textarea?.selectionEnd ?? value.length,
    };

    setIsUploadingImage(true);
    try {
      const imageMarkdown = await onImageUpload(file);
      if (!imageMarkdown) return;

      const before = value.slice(0, selection.start);
      const after = value.slice(selection.end);
      const needsLeadingNewline = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
      const needsTrailingNewline = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
      const inserted = `${needsLeadingNewline}${imageMarkdown}${needsTrailingNewline}`;
      const nextValue = `${before}${inserted}${after}`;
      const caretPosition = before.length + inserted.length;

      onChange(nextValue);

      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(caretPosition, caretPosition);
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] focus-within:border-[var(--highlight-border)] focus-within:ring-1 focus-within:ring-[var(--control-focus-ring)]">
        {/* Hidden file input for images */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!onImageUpload || !canUploadImage || isUploadingImage}
          onChange={(event) => void handleImageChange(event)}
        />
        {/* Formatting toolbar */}
        <div className="flex flex-wrap gap-1 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-2">
          {formatters.map((formatter) => {
            const Icon = formatter.icon;
            return (
              <Button unstyled
                key={formatter.label}
                type="button"
                onClick={() => applyFormatting(formatter)}
                title={formatter.title}
                className="inline-flex items-center justify-center rounded-md p-2 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--card)] hover:text-[var(--foreground)]"
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            );
          })}
          <Button unstyled
            type="button"
            onClick={handleImageButtonClick}
            disabled={!onImageUpload || !canUploadImage || isUploadingImage}
            title={imageUploadTitle}
            className="inline-flex items-center justify-center rounded-md p-2 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--card)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImageIcon className={`h-3.5 w-3.5 ${isUploadingImage ? "animate-pulse" : ""}`} />
          </Button>
        </div>
        {/* Editor surface */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="min-h-[140px] w-full resize-y border-0 px-3 py-2 text-sm outline-none"
        />
      </div>
      {/* Hint */}
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        Markdown supported: links, lists, quotes, inline code and fenced code blocks.
      </p>
    </div>
  );
}
