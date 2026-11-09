import { expect, test } from "@playwright/test";

test("nav links jump to sections on the one page", async ({ page }) => {
  await page.goto("/");
  for (const name of ["code", "make", "write", "about"]) {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name })
      .click();
    await expect(page).toHaveURL(new RegExp(`/#${name}$`));
    await expect(page.locator(`section#${name}`)).toBeInViewport();
  }
});

test("external posts link out in a new tab", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("RoyalT Online");
  const post = page
    .locator("#write")
    .getByRole("link", { name: /Probable Planet/ });
  await expect(post).toHaveAttribute(
    "href",
    "https://probableplanet.collie-truck.ts.net",
  );
  await expect(post).toHaveAttribute("target", "_blank");
  await expect(post).toHaveAttribute("rel", "noopener noreferrer");
  // preview of the first paragraph, clamped to a few lines
  await expect(page.locator("#write")).toContainText(
    "Hugh Ross presents himself as a bridge between faith and science.",
  );
  await expect(
    page.locator("#write").getByRole("link", { name: /The Case Reopened/ }),
  ).toHaveAttribute("href", "https://thecasereopened.collie-truck.ts.net");
});

test("page is grouped into code, make, write, about with subsections inside", async ({
  page,
}) => {
  await page.goto("/");
  const top = await page
    .locator("main > section[id]")
    .evaluateAll((els) => els.map((e) => e.id));
  expect(top).toEqual(["code", "make", "write", "about"]);
  // projects section removed by the owner; Code holds GitHub only
  await expect(page.locator("#projects")).toHaveCount(0);
  await expect(page.locator("#code #github")).toHaveCount(1);
  // YouTube before 3D printing inside Make; no remaining-hobbies subsection
  await expect(page.locator("#make #youtube ~ #makerworld")).toHaveCount(1);
  await expect(page.locator("#also")).toHaveCount(0);
  // placeholder intro and Printables/Thingiverse links were removed by the owner
  await expect(
    page.locator("#makerworld").getByText(/Placeholder/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Printables|Thingiverse/ }),
  ).toHaveCount(0);
  await expect(
    page.locator("#about").getByRole("link", { name: /YouTube/ }),
  ).toBeVisible();
});

test("unknown route shows terminal 404", async ({ page }) => {
  const res = await page.goto("/nope");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("command not found")).toBeVisible();
});
