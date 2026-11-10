import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the VA Contracting homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /VA Contracting/i);
  assert.match(html, /Kitchens, washrooms, interlock and decks, built properly/i);
  assert.match(html, /What we build/i);
  assert.match(html, /Commercial spaces/i);
  assert.match(html, /\(647\) 272-8938/);
  assert.match(html, /tel:\+16472728938/);
  assert.match(html, /9100 Dufferin St/i);
  assert.match(html, /Working across the GTA/i);
  assert.match(html, /Tell us about your project/i);
  assert.match(html, /Send request/i);
  assert.match(html, /application\/ld\+json/i);
  assert.match(html, /og-va-contracting\.jpg/i);
  assert.doesNotMatch(html, /\/og\.png/i);
  assert.doesNotMatch(html, /Aldrich Valloyas/i);
  assert.doesNotMatch(html, /Personal project portfolio/i);
  assert.doesNotMatch(html, /sites\.google\.com\/my\.yorku\.ca\/aldrichvalloyasportfolio\/home/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/i);
});

test("server-renders the employee portal", async () => {
  const response = await render("/employee");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Employee portal/i);
  assert.match(html, /Estimate and invoice tools/i);
  assert.match(html, /estimate and invoice builder/i);
  assert.match(html, /Secure employee access/i);
  assert.match(html, /Create account/i);
  assert.match(html, /Sign in/i);
  assert.doesNotMatch(html, /Takeoff and quote tools/i);
  assert.doesNotMatch(html, /Receipt Scanner/i);
});
