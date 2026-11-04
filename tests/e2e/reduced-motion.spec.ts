import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("cursor blink is disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1 .cursor")).toHaveCSS(
    "animation-iteration-count",
    "1",
  );
});

test("scramble heading shows final text", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
    "RoyalT — web developer",
  );
});

test("scroll reveal is off: sections below the fold are fully opaque", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#about")).not.toBeInViewport();
  for (const el of await page.locator(".reveal").all()) {
    await expect(el).toHaveCSS("opacity", "1");
  }
});
