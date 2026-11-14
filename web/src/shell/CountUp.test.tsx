import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CountUp } from "./CountUp";

const stubMotionPreference = (isReduced: boolean): void => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isReduced && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
};

describe("CountUp", () => {
  it("prints the figure at once for a visitor who asked for less motion", () => {
    stubMotionPreference(true);

    const { container } = render(<CountUp target={128} />);

    expect(container.textContent).toBe("128");
  });

  it("waits at zero until it scrolls into view otherwise", () => {
    stubMotionPreference(false);

    const { container } = render(<CountUp target={128} />);

    expect(container.textContent).toBe("0");
  });
});
