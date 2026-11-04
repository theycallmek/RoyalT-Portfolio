import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Scroll-linked .reveal fade-ins leave text part-transparent at arbitrary scroll positions, which
// axe reports as low contrast. Reduced motion turns them off, so axe sees the settled colours.
test.use({ reducedMotion: "reduce" });

for (const colorScheme of ["dark", "light"] as const) {
  for (const path of ["/", "/nope"]) {
    test(`no axe violations on ${path} (${colorScheme})`, async ({ page }) => {
      // nothing saved, so the system preference decides the mode
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute(
        "data-mode",
        colorScheme,
      );
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
