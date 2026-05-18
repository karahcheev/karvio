import { useEffect } from "react";
import type { RefObject } from "react";

export function useOnClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: () => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const container = ref.current;
      const target = event.target as Node | null;
      if (!container || !target || container.contains(target)) {
        return;
      }
      onOutsideClick();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [enabled, onOutsideClick, ref]);
}
