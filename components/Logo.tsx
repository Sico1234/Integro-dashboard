'use client';

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary shrink-0">
        <div className="flex flex-col gap-1 w-4">
          <div className="h-0.5 w-full bg-white rounded-full" />
          <div className="h-0.5 w-full bg-white rounded-full" />
          <div className="h-0.5 w-full bg-white rounded-full" />
        </div>
      </div>
      {!iconOnly && (
        <span className="font-bold text-xl tracking-[0.2em] text-primary uppercase">
          Integro
        </span>
      )}
    </div>
  );
}
