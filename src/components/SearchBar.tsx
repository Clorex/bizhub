"use client";

import { Search, X } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search\u2026",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 border border-gray-200 shadow-soft transition-all focus-within:ring-2 focus-within:ring-orange-200/60 focus-within:border-orange-300">
      <Search className="w-4 h-4 text-gray-400 shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="p-1 rounded-full hover:bg-gray-100 transition shrink-0"
          aria-label="Clear"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      )}
    </div>
  );
}
