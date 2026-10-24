import { cn } from "@/lib/utils";

/** Тонкая декоративная линия-разделитель: плавно появляется и исчезает */
export function SmartCardDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-px w-full shrink-0 bg-gradient-to-r from-transparent via-[#d4af37]/25 to-transparent",
        className
      )}
    />
  );
}