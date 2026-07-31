/**
 * Daily usage hook for website chat (free tier).
 * 
 * Tracks daily usage count for anonymous (20/day) and registered (100/day) users
 * on Gonka models. Shows remaining count in the UI and provides upgrade prompts.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

const DAILY_LIMIT_ANONYMOUS = 20;
const DAILY_LIMIT_REGISTERED = 100;

export interface DailyUsageResponse {
  used: number;
  limit: number;
  remaining: number;
  isAuthenticated: boolean;
  resetMs: number;
}

/**
 * Hook to track daily usage for the website chat.
 * Polls the server every 10 seconds to stay current.
 */
export function useDailyUsage() {
   const { isAuthenticated } = useAuth();
   const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const query = useQuery({
    queryKey: ["daily-usage"],
    queryFn: async (): Promise<DailyUsageResponse> => {
      const res = await fetch("/api/v1/usage/today", {
        credentials: "include",
        headers: { "X-OMA-Source": "website" },
      });
      if (!res.ok) {
        // If endpoint doesn't exist, return default
        return {
          used: 0,
          limit: isAuthenticated ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS,
          remaining: isAuthenticated ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS,
          isAuthenticated,
          resetMs: 0,
        };
      }
      const data = await res.json();
      return {
        used: data.used ?? 0,
        limit: data.limit ?? (isAuthenticated ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS),
        remaining: data.remaining ?? Math.max(0, (data.limit ?? 20) - (data.used ?? 0)),
        isAuthenticated,
        resetMs: data.resetMs ?? 0,
      };
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });

  const data = query.data ?? {
    used: 0,
    limit: isAuthenticated ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS,
    remaining: isAuthenticated ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS,
    isAuthenticated,
    resetMs: 0,
  };

  // Auto-show upgrade modal when limit is reached
  useEffect(() => {
    if (data.remaining === 0 && data.used > 0) {
      setShowUpgradeModal(true);
    }
  }, [data.remaining, data.used]);

  return {
    ...data,
    loading: query.isLoading,
    refresh: () => query.refetch(),
    showUpgradeModal,
    setShowUpgradeModal,
    limitReached: data.remaining === 0 && data.used > 0,
  };
}

/**
 * Format time until daily limit resets (e.g., "5h 23m")
 */
export function formatTimeUntilReset(resetMs: number): string {
  if (resetMs <= 0) return "soon";
  const hours = Math.floor(resetMs / 3600000);
  const minutes = Math.floor((resetMs % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
