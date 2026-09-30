import React from "react";
import { HoverEffect } from "@/components/ui/card-hover-effect";

export default function CardHoverEffectDemo({ children, disabled }: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return <HoverEffect disabled={disabled}>{children}</HoverEffect>;
}
