"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthRequestError, createGuestSession } from "./api-client";
import {
  guestRequestSchema,
  type GuestRequest,
} from "./schemas";

export function GuestForm() {
  const router = useRouter();
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
      await createGuestSession(values);
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
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
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
            className="text-sm text-destructive"
            role="alert"
          >
            {errors.display_name.message}
          </p>
        )}
      </div>

      {errors.root?.server && (
        <p className="text-sm text-destructive" role="alert">
          {errors.root.server.message}
        </p>
      )}

      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating guest session…" : "Continue as guest"}
      </Button>
    </form>
  );
}
