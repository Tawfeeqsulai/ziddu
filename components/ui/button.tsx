import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

export function Button({ variant = "primary", loading = false, className = "", disabled, children, ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} disabled={disabled || loading} {...props}>{loading ? "Loading..." : children}</button>;
}
