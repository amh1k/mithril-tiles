"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
    <header className="relative z-50 border-b border-border/70 bg-background/90 backdrop-blur">
      <nav
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6"
        aria-label="Main navigation"
      >
        <Link
          className="flex items-center gap-2 font-semibold tracking-tight"
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          Mithril Tiles
        </Link>

        <div className="flex items-center gap-2">
          {sessionQuery.isPending ? (
            <span
              className="h-9 w-28 animate-pulse rounded-lg bg-muted"
              aria-label="Checking session"
            />
          ) : sessionQuery.isError ? (
            <Button
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
                  "h-10 px-3",
                )}
                href="/play"
              >
                <span className="max-w-28 truncate">
                  {sessionQuery.data.display_name}
                </span>
              </Link>
              <Button
                className="h-10 px-3"
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
                  "h-10 px-3",
                )}
                href="/login"
              >
                <LogIn aria-hidden="true" />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 px-3",
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
