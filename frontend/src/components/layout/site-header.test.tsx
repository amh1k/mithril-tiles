import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { authSessionQueryKey } from "@/features/auth/api-client";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import { SiteHeader } from "./site-header";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("SiteHeader", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows authentication links when there is no session", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          status: 401,
          code: "unauthorized",
          message: "Authentication is required.",
        },
        { status: 401 },
      ),
    );

    renderWithQueryClient(<SiteHeader />);

    expect(
      await screen.findByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.getByRole("link", { name: "Register" }),
    ).toHaveAttribute("href", "/register");
  });

  it("shows the principal and clears cached identity after logout", async () => {
    const user = userEvent.setup();
    const principal = {
      type: "user" as const,
      id: "1a34b2da-1280-4f70-aeca-08c8f34426c6",
      display_name: "Player One",
      handle: "player-one",
    };
    fetchMock
      .mockResolvedValueOnce(Response.json({ principal }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const { queryClient } = renderWithQueryClient(<SiteHeader />);

    expect(
      await screen.findByRole("link", { name: "Player One" }),
    ).toHaveAttribute("href", "/play");

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/");
    });
    expect(router.refresh).toHaveBeenCalled();
    expect(queryClient.getQueryData(authSessionQueryKey)).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
