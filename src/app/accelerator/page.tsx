// FILE: src/app/accelerator/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { ProgressBar } from "@/components/accelerator/ProgressBar";
import { SplashScreen } from "@/components/accelerator/SplashScreen";
import { StepDiscover } from "@/components/accelerator/StepDiscover";
import { StepIdeas } from "@/components/accelerator/StepIdeas";
import { StepSimulator } from "@/components/accelerator/StepSimulator";
import { StepSuppliers } from "@/components/accelerator/StepSuppliers";
import { StepActionPlan } from "@/components/accelerator/StepActionPlan";
import { StepDashboard } from "@/components/accelerator/StepDashboard";
import { generateBusinessIdeas } from "@/lib/accelerator/ideas-engine";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import type {
  AcceleratorProfile,
  AcceleratorStep,
  BusinessIdea,
  SimulationResult,
  ActionPlanDay,
} from "@/lib/accelerator/types";
import { Loader2 } from "lucide-react";

type Phase = "splash" | "accelerator";

const STORAGE_KEY = "bizhub_accelerator_progress";

function loadProgress(): {
  step: AcceleratorStep;
  profile: AcceleratorProfile | null;
  ideas: BusinessIdea[];
  selectedIdea: BusinessIdea | null;
  simulation: SimulationResult | null;
  actionPlan: ActionPlanDay[] | null;
} {
  if (typeof window === "undefined") {
    return { step: 1, profile: null, ideas: [], selectedIdea: null, simulation: null, actionPlan: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { step: 1, profile: null, ideas: [], selectedIdea: null, simulation: null, actionPlan: null };
    return JSON.parse(raw);
  } catch {
    return { step: 1, profile: null, ideas: [], selectedIdea: null, simulation: null, actionPlan: null };
  }
}

function saveProgress(data: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export default function AcceleratorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("splash");
  const [step, setStep] = useState<AcceleratorStep>(1);
  const [profile, setProfile] = useState<AcceleratorProfile | null>(null);
  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<BusinessIdea | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [actionPlan, setActionPlan] = useState<ActionPlanDay[] | null>(null);
  const [isApex, setIsApex] = useState(false);

  // Check auth & existing business
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const token = await u.getIdToken();
        const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        const role = data?.me?.role;
        const businessId = data?.me?.businessId;

        // Check subscription for Apex features
        if (businessId) {
          try {
            const subRes = await fetch("/api/vendor/subscription/status", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const subData = await subRes.json().catch(() => ({}));
            if (subData?.planKey === "APEX") setIsApex(true);
          } catch {}
        }

        // If already has business, skip splash
        if (role === "owner" && businessId) {
          router.replace("/vendor");
          return;
        }
      } catch {}

      // Restore progress
      const saved = loadProgress();
      if (saved.step > 1) {
        setPhase("accelerator");
        setStep(saved.step);
        setProfile(saved.profile);
        setIdeas(saved.ideas || []);
        setSelectedIdea(saved.selectedIdea);
        setSimulation(saved.simulation);
        setActionPlan(saved.actionPlan);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [router]);

  // Auto-save progress
  useEffect(() => {
    if (phase === "accelerator") {
      saveProgress({ step, profile, ideas, selectedIdea, simulation, actionPlan });
    }
  }, [phase, step, profile, ideas, selectedIdea, simulation, actionPlan]);

  const goToStep = useCallback((s: AcceleratorStep) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // --- Handlers ---
  const handleStartAccelerator = () => {
    setPhase("accelerator");
    goToStep(1);
  };

  const handleHaveBusiness = () => {
    router.push("/vendor");
  };

  const handleDiscoverComplete = (p: AcceleratorProfile) => {
    setProfile(p);
    const generatedIdeas = generateBusinessIdeas(p);
    setIdeas(generatedIdeas);
    goToStep(2);
  };

  const handleIdeaSelect = (idea: BusinessIdea) => {
    setSelectedIdea(idea);
    goToStep(3);
  };

  const handleSimulationComplete = (sim: SimulationResult) => {
    setSimulation(sim);
    goToStep(4);
  };

  const handleSuppliersComplete = () => {
    goToStep(5);
  };

  const handlePlanComplete = (plan: ActionPlanDay[]) => {
    setActionPlan(plan);
    goToStep(6);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // --- SPLASH ---
  if (phase === "splash") {
    return (
      <div className="min-h-screen bg-gray-50">
        <SplashScreen
          onHaveBusiness={handleHaveBusiness}
          onStartAccelerator={handleStartAccelerator}
        />
      </div>
    );
  }

  // --- ACCELERATOR STEPS ---
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GradientHeader
        title="Smart Accelerator"
        subtitle="Build your business"
        showBack={step > 1}
        right={
          step < 6 ? (
            <button
              onClick={() => {
                if (step === 1) setPhase("splash");
                else router.push("/market");
              }}
              className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Skip
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {step < 6 && <ProgressBar currentStep={step} />}

        {step === 1 && <StepDiscover onComplete={handleDiscoverComplete} />}

        {step === 2 && ideas.length > 0 && (
          <StepIdeas
            ideas={ideas}
            onSelect={handleIdeaSelect}
            onBack={() => goToStep(1)}
          />
        )}

        {step === 3 && selectedIdea && (
          <StepSimulator
            idea={selectedIdea}
            isApex={isApex}
            onContinue={handleSimulationComplete}
            onBack={() => goToStep(2)}
          />
        )}

        {step === 4 && selectedIdea && (
          <StepSuppliers
            idea={selectedIdea}
            location={profile?.location?.state || "Lagos"}
            onContinue={handleSuppliersComplete}
            onBack={() => goToStep(3)}
          />
        )}

        {step === 5 && selectedIdea && (
          <StepActionPlan
            idea={selectedIdea}
            isApex={isApex}
            onContinue={handlePlanComplete}
            onBack={() => goToStep(4)}
          />
        )}

        {step === 6 && selectedIdea && simulation && actionPlan && (
          <StepDashboard
            idea={selectedIdea}
            simulation={simulation}
            actionPlan={actionPlan}
          />
        )}
      </div>
    </div>
  );
}
