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
    <header className="relative z-50 border-b border-[#9a783f] bg-[#302116]/95 text-[#f2dfb4] shadow-md shadow-[#3e2a1e]/25 backdrop-blur">
      <nav
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6"
        aria-label="Main navigation"
      >
        <Link
          className="font-heading flex items-center gap-2 font-semibold tracking-[0.18em] text-[#f2dfb4] uppercase"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-[#b8965a]/60 bg-[#b8965a]/15 shadow-inner">
            <Sparkles className="size-4 text-[#d4b66f]" aria-hidden="true" />
          </span>
          Mithril Tiles
        </Link>

        <div className="flex items-center gap-2">
          {sessionQuery.isPending ? (
            <span
              className="h-9 w-28 animate-pulse rounded-lg bg-white/10"
              aria-label="Checking session"
            />
          ) : sessionQuery.isError ? (
            <Button
              className="border-[#b8965a]/60 bg-transparent text-[#f2dfb4] hover:bg-[#b8965a]/15 hover:text-white"
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
                  "h-10 px-3 text-[#dcc99f] hover:bg-[#b8965a]/15 hover:text-white",
                )}
                href="/play"
              >
                <span className="max-w-28 truncate">
                  {sessionQuery.data.display_name}
                </span>
              </Link>
              <Button
                className="h-10 border-[#b8965a]/60 bg-transparent px-3 text-[#f2dfb4] hover:bg-[#b8965a]/15 hover:text-white"
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
                  "h-10 px-3 text-[#dcc99f] hover:bg-[#b8965a]/15 hover:text-white",
                )}
                href="/login"
              >
                <LogIn aria-hidden="true" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 border-[#b8965a]/60 bg-transparent px-3 text-[#f2dfb4] hover:bg-[#b8965a]/15 hover:text-white",
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
