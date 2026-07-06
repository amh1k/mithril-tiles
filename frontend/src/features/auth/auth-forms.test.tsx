import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authSessionQueryKey } from "@/features/auth/api-client";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import { GuestForm } from "./guest-form";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("authentication forms", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a guest session and updates the shared session cache", async () => {
    const user = userEvent.setup();
    const principal = {
      type: "guest" as const,
      id: "1a34b2da-1280-4f70-aeca-08c8f34426c6",
      display_name: "Guest One",
    };
    fetchMock.mockResolvedValue(Response.json({ principal }, { status: 201 }));
    const { queryClient } = renderWithQueryClient(<GuestForm />);

    await user.type(screen.getByLabelText("Display name"), "Guest One");
    await user.click(screen.getByRole("button", { name: "Continue as guest" }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/play");
    });
    expect(queryClient.getQueryData(authSessionQueryKey)).toEqual(principal);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/guest",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ display_name: "Guest One" }),
      }),
    );
  });

  it("shows invalid login credentials returned by the BFF", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          status: 401,
          code: "unauthorized",
          message: "invalid authentication credentials",
        },
        { status: 401 },
      ),
    );
    renderWithQueryClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("invalid authentication credentials"),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("rejects mismatched registration passwords before calling the BFF", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RegisterForm />);

    await fillRegistrationForm(user, {
      password: "password-one",
      confirmation: "password-two",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("registers a user without sending password confirmation", async () => {
    const user = userEvent.setup();
    const principal = {
      type: "user" as const,
      id: "1a34b2da-1280-4f70-aeca-08c8f34426c6",
      display_name: "Player One",
      handle: "player-one",
    };
    fetchMock.mockResolvedValue(Response.json({ principal }, { status: 201 }));
    const { queryClient } = renderWithQueryClient(<RegisterForm />);

    await fillRegistrationForm(user, {
      password: "password-one",
      confirmation: "password-one",
    });
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/play");
    });
    expect(queryClient.getQueryData(authSessionQueryKey)).toEqual(principal);

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      display_name: "Player One",
      handle: "player-one",
      email: "player@example.com",
      password: "password-one",
      avatar_url: "",
    });
  });
});

async function fillRegistrationForm(
  user: ReturnType<typeof userEvent.setup>,
  passwords: {
    password: string;
    confirmation: string;
  },
) {
  await user.type(screen.getByLabelText("Display name"), "Player One");
  await user.type(screen.getByLabelText("Handle"), "player-one");
  await user.type(screen.getByLabelText("Email"), "player@example.com");
  await user.type(screen.getByLabelText("Password"), passwords.password);
  await user.type(
    screen.getByLabelText("Confirm password"),
    passwords.confirmation,
  );
}
