"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
export function FilterTagRow({ children }: { children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const element = row.current;
    if (!element) return;
    const left = element.scrollLeft > 1;
    const right =
      element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
    setEdges((previous) =>
      previous.left === left && previous.right === right
        ? previous
        : { left, right },
    );
  }, []);
  useLayoutEffect(() => {
    const element = row.current;
    if (!element) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    Array.from(element.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [children, updateEdges]);
  return (
    <div
      ref={row}
      className="fitness-active-filter-values"
      role="region"
      aria-label="Selected filters"
      tabIndex={0}
      data-overflow-left={edges.left}
      data-overflow-right={edges.right}
      onScroll={updateEdges}
    >
      {children}
    </div>
  );
}
