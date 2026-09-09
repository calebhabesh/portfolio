// Source: https://ui.aceternity.com/registry/background-ripple-effect.json
// Aceternity UI; local class helper and additive animations support overlapping ripples.
"use client";
import React, { useEffect, useMemo, useRef } from "react";
const cn = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export const BackgroundRippleEffect = ({
  rows = 8,
  cols = 27,
  cellSize = 56,
}: {
  rows?: number;
  cols?: number;
  cellSize?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const animations = useRef(new Set<Animation>());

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const cancelAnimations = () => {
      animations.current.forEach((animation) => animation.cancel());
      animations.current.clear();
    };
    const onMotionChange = () => {
      if (motion.matches) cancelAnimations();
    };
    motion.addEventListener("change", onMotionChange);
    return () => {
      motion.removeEventListener("change", onMotionChange);
      cancelAnimations();
    };
  }, [rows, cols, cellSize]);

  const startRipple = (row: number, col: number) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current?.querySelectorAll<HTMLElement>(".cell").forEach((cell, index) => {
      const distance = Math.hypot(row - Math.floor(index / cols), col - index % cols);
      // Add each pulse to the cell's base opacity instead of replacing other pulses.
      const animation = cell.animate(
        [{ opacity: 0 }, { opacity: 0.4 }, { opacity: 0 }],
        { delay: distance * 55, duration: 200 + distance * 80, easing: "ease-out", composite: "add" },
      );
      animations.current.add(animation);
      const forget = () => animations.current.delete(animation);
      animation.onfinish = forget;
      animation.oncancel = forget;
    });
  };

  return (
    <div
      ref={ref}
      className={cn(
        "absolute inset-0 h-full w-full",
        "[--cell-border-color:var(--color-neutral-300)] [--cell-fill-color:var(--color-neutral-100)] [--cell-shadow-color:var(--color-neutral-500)]",
        "dark:[--cell-border-color:var(--color-neutral-700)] dark:[--cell-fill-color:var(--color-neutral-900)] dark:[--cell-shadow-color:var(--color-neutral-800)]",
      )}
    >
      <div className="relative h-auto w-auto overflow-hidden">
        <div className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-hidden" />
        <DivGrid
          className="opacity-600"
          rows={rows}
          cols={cols}
          cellSize={cellSize}
          borderColor="var(--cell-border-color)"
          fillColor="var(--cell-fill-color)"
          onCellClick={startRipple}
          interactive
        />
      </div>
    </div>
  );
};

type DivGridProps = {
  className?: string;
  rows: number;
  cols: number;
  cellSize: number; // in pixels
  borderColor: string;
  fillColor: string;
  onCellClick?: (row: number, col: number) => void;
  interactive?: boolean;
};

const DivGrid = ({
  className,
  rows = 7,
  cols = 30,
  cellSize = 56,
  borderColor = "#3f3f46",
  fillColor = "rgba(14,165,233,0.3)",
  onCellClick = () => {},
  interactive = true,
}: DivGridProps) => {
  const cells = useMemo(
    () => Array.from({ length: rows * cols }, (_, idx) => idx),
    [rows, cols],
  );

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
    gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
    width: cols * cellSize,
    height: rows * cellSize,
    marginInline: "auto",
  };

  return (
    <div className={cn("relative z-[3]", className)} style={gridStyle}>
      {cells.map((idx) => {
        const rowIdx = Math.floor(idx / cols);
        const colIdx = idx % cols;
        return (
          <div
            key={idx}
            className={cn(
              "cell relative border-[0.5px] opacity-40 transition-opacity duration-150 will-change-transform hover:opacity-80 dark:shadow-[0px_0px_40px_1px_var(--cell-shadow-color)_inset]",
              !interactive && "pointer-events-none",
            )}
            style={{
              backgroundColor: fillColor,
              borderColor: borderColor,
            }}
            onClick={
              interactive ? () => onCellClick?.(rowIdx, colIdx) : undefined
            }
          />
        );
      })}
    </div>
  );
};
