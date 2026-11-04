import { expect, test } from "@playwright/test";

for (const path of ["/", "/nope"]) {
  test(`no horizontal overflow at 390px on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBe(clientWidth);
  });
}

for (const width of [390, 1440]) {
  test(`nav stays on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const box = await page.locator("header").first().boundingBox();
    expect(box?.height).toBeLessThan(70);
  });
}

for (const [from, id] of [
  ["about", "about"],
  ["projects", "code"],
  ["blog", "write"],
  ["hobbies", "make"],
  ["links", "about"],
]) {
  test(`old /${from} URL lands on the ${id} section`, async ({ page }) => {
    // hold the stats request: no stats server here, and the "unavailable" state is shorter than
    // the skeleton, which would move the section after the anchor jump
    await page.route("**/api/stats", () => {});
    await page.goto(`/${from}`);
    await expect(page).toHaveURL(new RegExp(`/#${id}$`));
    await expect(page.locator(`section#${id}`)).toBeInViewport();
  });
}

test("clicking the write nav link marks it current", async ({ page }) => {
  await page.route("**/api/stats", () => {}); // see above
  await page.goto("/");
  const write = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "write" });
  await expect(write).not.toHaveAttribute("aria-current");
  await write.click();
  await expect(write).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("navigation", { name: "Main" }).locator("[aria-current]"),
  ).toHaveCount(1);
});

test("scroll-spy marks the parent section for a subsection anchor", async ({
  page,
}) => {
  await page.goto("/#makerworld");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "make" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(nav.locator("[aria-current]")).toHaveCount(1);
});

test("touch devices: only one row shows the indicator line at a time", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto("/");
  const lined = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll("a.row")].filter((el) =>
          getComputedStyle(el).backgroundSize.startsWith("100%"),
        ).length,
    );
  let sawOne = false;
  for (let y = 0; y < 6000; y += 250) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(350); // let the 200ms draw transition finish
    const n = await lined();
    expect(n).toBeLessThanOrEqual(1);
    if (n === 1) sawOne = true;
  }
  expect(sawOne).toBe(true);
  await ctx.close();
});
