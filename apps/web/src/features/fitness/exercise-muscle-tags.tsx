"use client";
import { useEffect, useRef, useState } from "react";

export function ExerciseMuscleTags({ muscles }: { muscles: string[] }) {
  const root = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(muscles.length);
  const signature = muscles.join("|");
  useEffect(() => {
    const container = root.current;
    const probe = measure.current;
    if (!container || !probe) return;
    const update = () => {
      const widths = Array.from(
        probe.children,
        (node) => node.getBoundingClientRect().width,
      );
      const total = widths.length / 2;
      const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
      let count = total;
      while (count > 0) {
        const tagsWidth =
          widths.slice(0, count).reduce((a, b) => a + b, 0) +
          Math.max(0, count - 1) * gap;
        const overflowWidth =
          count < total ? gap + widths[total + (total - count) - 1]! : 0;
        if (tagsWidth + overflowWidth <= container.clientWidth) break;
        count--;
      }
      setVisible(count);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [signature]);
  const count = Math.min(visible, muscles.length);
  return (
    <span ref={root} className="fitness-library-card-muscles">
      <span
        ref={measure}
        className="fitness-card-muscle-measure"
        aria-hidden="true"
      >
        {muscles.map((muscle) => (
          <span className="fitness-card-muscle-tag" key={muscle}>
            {muscle}
          </span>
        ))}
        {muscles.map((_, index) => (
          <span className="fitness-card-muscle-tag" key={`count-${index}`}>
            +{index + 1}
          </span>
        ))}
      </span>
      {muscles.slice(0, count).map((muscle) => (
        <span className="fitness-card-muscle-tag" key={muscle}>
          {muscle}
        </span>
      ))}
      {count < muscles.length && (
        <span
          className="fitness-card-muscle-tag"
          title={muscles.slice(count).join(", ")}
        >
          +{muscles.length - count}
        </span>
      )}
      {!muscles.length && (
        <span className="fitness-card-muscle-empty">No muscles specified</span>
      )}
    </span>
  );
}
