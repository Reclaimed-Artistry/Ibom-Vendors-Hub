"use client";

import type { ReactNode } from "react";

export function ConfirmSubmit({
  children,
  message,
  className = "btn btn-danger btn-sm",
  name,
  value,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
