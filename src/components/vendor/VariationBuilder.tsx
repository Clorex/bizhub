"use client";

import { useMemo, useState } from "react";

export type OptionGroup = { name: string; values: string[] };

const SUGGESTIONS = [
  "Color",
  "Size",
  "Material",
  "Weight",
  "Length",
  "Model",
  "Brand",
  "Condition",
  "Flavor",
  "Type",
];

export function VariationBuilder({
  value,
  onChange,
  maxGroups = 10,
}: {
  value: OptionGroup[];
  onChange: (v: OptionGroup[]) => void;
  maxGroups?: number;
}) {
  const [newName, setNewName] = useState("");

  const canAddMore = value.length < maxGroups;

  const availableSuggestions = useMemo(() => {
    const used = new Set(value.map((g) => g.name.toLowerCase()));
    return SUGGESTIONS.filter((s) => !used.has(s.toLowerCase()));
  }, [value]);

  function addGroup(name: string) {
    const n = name.trim();
    if (!n) return;
    if (!canAddMore) return;

    const exists = value.some((g) => g.name.toLowerCase() === n.toLowerCase());
    if (exists) return;

    onChange([...value, { name: n, values: [] }]);
    setNewName("");
  }

  function removeGroup(name: string) {
    onChange(value.filter((g) => g.name !== name));
  }

  function addValue(groupName: string, v: string) {
    const val = v.trim();
    if (!val) return;

    onChange(
      value.map((g) => {
        if (g.name !== groupName) return g;
        if (g.values.includes(val)) return g;
        return { ...g, values: [...g.values, val] };
      })
    );
  }

  function removeValue(groupName: string, v: string) {
    onChange(
      value.map((g) => {
        if (g.name !== groupName) return g;
        return { ...g, values: g.values.filter((x) => x !== v) };
      })
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold text-[#111827]">Variations</p>
        <p className="text-xs text-gray-600 mt-1">
          Customers can choose options, but price/stock stays the same.
        </p>
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {availableSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => addGroup(s)}
            disabled={!canAddMore}
            className="px-4 py-2 rounded-full text-xs font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-40"
          >
            + {s}
          </button>
        ))}
      </div>

      {/* Custom group */}
      <div className="flex gap-2">
        <input
          className="flex-1 border border-[#E7E7EE] rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-[#FF8A00]/35"
          placeholder="Add custom variation (e.g. Sleeve)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={20}
        />
        <button
          className="px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-40"
          onClick={() => addGroup(newName)}
          disabled={!newName.trim() || !canAddMore}
        >
          Add
        </button>
      </div>

      {/* Groups */}
      {value.map((g) => (
        <div key={g.name} className="rounded-2xl border border-[#E7E7EE] bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="font-extrabold text-[#111827]">{g.name}</p>
            <button
              className="text-xs font-extrabold text-red-600"
              onClick={() => removeGroup(g.name)}
            >
              Remove
            </button>
          </div>

          <GroupValues
            group={g}
            onAdd={(v) => addValue(g.name, v)}
            onRemove={(v) => removeValue(g.name, v)}
          />
        </div>
      ))}

      <p className="text-xs text-gray-500">
        Max variations: {maxGroups}. Current: {value.length}.
      </p>
    </div>
  );
}

function GroupValues({
  group,
  onAdd,
  onRemove,
}: {
  group: OptionGroup;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [val, setVal] = useState("");

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          className="flex-1 border border-[#E7E7EE] rounded-2xl p-3 text-sm"
          placeholder={`Add ${group.name} value (e.g. Black)`}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button
          className="px-4 rounded-2xl text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00] disabled:opacity-40"
          onClick={() => {
            onAdd(val);
            setVal("");
          }}
          disabled={!val.trim()}
        >
          Add
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {group.values.map((v) => (
          <button
            key={v}
            onClick={() => onRemove(v)}
            className="px-4 py-2 rounded-full text-xs font-extrabold bg-[#FFF3E1] text-[#111827]"
            title="Click to remove"
          >
            {v} ×
          </button>
        ))}
      </div>
    </div>
  );
}