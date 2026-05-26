"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { useToast } from "@/components/convenience/toast-provider";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
}

export function CopyButton({
  text,
  label = "Copy",
  variant = "outline",
  size = "sm",
}: CopyButtonProps) {
  const { showCopied } = useToast();
  const [done, setDone] = useState(false);

  const handleCopy = async () => {
    if (!text.trim()) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      showCopied();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={() => void handleCopy()} disabled={!text.trim()}>
      {done ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {label}
    </Button>
  );
}
