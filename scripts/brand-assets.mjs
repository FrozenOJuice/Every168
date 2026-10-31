import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

// Derive app icons from the same font-independent mark used by the UI.
const root = new URL("../", import.meta.url);
const source = await readFile(
  new URL("apps/web/public/brand/mark.svg", root),
  "utf8",
);
await writeFile(new URL("apps/web/src/app/icon.svg", root), source);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(source);
  await page.addStyleTag({
    content: "body { margin: 0; } svg { display: block; }",
  });
  const render = async (size) => {
    await page.locator("svg").evaluate((svg, pixels) => {
      svg.style.width = `${pixels}px`;
      svg.style.height = `${pixels}px`;
    }, size);
    return page.locator("svg").screenshot({ omitBackground: true });
  };
  // Apple applies its own corner mask; keep the exported tile opaque.
  await page.locator("svg").evaluate((svg) => {
    svg.style.backgroundColor = svg.querySelector("rect").getAttribute("fill");
  });
  await writeFile(
    new URL("apps/web/src/app/apple-icon.png", root),
    await render(180),
  );
  await page.locator("svg").evaluate((svg) => {
    svg.style.backgroundColor = "transparent";
  });
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) images.push({ size, data: await render(size) });
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  for (const [index, { size, data }] of images.entries()) {
    const entry = 6 + index * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  }
  await writeFile(
    new URL("apps/web/src/app/favicon.ico", root),
    Buffer.concat([header, ...images.map(({ data }) => data)]),
  );
} finally {
  await browser.close();
}
