import React from "react";

interface LuxuryToggleProps {
  isOn: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LuxuryToggle({
  isOn,
  onToggle,
  size = "md",
  className = "",
}: LuxuryToggleProps) {
  const sizeClasses = {
    sm: { track: "w-10 h-5", thumb: "w-4 h-4", translate: "translate-x-5" },
    md: { track: "w-12 h-6", thumb: "w-5 h-5", translate: "translate-x-6" },
    lg: { track: "w-14 h-7", thumb: "w-6 h-6", translate: "translate-x-7" },
  };

  const s = sizeClasses[size];

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative ${s.track} rounded-full p-0.5 transition-all duration-300 ${
        isOn
          ? "bg-gradient-to-r from-[#d4af37] to-[#f5e0a3] shadow-[0_0_12px_rgba(212,175,55,0.4)]"
          : "bg-[#1f1f22] border border-[#2a2a2e]"
      } ${className}`}
    >
      <div
        className={`${s.thumb} rounded-full shadow-md transition-transform duration-300 ${
          isOn
            ? `bg-[#0d0f12] ${s.translate}`
            : "bg-[#3a3a3e] translate-x-0"
        }`}
      />
    </button>
  );
}
