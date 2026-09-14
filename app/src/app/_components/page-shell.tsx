import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({
  children,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        "container-page page-content max-w-3xl lg:max-w-4xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
