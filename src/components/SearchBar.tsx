"use client";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 border border-black/5 shadow-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
          stroke="#6B7280"
          strokeWidth="2"
        />
        <path
          d="M21 21l-4.35-4.35"
          stroke="#6B7280"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
      />
    </div>
  );
}