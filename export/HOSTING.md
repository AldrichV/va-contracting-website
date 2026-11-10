# VA Contracting Export

The production site was deployed to Cloudflare Pages under project `va-contracting`, at `https://va-contracting.pages.dev`. Vinext builds the React application into a server Worker and browser assets. The Pages entry point `_worker.js` sends static requests to the Pages `ASSETS` binding so stylesheets, JavaScript and images load.

## Build and stage

From the extracted project root, use Node.js 22.13 or later and run:

```powershell
npm ci
npm run build
pwsh -File ./export/Stage-Pages.ps1
```

The last command prints the upload directory. Use `powershell` instead of `pwsh` on Windows if PowerShell 7 is unavailable.

## Cloudflare setup

1. Use the existing Pages project or create a Direct Upload project in the destination account. For a new project, update its name and the D1 and R2 resource details in `wrangler.jsonc`. Set `pages_build_output_dir` to the staged directory name.
2. Bind the D1 database as `DB` and the R2 bucket as `RECEIPTS` in production. The original resources are `va-contracting-db` and `va-contracting-receipts`.
3. For a fresh database, apply the included migrations with `npx wrangler d1 migrations apply va-contracting-db --remote`, substituting the destination database name if needed. For a move with existing records, export the original D1 database separately and restore it into the destination. Copy R2 objects separately while preserving object keys. Keep both exports private.
4. In Pages runtime settings, configure `ESTIMATE_FROM_EMAIL` and the chosen email provider. Gmail uses `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN`. Resend uses `RESEND_API_KEY`. `ESTIMATE_BCC_EMAIL` is optional. Store the client secret, refresh token and API key as secrets.
5. Run `npx wrangler login`, then `npx wrangler pages deploy <staged-directory> --project-name <project-name> --branch main`. Use the project's configured production branch if it differs.
6. Check the homepage stylesheet and photos, employee sign-in, saved documents, uploads and a test email to an address you control.

The ZIP includes source, original public assets, lockfiles and database migrations. Live records, bucket contents, credentials, installed dependencies and Git history are separate.
