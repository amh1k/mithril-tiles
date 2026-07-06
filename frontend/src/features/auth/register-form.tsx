"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthRequestError, registerUser } from "./api-client";
import { registerFormSchema, type RegisterFormValues } from "./schemas";
const fieldNames = ["display_name", "handle", "email", "password"] as const;
export function RegisterForm() {
  const router = useRouter();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      display_name: "",
      handle: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser({
        display_name: values.display_name,
        handle: values.handle,
        email: values.email,
        password: values.password,
        avatar_url: "",
      });
      router.replace("/play");
    } catch (error) {
      if (error instanceof AuthRequestError) {
        for (const field of fieldNames) {
          const message = error.detail.fieldErrors?.[field];

          if (message) {
            setError(field, {
              type: "server",
              message,
            });
          }
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
      <FormField
        id="display-name"
        label="Display name"
        autoComplete="nickname"
        error={errors.display_name?.message}
        disabled={isSubmitting}
        inputProps={register("display_name")}
      />

      <FormField
        id="handle"
        label="Handle"
        autoComplete="username"
        error={errors.handle?.message}
        disabled={isSubmitting}
        inputProps={register("handle")}
      />

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        disabled={isSubmitting}
        inputProps={register("email")}
      />

      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        disabled={isSubmitting}
        inputProps={register("password")}
      />

      <FormField
        id="password-confirmation"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.password_confirmation?.message}
        disabled={isSubmitting}
        inputProps={register("password_confirmation")}
      />

      {errors.root?.server && (
        <p className="text-sm text-destructive" role="alert">
          {errors.root.server.message}
        </p>
      )}

      <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

type FormFieldProps = {
  id: string;
  label: string;
  type?: "email" | "password" | "text";
  autoComplete: string;
  error?: string;
  disabled: boolean;
  inputProps: UseFormRegisterReturn;
};

function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  error,
  disabled,
  inputProps,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        className="h-11"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
