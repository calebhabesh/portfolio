"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "top" | "right" | "bottom" | "left";

// Adapted from Aceternity's Direction Aware Hover for responsive portraits.
export const DirectionAwareHover = ({
  imageUrl,
  alt,
  className,
  imageClassName,
}: {
  imageUrl: string;
  alt: string;
  className?: string;
  imageClassName?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [direction, setDirection] = useState<Direction | null>(null);

  const handlePointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current || event.pointerType === "touch" || reduceMotion) return;
    const { width, height, left, top } = ref.current.getBoundingClientRect();
    const x = (event.clientX - left) / width - 0.5;
    const y = (event.clientY - top) / height - 0.5;
    const index = Math.round(Math.atan2(y, x) / (Math.PI / 2) + 5) % 4;
    setDirection((["top", "right", "bottom", "left"] as const)[index]);
  };

  const active = !reduceMotion && direction !== null;

  return (
    <div
      ref={ref}
      className={cn("direction-aware-hover", className)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={() => setDirection(null)}
      onPointerCancel={() => setDirection(null)}
    >
      <motion.img
        src={imageUrl}
        alt={alt}
        width={44}
        height={44}
        className={cn("direction-aware-hover-image", imageClassName)}
        initial={false}
        animate={active ? direction : "initial"}
        variants={variants}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
      />
    </div>
  );
};

// Percentage travel fits both desktop and mobile without exposing image edges.
const variants = {
  initial: { x: "0%", y: "0%", scale: 1 },
  top: { x: "0%", y: "5%", scale: 1.15 },
  right: { x: "-5%", y: "0%", scale: 1.15 },
  bottom: { x: "0%", y: "-5%", scale: 1.15 },
  left: { x: "5%", y: "0%", scale: 1.15 },
};
