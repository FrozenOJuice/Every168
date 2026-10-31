import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

// A designed cover composed from real app captures, without redrawing their UI.
const root = new URL("../", import.meta.url);
const data = async (name, type) =>
  `data:${type};base64,${(await readFile(new URL(name, root))).toString("base64")}`;
const [logo, calendar, workout] = await Promise.all([
  data("apps/web/public/brand/wordmark.svg", "image/svg+xml"),
  data("docs/media/screenshots/calendar-week.png", "image/png"),
  data("docs/media/screenshots/live-workout.png", "image/png"),
]);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 640 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 1280px; height: 640px; overflow: hidden; }
      body { background: #f8f8f5; color: #1e2422; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .brand { position: absolute; left: 56px; top: 54px; width: 245px; height: 56px; }
      .eyebrow { position: absolute; left: 58px; top: 184px; color: #196b57; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
      h1 { position: absolute; left: 54px; top: 214px; margin: 0; font-size: 51px; line-height: 1.08; letter-spacing: -2.1px; font-weight: 750; }
      h1 span { display: block; color: #196b57; }
      .intro { position: absolute; left: 58px; top: 416px; width: 366px; font-size: 18px; line-height: 1.5; color: #66706c; margin: 0; }
      .footer { position: absolute; left: 58px; bottom: 50px; color: #66706c; font-size: 13px; }
      .screen { position: absolute; margin: 0; border: 1px solid #dfe3dc; border-radius: 12px; overflow: hidden; background: white; box-shadow: 0 14px 40px #1e24221a; }
      .screen img { position: absolute; max-width: none; }
      .calendar { left: 546px; top: 50px; width: 650px; height: 414px; }
      .calendar img { width: 746px; height: auto; left: -96px; top: 0; }
      .workout { left: 727px; top: 230px; width: 492px; height: 374px; box-shadow: 0 16px 48px #1e24222b; }
      .workout img { width: 782px; height: auto; left: -100px; top: -110px; }
    </style></head><body>
      <img class="brand" src="${logo}" alt="Every168">
      <div class="eyebrow">Calendar + Fitness</div>
      <h1>Plan your week.<span>Record your<br>training.</span></h1>
      <p class="intro">One connected workspace for your time and training.</p>
      <div class="footer">Open source · TypeScript · Next.js · PostgreSQL</div>
      <figure class="screen calendar"><img src="${calendar}" alt="Genuine Calendar Week capture"></figure>
      <figure class="screen workout"><img src="${workout}" alt="Genuine live-workout capture"></figure>
    </body></html>`);
  await page.evaluate(async () => {
    await Promise.all([...document.images].map((image) => image.decode()));
    await document.fonts.ready;
  });
  const image = await page.screenshot({ animations: "disabled" });
  if (image.readUInt32BE(16) !== 1280 || image.readUInt32BE(20) !== 640)
    throw new Error("Social preview dimensions must be 1280×640.");
  if (image.length >= 1_000_000)
    throw new Error("Social preview must remain below 1 MB.");
  await writeFile(new URL("docs/media/social-preview.png", root), image);
  console.log(
    `Created docs/media/social-preview.png (1280×640, ${image.length} bytes).`,
  );
} finally {
  await browser.close();
}
