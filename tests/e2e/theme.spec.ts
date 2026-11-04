import { expect, type Page, test } from "@playwright/test";

const html = (page: Page) => page.locator("html");

test("defaults: system light is respected when nothing is saved", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ colorScheme: "light" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await expect(html(page)).toHaveAttribute("data-accent", "green");
  await ctx.close();
});

test("defaults: dark system gives dark", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(html(page)).toHaveAttribute("data-mode", "dark");
  await ctx.close();
});

test("hover devices: swatches are hidden until the controls are hovered", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "hover/keyboard UI; touch devices have their own test");
  await page.goto("/");
  // collapsed = zero-width group (the clipped swatches inside still have a box)
  const group = page.getByRole("radiogroup", { name: "Accent color" });
  await expect(group).toBeAttached();
  await expect(group).toBeHidden();
  await page.getByRole("button", { name: "Dark mode" }).hover();
  await expect(group).toBeVisible();
});

test("mode toggle and accent persist across reload and navigation", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "hover/keyboard UI; touch devices have their own test");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  // client:idle island: a click before hydration is lost
  await page.locator("astro-island:not([ssr]) [role=radiogroup]").waitFor({
    state: "attached",
  });
  // clicking the toggle also hovers the control group, which reveals the swatches
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await page.getByRole("radio", { name: "blue accent" }).click();
  await expect(html(page)).toHaveAttribute("data-accent", "blue");
  await page.reload();
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await expect(html(page)).toHaveAttribute("data-accent", "blue");
  await page.goto("/nope"); // a different page load
  await expect(page.getByText("command not found")).toBeVisible();
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await expect(html(page)).toHaveAttribute("data-accent", "blue");
});

test("accent radiogroup is reachable by Tab and supports arrow keys", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "hover/keyboard UI; touch devices have their own test");
  await page.goto("/");
  // client:idle island: wait for hydration (Astro drops the ssr attribute) before using the keyboard
  await page.locator("astro-island:not([ssr]) [role=radiogroup]").waitFor({
    state: "attached",
  });
  // the checked swatch is the radiogroup's tab stop, just before the mode toggle
  await page.getByRole("button", { name: "Dark mode" }).focus();
  await page.keyboard.press("Shift+Tab");
  const green = page.getByRole("radio", { name: "green accent" });
  await expect(green).toBeFocused();
  // focus-within expands the group
  await expect(
    page.getByRole("radiogroup", { name: "Accent color" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(html(page)).toHaveAttribute("data-accent", "orange");
  await expect(
    page.getByRole("radio", { name: "orange accent" }),
  ).toBeFocused();
});

test("touch devices: theme settings panel opens, closes and persists choices", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    colorScheme: "dark",
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Theme settings" });
  const panel = page.getByRole("group", { name: "Theme" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  // client:idle island: a tap before hydration is lost
  await page
    .locator("astro-island:not([ssr])")
    .getByRole("button", { name: "Theme settings" })
    .waitFor();

  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Dark mode" }).tap();
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await panel.getByRole("radio", { name: "blue accent" }).tap();
  await expect(html(page)).toHaveAttribute("data-accent", "blue");

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();

  await toggle.tap();
  await expect(panel).toBeVisible();
  await page.getByRole("heading", { level: 1 }).tap();
  await expect(panel).toBeHidden();

  await page.reload();
  await expect(html(page)).toHaveAttribute("data-mode", "light");
  await expect(html(page)).toHaveAttribute("data-accent", "blue");
  await ctx.close();
});
