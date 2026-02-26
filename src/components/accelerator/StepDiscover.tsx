// FILE: src/components/accelerator/StepDiscover.tsx
"use client";

import { useState, useMemo } from "react";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";
import { NG_STATES, areasForState } from "@/lib/locations/ngPopularAreas";
import type { AcceleratorInterest, AcceleratorProfile, TimeAvailability } from "@/lib/accelerator/types";
import { Sparkles, MapPin } from "lucide-react";

const INTERESTS: { key: AcceleratorInterest; label: string; emoji: string }[] = [
  { key: "food", label: "Food", emoji: "\uD83C\uDF5C" },
  { key: "fashion", label: "Fashion", emoji: "\uD83D\uDC57" },
  { key: "beauty", label: "Beauty", emoji: "\uD83D\uDC85" },
  { key: "tech", label: "Tech", emoji: "\uD83D\uDCF1" },
  { key: "digital", label: "Digital", emoji: "\uD83D\uDCBB" },
  { key: "retail", label: "Retail", emoji: "\uD83D\uDED2" },
  { key: "services", label: "Services", emoji: "\u2702\uFE0F" },
];

const SKILL_SUGGESTIONS = [
  "Cooking", "Baking", "Sewing", "Photography", "Graphic design",
  "Social media", "Sales", "Customer service", "Writing", "Coding",
  "Hair styling", "Makeup", "Event planning", "Trading", "Marketing",
];

const BUDGET_MARKS = [
  { value: 50000, label: "\u20A650k" },
  { value: 200000, label: "\u20A6200k" },
  { value: 500000, label: "\u20A6500k" },
  { value: 1000000, label: "\u20A61m" },
  { value: 2000000, label: "\u20A62m" },
  { value: 5000000, label: "\u20A65m+" },
];

interface Props {
  onComplete: (profile: AcceleratorProfile) => void;
}

export function StepDiscover({ onComplete }: Props) {
  const [interests, setInterests] = useState<AcceleratorInterest[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [budgetIndex, setBudgetIndex] = useState(1);
  const [timeAvailability, setTimeAvailability] = useState<TimeAvailability>("side-hustle");
  const [state, setState] = useState("");
  const [area, setArea] = useState("");

  const areas = useMemo(() => areasForState(state), [state]);

  const toggleInterest = (key: AcceleratorInterest) => {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addSkill = (skill: string) => {
    const clean = skill.trim();
    if (clean && !skills.includes(clean)) {
      setSkills((prev) => [...prev, clean]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const canProceed = interests.length > 0;

  const budgetMin = BUDGET_MARKS[budgetIndex]?.value || 50000;
  const budgetMax = BUDGET_MARKS[Math.min(budgetIndex + 1, BUDGET_MARKS.length - 1)]?.value || 5000000;

  const handleSubmit = () => {
    onComplete({
      interests,
      skills,
      budgetMin,
      budgetMax,
      timeAvailability,
      location: { state, area },
    });
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          Let&apos;s find the right business for you.
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Don&apos;t worry. You can change this later.
        </p>
      </div>

      {/* Interests */}
      <Card className="p-4">
        <p className="text-sm font-bold text-gray-900 mb-3">
          What are you interested in?
        </p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((item) => (
            <Chip
              key={item.key}
              active={interests.includes(item.key)}
              onClick={() => toggleInterest(item.key)}
            >
              {item.emoji} {item.label}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Skills */}
      <Card className="p-4">
        <p className="text-sm font-bold text-gray-900 mb-2">
          What skills do you have?
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-300"
            placeholder="Type a skill..."
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill(skillInput);
              }
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => addSkill(skillInput)}
            disabled={!skillInput.trim()}
          >
            Add
          </Button>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {skills.map((s) => (
              <Chip key={s} active onClick={() => removeSkill(s)}>
                {s} &times;
              </Chip>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-3">
          {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 8).map((s) => (
            <button
              key={s}
              onClick={() => addSkill(s)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-gray-100 transition"
            >
              + {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Budget */}
      <Card className="p-4">
        <p className="text-sm font-bold text-gray-900 mb-2">
          What&apos;s your budget range?
        </p>
        <p className="text-2xl font-black text-orange-600 text-center mb-3">
          {BUDGET_MARKS[budgetIndex]?.label}
        </p>
        <input
          type="range"
          min={0}
          max={BUDGET_MARKS.length - 1}
          value={budgetIndex}
          onChange={(e) => setBudgetIndex(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
        <div className="flex justify-between mt-1">
          {BUDGET_MARKS.map((m) => (
            <span key={m.value} className="text-[9px] text-gray-400">
              {m.label}
            </span>
          ))}
        </div>
      </Card>

      {/* Time */}
      <Card className="p-4">
        <p className="text-sm font-bold text-gray-900 mb-3">
          How much time can you commit?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTimeAvailability("full-time")}
            className={cn(
              "p-4 rounded-2xl border-2 text-center transition-all",
              timeAvailability === "full-time"
                ? "border-orange-500 bg-orange-50"
                : "border-gray-100 bg-white hover:border-gray-200"
            )}
          >
            <p className="text-2xl mb-1">{"\u23F0"}</p>
            <p className="text-sm font-bold text-gray-900">Full-time</p>
            <p className="text-xs text-gray-500 mt-1">All in!</p>
          </button>
          <button
            onClick={() => setTimeAvailability("side-hustle")}
            className={cn(
              "p-4 rounded-2xl border-2 text-center transition-all",
              timeAvailability === "side-hustle"
                ? "border-orange-500 bg-orange-50"
                : "border-gray-100 bg-white hover:border-gray-200"
            )}
          >
            <p className="text-2xl mb-1">{"\uD83C\uDF19"}</p>
            <p className="text-sm font-bold text-gray-900">Side hustle</p>
            <p className="text-xs text-gray-500 mt-1">After hours</p>
          </button>
        </div>
      </Card>

      {/* Location */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-orange-600" />
          <p className="text-sm font-bold text-gray-900">Your location</p>
        </div>
        <select
          value={state}
          onChange={(e) => { setState(e.target.value); setArea(""); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 mb-2 bg-white"
        >
          <option value="">Select state</option>
          {NG_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {areas.length > 0 && (
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 bg-white"
          >
            <option value="">Select area</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </Card>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={!canProceed}
        rightIcon={<Sparkles className="w-4 h-4" />}
      >
        Show My Business Options
      </Button>

      <p className="text-center text-xs text-gray-400">
        You can do this. Your business starts today.
      </p>
    </div>
  );
}
