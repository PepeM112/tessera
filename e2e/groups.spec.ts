import { expect, test, type Locator, type Page } from "@playwright/test";

// A card by a word only it shows. Tessera has no test ids, and the library classes are public.
function cardWith(page: Page, words: string): Locator {
  return page.locator(".tessera-module", { hasText: words });
}

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return box.width;
}

function nextFrames(page: Page): Promise<void> {
  return page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

// The sizes of the old example animate to the new ones. Wait until two reads of A give the same width.
async function openGroups(page: Page): Promise<void> {
  await page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name: "Groups", exact: true }).click();
  const cardA = cardWith(page, "red apple");
  let previous = -1;
  await expect
    .poll(async () => {
      const width = await widthOf(cardA);
      const isSettled = width === previous;
      previous = width;
      return isSettled;
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await openGroups(page);
});

test.describe("Groups", () => {
  const cardA = (page: Page): Locator => cardWith(page, "red apple");
  const cardB = (page: Page): Locator => cardWith(page, "blue boat");
  const wide = (page: Page): Locator => cardWith(page, "good morning");

  test("removing B with × grows A to the group width, and the checkbox restores B", async ({ page }) => {
    const widthBefore = await widthOf(cardA(page));
    expect(await widthOf(cardB(page))).toBeCloseTo(widthBefore, 0);

    await page.getByRole("button", { name: "Remove B" }).click();
    await expect.poll(() => cardB(page).count()).toBe(0);
    await expect.poll(async () => widthOf(cardA(page))).toBeCloseTo(await widthOf(wide(page)), 0);
    await expect(page.getByRole("checkbox", { name: "B" })).not.toBeChecked();

    await page.getByRole("checkbox", { name: "B" }).check();
    await expect.poll(() => cardB(page).count()).toBe(1);
    await expect.poll(() => widthOf(cardA(page))).toBeCloseTo(widthBefore, 0);
    expect(await widthOf(cardB(page))).toBeCloseTo(widthBefore, 0);
  });

  test("the checkbox removes B, and the last card of a group cannot be removed", async ({ page }) => {
    await page.getByRole("checkbox", { name: "B" }).uncheck();
    await expect.poll(() => cardB(page).count()).toBe(0);
    await expect(page.getByRole("checkbox", { name: "A" })).toBeDisabled();
  });

  test("with A static, removing B keeps the width of A and writes a spacer", async ({ page }) => {
    const widthBefore = await widthOf(cardA(page));
    await page.getByLabel("Flex of A").selectOption("static");

    await page.getByRole("button", { name: "Remove B" }).click();
    await expect.poll(() => cardB(page).count()).toBe(0);
    await expect(page.getByLabel("Layout JSON")).toHaveValue(/"spacer": true/);
    expect(await widthOf(cardA(page))).toBeCloseTo(widthBefore, 0);

    await page.getByRole("checkbox", { name: "B" }).check();
    await expect.poll(() => cardB(page).count()).toBe(1);
    await expect(page.getByLabel("Layout JSON")).not.toHaveValue(/"spacer": true/);
  });

  test("the dots of the wide card show on hover and page between the windows", async ({ page }) => {
    const tile = wide(page);
    const dots = tile.locator(".tessera-window-dots");
    const secondDot = tile.getByRole("button", { name: "Window 2 of 2" });
    const opacity = (): Promise<string> => dots.evaluate((element) => getComputedStyle(element).opacity);

    expect(await opacity()).toBe("0");
    await tile.hover();
    await expect.poll(opacity).toBe("1");
    await expect(tile.getByRole("button", { name: "Window 1 of 2" })).toHaveAttribute("aria-current", "true");

    await secondDot.click();
    await expect(secondDot).toHaveAttribute("aria-current", "true");
    await expect
      .poll(async () => {
        const [tileBox, heading] = [
          await tile.boundingBox(),
          await tile.getByText("World", { exact: true }).boundingBox(),
        ];
        return tileBox && heading
          ? heading.x >= tileBox.x && heading.x + heading.width <= tileBox.x + tileBox.width
          : false;
      })
      .toBe(true);
  });

  test("no console errors or warnings while removing, restoring and paging", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await page.reload();
    await page
      .getByRole("navigation", { name: "Layouts" })
      .getByRole("button", { name: "Groups", exact: true })
      .click();
    await page.getByLabel("Flex of A").selectOption("static");
    await page.getByRole("button", { name: "Remove B" }).click();
    await expect.poll(() => cardB(page).count()).toBe(0);
    await page.getByRole("checkbox", { name: "B" }).check();
    await expect.poll(() => cardB(page).count()).toBe(1);
    await page.getByRole("button", { name: "Remove Left" }).click();
    await expect.poll(() => cardWith(page, "tall calm").count()).toBe(0);
    await wide(page).hover();
    await wide(page).getByRole("button", { name: "Window 2 of 2" }).click();

    await nextFrames(page);
    expect(problems).toEqual([]);
  });
});
