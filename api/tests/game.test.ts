import { cleanName, hitTest, isExpired, NAME_MAX, qualifies, TARGET_RADIUS } from "../src/game";

const box = { x: 0.5, y: 0.5, w: 0.02, h: 0.04 };

describe("hitTest", () => {
  test("hits inside the box", () => {
    expect(hitTest(0.51, 0.52, box, 0.625)).toBe(true);
  });

  test("hits when the ring touches an edge", () => {
    expect(hitTest(0.5 - TARGET_RADIUS + 1e-9, 0.52, box, 0.625)).toBe(true);
  });

  test("misses just beyond the ring", () => {
    expect(hitTest(0.5 - TARGET_RADIUS - 0.001, 0.52, box, 0.625)).toBe(false);
  });

  test("scales vertical distance by aspect ratio", () => {
    const below = 0.54 + TARGET_RADIUS / 0.625;
    expect(hitTest(0.51, below - 0.0001, box, 0.625)).toBe(true);
    expect(hitTest(0.51, below + 0.001, box, 0.625)).toBe(false);
  });

  test("same relative spot hits at any rendered size", () => {
    for (const width of [375, 900, 1600]) {
      const px = 0.505 * width;
      expect(hitTest(px / width, 0.51, box, 0.625)).toBe(true);
    }
  });
});

describe("isExpired", () => {
  test("is live before ttl and expired at ttl", () => {
    expect(isExpired({ ttl: 100 }, 99_999)).toBe(false);
    expect(isExpired({ ttl: 100 }, 100_000)).toBe(true);
  });
});

describe("qualifies", () => {
  const ten = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((s) => s * 1000);

  test("qualifies when the board has room", () => {
    expect(qualifies(999_999, [])).toBe(true);
    expect(qualifies(999_999, ten.slice(0, 9))).toBe(true);
  });

  test("qualifies when faster than 10th place", () => {
    expect(qualifies(95_000, ten)).toBe(true);
  });

  test("does not qualify when slower than 10th place", () => {
    expect(qualifies(101_000, ten)).toBe(false);
  });
});

describe("cleanName", () => {
  test("trims and collapses whitespace", () => {
    expect(cleanName("  Ada   Lovelace ")).toBe("Ada Lovelace");
  });

  test("rejects empty, too long and non-string names", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(NAME_MAX + 1))).toBeNull();
    expect(cleanName(42)).toBeNull();
  });
});
