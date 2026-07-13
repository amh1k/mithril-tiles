"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  authSessionQueryKey,
  AuthRequestError,
  createGuestSession,
} from "./api-client";
import {
  guestRequestSchema,
  type GuestRequest,
} from "./schemas";

export function GuestForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<GuestRequest>({
    resolver: zodResolver(guestRequestSchema),
    defaultValues: {
      display_name: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const principal = await createGuestSession(values);
      queryClient.setQueryData(authSessionQueryKey, principal);
      router.replace("/play");
    } catch (error) {
      if (error instanceof AuthRequestError) {
        const displayNameError = error.detail.fieldErrors?.display_name;

        if (displayNameError) {
          setError("display_name", {
            type: "server",
            message: displayNameError,
          });
        }

        setError("root.server", {
          type: "server",
          message: error.detail.message,
        });
        return;
      }

      setError("root.server", {
        type: "server",
        message: "Unable to connect to the authentication service.",
      });
    }
  });

  return (
    <form className="panel-enter space-y-5" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          autoComplete="nickname"
          className="h-11"
          aria-describedby={
            errors.display_name ? "display-name-error" : undefined
          }
          aria-invalid={errors.display_name ? true : undefined}
          disabled={isSubmitting}
          {...register("display_name")}
        />
        {errors.display_name && (
          <p
            id="display-name-error"
            className="field-error-enter text-sm text-destructive"
            role="alert"
          >
            {errors.display_name.message}
          </p>
        )}
      </div>

      {errors.root?.server && (
        <p className="form-error-enter text-sm text-destructive" role="alert">
          {errors.root.server.message}
        </p>
      )}

      <Button
        className="h-11 w-full transition-transform active:translate-y-px"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        type="submit"
      >
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? "Creating guest session…" : "Continue as guest"}
      </Button>
    </form>
  );
}
