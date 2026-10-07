import { describe, expect, it } from "vitest";
import {
  horizontalCardSlideClass,
} from "@/components/ui/HorizontalCardScroller";

describe("HorizontalCardScroller", () => {
  it("exposes slide classes for snap alignment", () => {
    expect(horizontalCardSlideClass).toContain("racket-hscroll-slide");
    expect(horizontalCardSlideClass).toContain("snap-start");
  });
});
