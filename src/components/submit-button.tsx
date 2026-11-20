"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
  variant = "primary",
  size,
  pendingLabel,
  formAction,
  name,
  value,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "gold" | "ghost";
  size?: "sm";
  pendingLabel?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const variants = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    danger: "btn-danger",
    gold: "btn-gold",
    ghost: "btn-ghost",
  };
  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      disabled={pending || disabled}
      className={cn(variants[variant], size === "sm" && "btn-sm", className)}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
