// Tags that collapse to +N when space is tight (table cells) or when over maxVisible (count mode).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TagChip } from "@/shared/ui/TagChip";
import { TagList } from "@/shared/ui/TagList";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/Tooltip";
import { cn } from "@/shared/lib/cn";
import type { TagChipVariant } from "@/shared/ui/TagChip";

const TAG_GAP_PX = 4;

type BaseProps = Readonly<{
  tags: string[];
  emptyContent?: ReactNode;
  chipVariant?: TagChipVariant;
  /** Extra classes on the +N overflow chip (e.g. cursor-help). */
  overflowChipClassName?: string;
  tooltipContentClassName?: string;
  /** Chips shown inside the overflow tooltip. */
  renderTooltipTags?: (tags: string[]) => ReactNode;
}>;

type MeasureMode = BaseProps & Readonly<{
  mode?: "measure";
}>;

type CountMode = BaseProps & Readonly<{
  mode: "count";
  maxVisible: number;
}>;

export type OverflowTagListProps = MeasureMode | CountMode;

export function OverflowTagList(props: OverflowTagListProps) {
  const {
    tags,
    emptyContent = null,
    chipVariant = "fill",
    overflowChipClassName,
    tooltipContentClassName,
    renderTooltipTags,
  } = props;

  if (tags.length === 0) {
    return <>{emptyContent}</>;
  }

  if (props.mode === "count") {
    return (
      <CountOverflowTagList
        tags={tags}
        maxVisible={props.maxVisible}
        chipVariant={chipVariant}
        overflowChipClassName={overflowChipClassName}
        tooltipContentClassName={tooltipContentClassName}
        renderTooltipTags={renderTooltipTags}
      />
    );
  }

  return (
    <MeasureOverflowTagList
      tags={tags}
      chipVariant={chipVariant}
      overflowChipClassName={overflowChipClassName}
      tooltipContentClassName={tooltipContentClassName}
      renderTooltipTags={renderTooltipTags}
    />
  );
}

const overflowTagTooltipContentClass =
  "border border-[var(--highlight-border)] bg-[var(--highlight-bg-soft)] text-[var(--highlight-foreground)] shadow-lg";
const overflowTagTooltipArrowClass = "bg-[var(--highlight-bg-soft)] fill-[var(--highlight-bg-soft)]";

function DefaultOverflowTooltipTags({
  tags,
  chipVariant,
}: Readonly<{ tags: string[]; chipVariant: TagChipVariant }>) {
  return (
    <TagList gap="xs" className="max-w-xs">
      {tags.map((tag, index) => (
        <TagChip key={`${tag}-${index}`} variant={chipVariant}>
          {tag}
        </TagChip>
      ))}
    </TagList>
  );
}

function CountOverflowTagList({
  tags,
  maxVisible,
  chipVariant,
  overflowChipClassName,
  tooltipContentClassName,
  renderTooltipTags,
}: Readonly<{
  tags: string[];
  maxVisible: number;
  chipVariant: TagChipVariant;
  overflowChipClassName?: string;
  tooltipContentClassName?: string;
  renderTooltipTags?: (tags: string[]) => ReactNode;
}>) {
  if (tags.length <= maxVisible) {
    return (
      <TagList gap="xs">
        {tags.map((tag, index) => (
          <TagChip key={`${tag}-${index}`} variant={chipVariant}>
            {tag}
          </TagChip>
        ))}
      </TagList>
    );
  }

  const visible = tags.slice(0, maxVisible);
  const hidden = tags.slice(maxVisible);
  const hiddenCount = hidden.length;

  return (
    <TagList gap="xs">
      {visible.map((tag, index) => (
        <TagChip key={`${tag}-${index}`} variant={chipVariant}>
          {tag}
        </TagChip>
      ))}
      <Tooltip>
        <TooltipTrigger asChild>
          <TagChip variant={chipVariant} className={cn("cursor-help", overflowChipClassName)} aria-label={`${hiddenCount} more tags`}>
            +{hiddenCount}
          </TagChip>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className={cn(overflowTagTooltipContentClass, tooltipContentClassName)}
          arrowClassName={overflowTagTooltipArrowClass}
        >
          {renderTooltipTags ? renderTooltipTags(hidden) : <DefaultOverflowTooltipTags tags={hidden} chipVariant={chipVariant} />}
        </TooltipContent>
      </Tooltip>
    </TagList>
  );
}

function MeasureOverflowTagList({
  tags,
  chipVariant,
  overflowChipClassName,
  tooltipContentClassName,
  renderTooltipTags,
}: Readonly<{
  tags: string[];
  chipVariant: TagChipVariant;
  overflowChipClassName?: string;
  tooltipContentClassName?: string;
  renderTooltipTags?: (tags: string[]) => ReactNode;
}>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const allTagsMeasureRef = useRef<HTMLDivElement | null>(null);
  const firstTagMeasureRef = useRef<HTMLSpanElement | null>(null);
  const countMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [showAllTags, setShowAllTags] = useState(true);
  const [showFirstTag, setShowFirstTag] = useState(true);

  useEffect(() => {
    if (tags.length <= 1) {
      setShowAllTags(true);
      setShowFirstTag(true);
      return;
    }

    const recalculate = () => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const allTagsWidth = allTagsMeasureRef.current?.scrollWidth ?? 0;
      const firstTagWidth = firstTagMeasureRef.current?.offsetWidth ?? 0;
      const countWidth = countMeasureRef.current?.offsetWidth ?? 0;

      if (containerWidth <= 0) return;

      if (allTagsWidth <= containerWidth) {
        setShowAllTags(true);
        setShowFirstTag(true);
        return;
      }

      const firstWithCounterWidth = firstTagWidth + countWidth + TAG_GAP_PX;
      setShowAllTags(false);
      setShowFirstTag(firstWithCounterWidth <= containerWidth);
    };

    recalculate();

    const observer = new ResizeObserver(recalculate);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [tags]);

  if (tags.length === 1) {
    return (
      <TagChip variant={chipVariant} className={overflowChipClassName}>
        {tags[0]}
      </TagChip>
    );
  }

  const hiddenCount = showFirstTag ? tags.length - 1 : tags.length;

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div ref={allTagsMeasureRef} className="pointer-events-none absolute left-0 top-0 inline-flex gap-1 opacity-0">
        {tags.map((tag, index) => (
          <TagChip key={`measure-${tag}-${index}`} variant={chipVariant}>
            {tag}
          </TagChip>
        ))}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 inline-flex gap-1 opacity-0">
        <TagChip ref={firstTagMeasureRef} variant={chipVariant}>
          {tags[0]}
        </TagChip>
        <TagChip ref={countMeasureRef} variant={chipVariant}>
          +{tags.length - 1}
        </TagChip>
      </div>

      {showAllTags ? (
        <TagList gap="xs" className="min-w-0 flex-nowrap overflow-hidden">
          {tags.map((tag, index) => (
            <TagChip key={`${tag}-${index}`} variant={chipVariant}>
              {tag}
            </TagChip>
          ))}
        </TagList>
      ) : (
        <TagList gap="xs" className="min-w-0 flex-nowrap overflow-hidden">
          {showFirstTag ? (
            <TagChip variant={chipVariant} className={cn(overflowChipClassName, "min-w-0 max-w-full")}>
              {tags[0]}
            </TagChip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <TagChip variant={chipVariant} className={cn("cursor-help shrink-0", overflowChipClassName)}>
                +{hiddenCount}
              </TagChip>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={6}
              className={cn("max-w-xs", overflowTagTooltipContentClass, tooltipContentClassName)}
              arrowClassName={overflowTagTooltipArrowClass}
            >
              {renderTooltipTags ? renderTooltipTags(tags) : <DefaultOverflowTooltipTags tags={tags} chipVariant={chipVariant} />}
            </TooltipContent>
          </Tooltip>
        </TagList>
      )}
    </div>
  );
}
