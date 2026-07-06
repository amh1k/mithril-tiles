import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { renderWithQueryClient } from "@/test/render-with-query-client";
import { RoomEntry } from "./room-entry";

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("RoomEntry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates a secure room code and navigates to it", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RoomEntry displayName="Player One" />);

    await user.click(screen.getByRole("button", { name: "Create room" }));

    expect(router.push).toHaveBeenCalledWith(
      expect.stringMatching(/^\/room\/[A-HJ-NP-Z2-9]{6}$/),
    );
  });

  it("normalizes a join code before navigating", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RoomEntry displayName="Player One" />);

    await user.type(screen.getByLabelText("Room code"), " room-01 ");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(router.push).toHaveBeenCalledWith("/room/ROOM01");
  });

  it("shows validation errors without navigating", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RoomEntry displayName="Player One" />);

    await user.type(screen.getByLabelText("Room code"), "abc");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(
      await screen.findByText(
        "Room code must contain at least 4 characters",
      ),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
