"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  authSessionQueryKey,
  getCurrentSession,
  logout,
} from "@/features/auth/api-client";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: authSessionQueryKey,
    queryFn: getCurrentSession,
    retry: false,
    staleTime: 30_000,
  });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(authSessionQueryKey, null);
      router.replace("/");
      router.refresh();
    },
  });

  return (
    <header className="relative z-50 border-b border-[#946440]/55 bg-[#2b1e12]/98 text-[#bba88d] shadow-[0_8px_30px_rgba(43,30,18,0.32)] backdrop-blur-xl">
      <nav
        className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between px-4 sm:px-6"
        aria-label="Main navigation"
      >
        <Link
          className="font-heading group flex items-center gap-3 font-semibold tracking-[0.16em] text-[#bba88d] uppercase transition-colors hover:text-white"
          href="/"
        >
          <span className="relative flex size-10 items-center justify-center rounded-full border border-[#bba88d]/60 bg-[#946440]/35 shadow-[inset_0_0_0_3px_rgba(43,30,18,0.35),0_3px_12px_rgba(0,0,0,0.24)] transition-transform group-hover:rotate-6 group-hover:scale-105">
            <Sparkles className="size-4 text-[#bba88d]" aria-hidden="true" />
          </span>
          <span className="hidden sm:inline">Mithril Tiles</span>
        </Link>

        <div className="flex items-center gap-2 rounded-xl border border-[#bba88d]/15 bg-[#2b1e12]/30 p-1 shadow-inner">
          {sessionQuery.isPending ? (
            <span
              className="h-9 w-28 animate-pulse rounded-lg bg-white/10"
              aria-label="Checking session"
            />
          ) : sessionQuery.isError ? (
            <Button
              className="border-[#946440] bg-[#2b1e12]/45 text-[#bba88d] hover:bg-[#946440] hover:text-[#2b1e12]"
              variant="outline"
              onClick={() => sessionQuery.refetch()}
              type="button"
            >
              Retry session
            </Button>
          ) : sessionQuery.data ? (
            <>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white",
                )}
                href="/play"
              >
                <span className="max-w-28 truncate">
                  {sessionQuery.data.display_name}
                </span>
              </Link>
              <Button
                className="h-10 border-[#946440] bg-[#2b1e12]/35 px-3 text-[#bba88d] hover:bg-[#946440] hover:text-[#2b1e12]"
                variant="outline"
                disabled={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
                type="button"
              >
                <LogOut aria-hidden="true" />
                <span className="hidden sm:inline">
                  {logoutMutation.isPending ? "Signing out…" : "Sign out"}
                </span>
              </Button>
            </>
          ) : (
            <>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-10 px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white",
                )}
                href="/login"
              >
                <LogIn aria-hidden="true" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 border-[#bba88d]/70 bg-[#bba88d] px-4 font-semibold text-[#2b1e12] shadow-md hover:bg-[#946440] hover:text-[#2b1e12]",
                )}
                href="/register"
              >
                <UserPlus aria-hidden="true" />
                Register
              </Link>
            </>
          )}
        </div>
      </nav>

      {logoutMutation.isError && (
        <p
          className="absolute right-4 top-full rounded-b-lg bg-destructive px-3 py-2 text-sm text-white"
          role="alert"
        >
          Sign out failed. Please try again.
        </p>
      )}
    </header>
  );
}
