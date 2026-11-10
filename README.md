# VA Contracting Website

Public VA Contracting website plus the employee portal for estimates, invoices,
jobsites, testimonials, and direct client email.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Email Sending

The employee portal sends estimates and invoices through Gmail API when the Gmail
credentials are present. Resend remains as a fallback for testing.

Required Cloudflare runtime secrets for Gmail:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `ESTIMATE_FROM_EMAIL`

`ESTIMATE_FROM_EMAIL` should be the authorized Gmail address, for example
`vacontractinginc73@gmail.com`.

Optional:

- `ESTIMATE_BCC_EMAIL`

Fallback/testing:

- `RESEND_API_KEY`

When Gmail secrets are present, Gmail is preferred automatically. No employee UI
change is needed.

## Public Site (November 2026 redesign)

- Business details (phone, email, address, service areas) live in
  `app/_site/business.ts`. Change them there and the header, footer, map,
  structured data, and emails all update.
- Public styles are in `app/site.css` (every class starts with `va-`), so the
  employee portal styles in `app/globals.css` are untouched.
- Photos are served from `public/images/` as WebP (small and large) with JPG
  fallbacks via `app/_site/Photo.tsx`. To add a project photo, export
  `name.jpg`, `name-sm.webp` (800px wide) and `name-lg.webp` (up to 1600px),
  then add the name and sizes to `Photo.tsx`.
- Bump `CACHE_NAME` in `public/sw.js` whenever images or icons change.

## Quote Requests

The "Tell us about your project" form posts to `/api/contact`, which:

1. saves the request in D1 (`contact_requests`, created automatically),
2. stores attached photos in the `RECEIPTS` R2 bucket (`quote-*` keys),
3. emails a notification using the same Gmail/Resend secrets as estimates.

Email delivery, in order of preference:

1. **Gmail API / Resend** (the estimate-email secrets). VA gets the request from
   its own Gmail address, and the customer gets a "we received your request"
   confirmation from VA.
2. **FormSubmit relay** (no setup, no keys). If the server could not email,
   the visitor's browser relays the request to `business.formRelay`
   (`app/_site/business.ts`) via formsubmit.co. The very first relay sends an
   "Activate Form" email to that inbox; click it once and every later request
   is delivered. FormSubmit then offers a random alias; paste it into
   `formRelay` to keep the email address out of the page source.

Requests show up in the employee portal under **Quote requests**, where you
can view photos, add notes, and track status (New, Contacted, Quoted, Won,
Closed). If email is not configured the request is still saved. If both the
database and email fail, the visitor is offered a pre-filled email instead.

Optional runtime variable:

- `CONTACT_NOTIFY_EMAIL`: where new requests are emailed. Defaults to the
  email in `app/_site/business.ts`.

Spam protection: hidden honeypot field, a minimum fill time, and a limit of
5 requests per hour per connection.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
