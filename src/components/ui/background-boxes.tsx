"use client";
import React, { useEffect, useRef } from "react";
import { initGridPointerTrail } from "@/grid-pointer-trail";
import { cn } from "@/lib/utils";

// Adapted from Aceternity Background Boxes. The existing blueprint supplies
// the lattice; a transparent canvas paints only the transient colored cells.
export const Boxes = React.memo(({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) return initGridPointerTrail(canvasRef.current);
  }, []);

  return <canvas ref={canvasRef} className={cn("grid-pointer-trail", className)} aria-hidden="true" />;
});
