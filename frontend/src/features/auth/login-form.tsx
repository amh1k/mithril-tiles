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
  login,
} from "./api-client";
import { loginRequestSchema, type LoginRequest } from "./schemas";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const principal = await login(values);
      queryClient.setQueryData(authSessionQueryKey, principal);
      router.replace("/play");
    } catch (error) {
      if (error instanceof AuthRequestError) {
        const emailError = error.detail.fieldErrors?.email;
        const passwordError = error.detail.fieldErrors?.password;

        if (emailError) {
          setError("email", {
            type: "server",
            message: emailError,
          });
        }

        if (passwordError) {
          setError("password", {
            type: "server",
            message: passwordError,
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          className="h-11"
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={errors.email ? true : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
        {errors.email && (
          <p
            id="email-error"
            className="field-error-enter text-sm text-destructive"
            role="alert"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11"
          aria-describedby={errors.password ? "password-error" : undefined}
          aria-invalid={errors.password ? true : undefined}
          disabled={isSubmitting}
          {...register("password")}
        />
        {errors.password && (
          <p
            id="password-error"
            className="field-error-enter text-sm text-destructive"
            role="alert"
          >
            {errors.password.message}
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
