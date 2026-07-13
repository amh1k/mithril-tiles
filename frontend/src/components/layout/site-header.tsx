"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Info,
  LogIn,
  LogOut,
  Menu,
  ScrollText,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  authSessionQueryKey,
  getCurrentSession,
  logout,
} from "@/features/auth/api-client";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDesktopNavigation, setIsDesktopNavigation] = useState(false);
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

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateNavigationMode = () => {
      setIsDesktopNavigation(mediaQuery.matches);
    };

    const animationFrame = window.requestAnimationFrame(updateNavigationMode);
    mediaQuery.addEventListener("change", updateNavigationMode);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      mediaQuery.removeEventListener("change", updateNavigationMode);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="relative z-50 border-b border-[#946440]/55 bg-[#2b1e12]/98 text-[#bba88d] shadow-[0_8px_30px_rgba(43,30,18,0.32)] backdrop-blur-xl">
      {menuOpen && (
        <button
          aria-label="Close navigation menu"
          className="fixed inset-x-0 bottom-0 top-[4.5rem] z-40 bg-[#2b1e12]/55 backdrop-blur-[2px] md:hidden"
          onClick={closeMenu}
          type="button"
        />
      )}
      <nav
        className="relative mx-auto flex min-h-[4.5rem] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6"
        aria-label="Main navigation"
      >
        <Link
          className="group flex items-center transition-transform hover:scale-[1.02]"
          href="/"
        >
          <Image
            alt="Mithril Tiles"
            className="h-14 w-28 object-contain transition-transform group-hover:scale-105"
            height={950}
            priority
            src="/images/logo-gold.png"
            width={1639}
          />
        </Link>

        <Button
          aria-controls="site-navigation-actions"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          className="size-11 border-[#bba88d]/35 bg-[#2b1e12] text-[#f4ead7] hover:bg-[#5d542b] hover:text-white md:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          size="icon"
          type="button"
          variant="outline"
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>

        <div
          className={cn(
            "site-menu-panel absolute inset-x-3 top-[calc(100%+0.5rem)] z-50 flex max-h-[calc(100dvh-5.5rem)] flex-col gap-1 overflow-y-auto rounded-xl border border-[#946440]/70 bg-[#2b1e12] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.42)] md:static md:z-auto md:max-h-none md:flex-row md:items-center md:gap-2 md:overflow-visible md:border-[#bba88d]/15 md:bg-[#2b1e12]/30 md:p-1 md:shadow-inner",
            menuOpen
              ? "visible translate-y-0 opacity-100"
              : "pointer-events-none invisible -translate-y-2 opacity-0 md:pointer-events-auto md:visible md:translate-y-0 md:opacity-100",
          )}
          data-open={menuOpen}
          id="site-navigation-actions"
          inert={!menuOpen && !isDesktopNavigation}
        >
          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-11 justify-start px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white md:h-10 md:justify-center",
            )}
            href="/rules"
            onClick={closeMenu}
            style={{ "--menu-item-index": 0 } as React.CSSProperties}
          >
            <ScrollText aria-hidden="true" />
            <span>Rules</span>
          </Link>
          <Link
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-11 justify-start px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white md:h-10 md:justify-center",
            )}
            href="/about"
            onClick={closeMenu}
            style={{ "--menu-item-index": 1 } as React.CSSProperties}
          >
            <Info aria-hidden="true" />
            <span>About</span>
          </Link>
          {sessionQuery.isPending ? (
            <span
              className="h-9 w-28 animate-pulse rounded-lg bg-white/10"
              aria-label="Checking session"
              style={{ "--menu-item-index": 2 } as React.CSSProperties}
            />
          ) : sessionQuery.isError ? (
            <Button
              className="h-11 justify-start border-[#946440] bg-[#2b1e12]/45 text-[#bba88d] hover:bg-[#946440] hover:text-[#2b1e12] md:h-10 md:justify-center"
              variant="outline"
              onClick={() => sessionQuery.refetch()}
              type="button"
              style={{ "--menu-item-index": 2 } as React.CSSProperties}
            >
              Retry session
            </Button>
          ) : sessionQuery.data ? (
            <>
              {sessionQuery.data.type === "user" &&
                sessionQuery.data.role === "admin" && (
                  <Link
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "h-11 justify-start px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white md:h-10 md:justify-center",
                    )}
                    href="/admin"
                    onClick={closeMenu}
                    style={{ "--menu-item-index": 2 } as React.CSSProperties}
                  >
                    <Shield aria-hidden="true" />
                    <span>Admin</span>
                  </Link>
                )}
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-11 justify-start px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white md:h-10 md:justify-center",
                )}
                href="/play"
                onClick={closeMenu}
                style={{ "--menu-item-index": 3 } as React.CSSProperties}
              >
                <span className="max-w-28 truncate">
                  {sessionQuery.data.display_name}
                </span>
              </Link>
              <Button
                className="h-11 justify-start border-[#946440] bg-[#2b1e12]/35 px-3 text-[#bba88d] hover:bg-[#946440] hover:text-[#2b1e12] md:h-10 md:justify-center"
                variant="outline"
                disabled={logoutMutation.isPending}
                onClick={() => {
                  closeMenu();
                  logoutMutation.mutate();
                }}
                type="button"
                style={{ "--menu-item-index": 4 } as React.CSSProperties}
              >
                <LogOut aria-hidden="true" />
                <span>
                  {logoutMutation.isPending ? "Signing out…" : "Sign out"}
                </span>
              </Button>
            </>
          ) : (
            <>
              <Link
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-11 justify-start px-3 text-[#bba88d] hover:bg-[#946440]/35 hover:text-white md:h-10 md:justify-center",
                )}
                href="/login"
                onClick={closeMenu}
                style={{ "--menu-item-index": 2 } as React.CSSProperties}
              >
                <LogIn aria-hidden="true" />
                <span>Sign in</span>
              </Link>
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-11 justify-start border-[#bba88d]/70 bg-[#bba88d] px-4 font-semibold text-[#2b1e12] shadow-md hover:bg-[#946440] hover:text-[#2b1e12] md:h-10 md:justify-center",
                )}
                href="/register"
                onClick={closeMenu}
                style={{ "--menu-item-index": 3 } as React.CSSProperties}
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
