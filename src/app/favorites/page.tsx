"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { Heart, ShoppingBag, Loader2, Trash2 } from "lucide-react";

interface FavItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  businessSlug?: string;
  savedAt?: number;
}

const STORAGE_KEY = "mybizhub_favorites";

function loadFavorites(): FavItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function FavoritesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [favorites, setFavorites] = useState<FavItem[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.replace("/account/login?redirect=/favorites");
        return;
      }
      setLoggedIn(true);
      setFavorites(loadFavorites());
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const removeFavorite = useCallback((productId: string) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.productId !== productId);
      saveFavorites(next);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Favorites" subtitle="Saved products" showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Favorites" subtitle="Saved products" showBack />
      <div className="px-4 pb-28 space-y-3">
        {favorites.length === 0 ? (
          <Card className="p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-base font-bold text-gray-900">No favorites yet</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xs">
              Browse the marketplace and tap the heart icon on products you love to save them here.
            </p>
            <div className="mt-4">
              <Button onClick={() => router.push("/market")}>
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Browse marketplace
                </span>
              </Button>
            </div>
          </Card>
        ) : (
          favorites.map((fav) => (
            <Card key={fav.productId} className="p-4">
              <div className="flex items-center gap-3">
                {fav.image ? (
                  <img
                    src={fav.image}
                    alt={fav.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{fav.name}</p>
                  <p className="text-sm text-orange-600 font-bold mt-0.5">
                    R{fav.price.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => removeFavorite(fav.productId)}
                  className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 hover:bg-red-100 transition"
                  aria-label="Remove from favorites"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
              {fav.businessSlug && (
                <Link
                  href={`/b/${fav.businessSlug}/p/${fav.productId}`}
                  className="mt-2 block text-xs text-orange-600 font-semibold hover:underline"
                >
                  View product →
                </Link>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
