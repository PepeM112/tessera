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

const EXAMPLE_TITLES = ["Sidebar", "Units", "Fixed grid", "Nested resizable", "Edge cases", "Single tile"];

// A module tile by a text only it shows. Tessera has no test ids, and the library classes are public.
function tileWith(page: Page, text: string): Locator {
  return page.locator(".tessera-module", { hasText: text });
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return box;
}

// The min-width keeps a tile at or above its minSize. The 2px tile border adds up to 2px to the flex base size of a
// share, so a tile that is pushed to its minimum ends up to 2px above it.
function expectAtMinSize(width: number, minSize: number): void {
  expect(width).toBeGreaterThanOrEqual(minSize);
  expect(width).toBeLessThan(minSize + 2);
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
  const text = await page.getByLabel("Layout JSON").textContent();
  const parsed: unknown = JSON.parse(text ?? "null");
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
      // The 2px tile border is part of the flex base size, so the ratio is a little below 3.
      const ratio = (await boxOf(main)).height / (await boxOf(info)).height;
      expect(Math.abs(ratio - 3)).toBeLessThan(0.05);
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

    const widths = await Promise.all(
      Object.keys(expected).map(async (label) => (await boxOf(tileWith(page, label))).width),
    );
    Object.entries(expected).forEach(([label, width], i) => {
      // Less than 1px apart: the tile border moves the share boundaries by about 0.7px.
      expect(Math.abs(widths[i] - width), `${label} tile width`).toBeLessThan(1);
    });
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
