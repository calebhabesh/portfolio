"use client";
import React, { createContext, useContext, useState, type HTMLAttributes } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type HoverState = {
  activeId: string | null;
  setHovered: (id: string | null) => void;
  setFocused: (id: string | null) => void;
};
const HoverContext = createContext<HoverState | null>(null);

// Aceternity's shared hover background, adapted to existing card contents.
// Keep links/buttons inside each card rather than wrapping them in an anchor.
export function HoverEffect({ children, disabled = false }: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  return (
    <HoverContext.Provider value={{ activeId: disabled ? null : hovered ?? focused, setHovered, setFocused }}>
      {children}
    </HoverContext.Provider>
  );
}

export function HoverEffectItem({ itemId, children, ...props }: HTMLAttributes<HTMLDivElement> & { itemId: string }) {
  const state = useContext(HoverContext);
  const reduceMotion = useReducedMotion();
  const highlighted = state?.activeId === itemId;
  return (
    <div
      {...props}
      onPointerEnter={event => {
        if (event.pointerType !== "touch") state?.setHovered(itemId);
      }}
      onPointerLeave={() => state?.setHovered(null)}
      onFocus={() => state?.setFocused(itemId)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) state?.setFocused(null);
      }}
    >
      <AnimatePresence>
        {highlighted && (
          <motion.span
            aria-hidden="true"
            className="project-hover-background"
            layoutId={reduceMotion ? undefined : "project-hover-background"}
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.15, delay: reduceMotion ? 0 : 0.2 } }}
            transition={{ layout: { duration: 0.25, ease: "easeInOut" }, opacity: { duration: reduceMotion ? 0 : 0.15 } }}
          />
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
