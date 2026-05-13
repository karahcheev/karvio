// Editable tag list: text field, add control, removable chips; stacked or inline layout.

import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";
import { cn } from "@/shared/lib/cn";

export type TagInputLayout = "inline" | "stacked";
export type TagInputAddButtonStyle = "primary" | "muted";

export type TagInputProps = Readonly<{
  tags: string[];
  tagInput: string;
  onTagInputChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  layout?: TagInputLayout;
  addButtonStyle?: TagInputAddButtonStyle;
  placeholder?: string;
  inputClassName?: string;
  className?: string;
}>;

const addButtonClasses: Record<TagInputAddButtonStyle, string> = {
  primary:
    "rounded-lg bg-[var(--highlight-strong)] px-3 py-2 text-sm font-medium text-[var(--highlight-strong-foreground)] transition-opacity hover:opacity-90",
  muted:
    "rounded-lg border border-[var(--tag-toggle-border)] bg-[var(--tag-fill-bg)] px-3 py-2 text-sm text-[var(--tag-fill-foreground)] transition-colors hover:bg-[var(--tag-outline-bg)]",
};

export function TagInput({
  tags,
  tagInput,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  layout = "inline",
  addButtonStyle = "primary",
  placeholder = "Add tag...",
  inputClassName,
  className,
}: TagInputProps) {
  const inputRow =
    layout === "stacked" ? (
      <div className="flex gap-2">
        <Input
          type="text"
          value={tagInput}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddTag();
            }
          }}
          placeholder={placeholder}
          className={cn("min-w-0 flex-1", inputClassName)}
        />
        <Button type="button" unstyled onClick={onAddTag} className={addButtonClasses[addButtonStyle]}>
          Add
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-1">
        <Input
          type="text"
          value={tagInput}
          onChange={(event) => onTagInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAddTag();
            }
          }}
          placeholder={placeholder}
          className={cn("w-36", inputClassName)}
        />
        <Button type="button" unstyled onClick={onAddTag} className={addButtonClasses[addButtonStyle]}>
          Add
        </Button>
      </div>
    );

  if (layout === "stacked") {
    return (
      <div className={className}>
        {inputRow}
        {tags.length > 0 ? (
          <TagList gap="xs" className="mt-2">
            {tags.map((tag) => (
              <TagChip
                key={tag}
                removable
                onRemove={() => onRemoveTag(tag)}
                removeAriaLabel={`Remove tag ${tag}`}
              >
                {tag}
              </TagChip>
            ))}
          </TagList>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {tags.map((tag) => (
        <TagChip key={tag} removable onRemove={() => onRemoveTag(tag)} removeAriaLabel={`Remove tag ${tag}`}>
          {tag}
        </TagChip>
      ))}
      {inputRow}
    </div>
  );
}
