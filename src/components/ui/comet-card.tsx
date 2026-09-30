"use client";
import React, { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

export const CometCard = ({
  rotateDepth = 17.5,
  translateDepth = 20,
  className,
  disabled = false,
  children,
}: {
  rotateDepth?: number;
  translateDepth?: number;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const tilt = reduceMotion || disabled ? 0 : rotateDepth;
  const travel = reduceMotion || disabled ? 0 : translateDepth;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 260, damping: 34, mass: 0.55 });
  const mouseYSpring = useSpring(y, { stiffness: 260, damping: 34, mass: 0.55 });

  const rotateX = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`-${tilt}deg`, `${tilt}deg`],
  );
  const rotateY = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`${tilt}deg`, `-${tilt}deg`],
  );

  const translateX = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${travel}px`, `${travel}px`],
  );
  const translateY = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`${travel}px`, `-${travel}px`],
  );

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, var(--comet-glare), transparent 70%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduceMotion || disabled) return;

    const wrapper = ref.current.parentElement!;
    const rect = wrapper.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let xPct = Math.max(-0.5, Math.min(0.5, mouseX / width - 0.5));
    let yPct = Math.max(-0.5, Math.min(0.5, mouseY / height - 0.5));

    // Reserve the frame's inset for perspective growth and translation.
    // This conservative bound also covers taller cards with Notes open.
    const styles = getComputedStyle(wrapper);
    const inset = parseFloat(styles.getPropertyValue("--comet-inset"));
    if (inset > 0) {
      const perspective = parseFloat(styles.perspective) || 1200;
      const angle = tilt * Math.PI / 180;
      const halfSum = (width + height) / 2;
      const depth = halfSum * angle;
      const extent = Math.max(width, height) / 2 * depth / Math.max(1, perspective - depth)
        + travel + halfSum * angle * angle;
      const limit = Math.min(1, Math.max(0, inset - 0.5) / Math.max(extent, 0.001));
      xPct *= limit;
      yPct *= limit;
    }

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className={cn("perspective-distant", className)}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          translateX,
          translateY,
        }}
        className="comet-surface relative"
      >
        {children}
        <motion.div
          className="comet-glare pointer-events-none absolute inset-0 z-50 h-full w-full"
          style={{
            background: glareBackground,
          }}
        />
      </motion.div>
    </div>
  );
};
