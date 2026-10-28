import { expect, test, type Locator, type Page } from "@playwright/test";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface JsonTile {
  size?: number | string;
  children?: JsonTile[];
}

const DEFAULT_GAP_PX = 8;
const KEY_STEP_PX = 10;
const DEFAULT_RESIZABLE_MIN_PX = 48;

const EXAMPLE_TITLES = ["Sidebar", "Units", "Fixed grid", "Nested resizable", "Groups", "Edge cases", "Single tile"];

// A module tile by a text only it shows. Tessera has no test ids, and the library classes are public.
function tileWith(page: Page, text: string): Locator {
  return page.locator(".tessera-module", { hasText: text });
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return box;
}

// A drag commits shares rounded to 3 decimals (size.ts), which is up to about 0.3px at this width.
function expectAtMinSize(width: number, minSize: number): void {
  expect(width).toBeGreaterThanOrEqual(minSize);
  expect(width).toBeLessThan(minSize + 0.5);
}

async function openExample(page: Page, title: string): Promise<void> {
  await page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name: title, exact: true }).click();
}

async function dragBy(page: Page, locator: Locator, dx: number, dy: number): Promise<void> {
  const { x, y, width, height } = await boxOf(locator);
  const [startX, startY] = [x + width / 2, y + height / 2];
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx / 2, startY + dy / 2, { steps: 5 });
  await page.mouse.move(startX + dx, startY + dy, { steps: 5 });
  await page.mouse.up();
}

function nextFrames(page: Page): Promise<void> {
  return page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

async function readJson(page: Page): Promise<JsonTile> {
  const text = await page.getByLabel("Layout JSON").inputValue();
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || !("root" in parsed)) throw new Error("Not a layout");
  // SAFETY: the playground shows the layout it renders, and the tests only read size and children.
  return parsed.root as JsonTile;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("Sidebar", () => {
  test("keeps the 240px tile and the 3:1 ratio after a viewport resize", async ({ page }) => {
    const nav = tileWith(page, "Nav item 1");
    const main = tileWith(page, "Main");
    const info = tileWith(page, "Info");

    const checkLayout = async (): Promise<void> => {
      expect((await boxOf(nav)).width).toBeCloseTo(240, 1);
      const ratio = (await boxOf(main)).height / (await boxOf(info)).height;
      expect(ratio).toBeCloseTo(3, 2);
    };

    await checkLayout();
    await page.setViewportSize({ width: 1000, height: 600 });
    await checkLayout();
    await page.setViewportSize({ width: 1500, height: 900 });
    await checkLayout();
  });
});

test.describe("Units", () => {
  test("sizes each tile from its unit, with the theme gap", async ({ page }) => {
    await openExample(page, "Units");
    const workspace = page.locator(".tessera-workspace");
    const { width: workspaceWidth } = await boxOf(workspace);
    const { padding, rootFontPx } = await workspace.evaluate((element) => ({
      padding: parseFloat(getComputedStyle(element).paddingLeft),
      rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
    }));
    const { width: gap } = await boxOf(page.getByRole("separator").first());
    expect(gap).toBe(DEFAULT_GAP_PX);

    const inner = workspaceWidth - 2 * padding;
    const fixed = { "20%": 0.2 * inner, "12rem": 12 * rootFontPx, "200px": 200 };
    const free = inner - 4 * gap - fixed["20%"] - fixed["12rem"] - fixed["200px"];
    const expected: Record<string, number> = { ...fixed, "Share 1": free / 3, "Share 2": (free * 2) / 3 };

    // Tiles with the same key in the old example animate to the new sizes.
    await Promise.all(
      Object.entries(expected).map(([label, width]) =>
        expect
          .poll(async () => (await boxOf(tileWith(page, label))).width, { message: `${label} tile width` })
          .toBeCloseTo(width, 1),
      ),
    );
  });
});

test.describe("Nested resizable", () => {
  test.beforeEach(async ({ page }) => {
    await openExample(page, "Nested resizable");
  });

  const rowDivider = (page: Page): Locator => page.locator('[role="separator"][aria-orientation="vertical"]');

  test("moves with a mouse drag, stops at minSize and shows the sizes in the JSON view", async ({ page }) => {
    const left = tileWith(page, "Left");
    const right = tileWith(page, "Right");
    const before = (await boxOf(left)).width;

    await dragBy(page, rowDivider(page), 100, 0);
    expect(Math.abs((await boxOf(left)).width - (before + 100))).toBeLessThan(1);
    const [leftJson, rightJson] = (await readJson(page)).children?.[0]?.children ?? [];
    expect(leftJson?.size).toBeGreaterThan(1);
    expect(rightJson?.size).toBeLessThan(1);

    await dragBy(page, rowDivider(page), 2000, 0);
    const [leftWidth, rightWidth] = [(await boxOf(left)).width, (await boxOf(right)).width];
    expectAtMinSize(rightWidth, 200);
    const [leftEnd, rightEnd] = (await readJson(page)).children?.[0]?.children ?? [];
    // The two shares add up to 2, so each share is 2 * its width / the width of both tiles.
    expect(Number(rightEnd?.size)).toBeCloseTo((2 * rightWidth) / (leftWidth + rightWidth), 2);
    expect(Number(leftEnd?.size)).toBeCloseTo((2 * leftWidth) / (leftWidth + rightWidth), 2);
  });

  test("moves with the keyboard", async ({ page }) => {
    const left = tileWith(page, "Left");
    const before = (await boxOf(left)).width;
    const divider = rowDivider(page);

    await divider.focus();
    await page.keyboard.press("ArrowRight");
    expect(Math.abs((await boxOf(left)).width - (before + KEY_STEP_PX))).toBeLessThan(1);

    await page.keyboard.press("Home");
    expectAtMinSize((await boxOf(left)).width, DEFAULT_RESIZABLE_MIN_PX);
    const [leftJson] = (await readJson(page)).children?.[0]?.children ?? [];
    expect(leftJson?.size).toBeLessThan(0.2);
  });
});

test.describe("Theme", () => {
  test("a gap change updates the CSS variable and the tile positions", async ({ page }) => {
    const workspace = page.locator(".tessera-workspace");
    const nav = tileWith(page, "Nav item 1");
    const main = tileWith(page, "Main");
    const gapBetween = async (): Promise<number> =>
      (await boxOf(main)).x - (await boxOf(nav)).x - (await boxOf(nav)).width;
    const gapVariable = (): Promise<string> =>
      workspace.evaluate((element) => getComputedStyle(element).getPropertyValue("--tessera-gap"));

    expect(await gapVariable()).toBe(`${DEFAULT_GAP_PX}px`);
    expect(await gapBetween()).toBeCloseTo(DEFAULT_GAP_PX, 1);

    await page.getByLabel("Gap").fill("20");
    expect(await gapVariable()).toBe("20px");
    expect(await gapBetween()).toBeCloseTo(20, 1);
  });
});

test.describe("Playground", () => {
  test("lists every example that the console tests cover", async ({ page }) => {
    const buttons = page.getByRole("navigation", { name: "Layouts" }).getByRole("button");
    await expect(buttons).toHaveText(EXAMPLE_TITLES);
  });
});

test.describe("JSON editor", () => {
  const editor = (page: Page): Locator => page.getByLabel("Layout JSON");
  const infoShare = /"size": 1(?=\s*\n)/;

  const mainToInfoRatio = async (page: Page): Promise<number> =>
    (await boxOf(tileWith(page, "Main"))).height / (await boxOf(tileWith(page, "Info"))).height;

  test("a valid edit changes the tile sizes at once and keeps the text as typed", async ({ page }) => {
    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(3, 2);

    const edited = (await editor(page).inputValue()).replace(infoShare, '"size":   3');
    await editor(page).fill(edited);

    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(1, 2);
    await expect(editor(page)).toHaveValue(edited);
    await expect(editor(page)).toHaveAttribute("aria-invalid", "false");
  });

  test("shows the errors, keeps the last valid layout and recovers when the text is fixed", async ({ page }) => {
    const valid = await editor(page).inputValue();
    const errors = page.locator("#layout-json-errors");

    await editor(page).fill(valid.slice(0, -2));
    await expect(editor(page)).toHaveAttribute("aria-invalid", "true");
    await expect(editor(page)).toHaveAttribute("aria-describedby", "layout-json-errors");
    await expect(errors.getByRole("listitem")).toHaveCount(1);
    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(3, 2);

    await editor(page).fill(valid.replace(infoShare, '"size": -1'));
    await expect(errors).toContainText("root.children[1].children[1].size");
    await expect(editor(page)).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(3, 2);

    await editor(page).fill(valid.replace(infoShare, '"size": 3'));
    await expect(errors).toHaveCount(0);
    await expect(editor(page)).toHaveAttribute("aria-invalid", "false");
    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(1, 2);
  });

  test("a drag after an edit writes the new sizes into the editor", async ({ page }) => {
    await editor(page).fill((await editor(page).inputValue()).replace(infoShare, '"size": 3'));
    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(1, 2);
    const before = await editor(page).inputValue();

    await dragBy(page, page.locator('[role="separator"][aria-orientation="horizontal"]'), 0, 60);

    await expect(editor(page)).not.toHaveValue(before);
    const [main, info] = (await readJson(page)).children?.[1]?.children ?? [];
    expect(Number(main?.size) / Number(info?.size)).toBeLessThan(3);
  });

  test("selecting the same example again resets the sizes and the editor text", async ({ page }) => {
    await dragBy(page, page.locator('[role="separator"][aria-orientation="horizontal"]'), 0, 60);
    await expect(async () => {
      expect(await mainToInfoRatio(page)).toBeGreaterThan(3.2);
    }).toPass();

    await openExample(page, "Sidebar");

    await expect.poll(() => mainToInfoRatio(page)).toBeCloseTo(3, 2);
    const [main, info] = (await readJson(page)).children?.[1]?.children ?? [];
    expect([main?.size, info?.size]).toEqual([3, 1]);
  });

  test("selecting an example replaces the editor text and clears the errors", async ({ page }) => {
    await editor(page).fill("{");
    await expect(editor(page)).toHaveAttribute("aria-invalid", "true");

    await openExample(page, "Single tile");
    await expect(editor(page)).toHaveAttribute("aria-invalid", "false");
    expect(JSON.parse(await editor(page).inputValue())).toHaveProperty("root");
    await expect(editor(page)).not.toHaveValue("{");
  });

  test("logs no console errors or warnings while typing", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));

    await editor(page).press("Control+End");
    await editor(page).pressSequentially("   x");
    await editor(page).press("Backspace");
    await editor(page).press("Backspace");
    await editor(page).press("Backspace");
    await editor(page).press("Backspace");

    await nextFrames(page);
    expect(problems).toEqual([]);
  });
});

test.describe("StrictMode", () => {
  EXAMPLE_TITLES.forEach((title) => {
    test(`${title}: no console errors or warnings while switching and dragging`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") problems.push(message.text());
      });
      page.on("pageerror", (error) => problems.push(error.message));

      // A fresh page, so the console listeners see the whole load of the example.
      await page.reload();
      await openExample(page, title);
      const dividers = page.getByRole("separator");
      if ((await dividers.count()) > 0) {
        await dragBy(page, dividers.first(), 30, 30);
        await dividers.first().focus();
        await page.keyboard.press("End");
      }

      await nextFrames(page);
      expect(problems).toEqual([]);
    });
  });
});
