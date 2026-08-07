import { Button, type ButtonProps } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardAddButtonProps extends ButtonProps {
  icon?: React.ReactNode;
}

export function WizardAddButton({
  children,
  icon,
  className,
  variant = "default",
  size = "sm",
  ...props
}: WizardAddButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("gap-1.5 text-xs font-medium", className)}
      {...props}
    >
      {icon ?? <Plus size={12} />}
      {children}
    </Button>
  );
}
