# Imam Ali Center website

Source for the core Imam Ali Center website at https://imamalicenter.org.
The media team application is maintained in a separate repository.

## Structure

- `imam-ali-center-website/`: page generators, browser JavaScript, styles,
  public images, content, backend handlers, database schema, and integrations.
  `dist/index.html` is the shared page-shell source; keep it and the other
  static assets tracked. Page generators update the interior pages in `dist/`.
- `imam-ali-center-cloudflare/`: Cloudflare Access verification, Wrangler
  configuration, D1 migrations, and deployment preparation.

## Build

Requires Node.js and npm.

```sh
npm --prefix imam-ali-center-cloudflare ci
npm run build
```

The build places deployable assets in `imam-ali-center-cloudflare/public/` and
generated server modules in `imam-ali-center-cloudflare/src/generated/`.
Those generated copies are ignored by Git.

## Deploy to Cloudflare

```sh
cd imam-ali-center-cloudflare
npx wrangler login
node scripts/cloudflare.mjs deploy
```

Deployment targets the existing `imam-ali-center` Worker and its configured
`imamalicenter.org` and `www.imamalicenter.org` custom domains. Change account,
resource IDs, and routes in `wrangler.jsonc` before deploying to another account.
GitHub pushes do not automatically deploy this website.

## Runtime configuration

- D1 binding: `DB`.
- Private R2 bucket binding: `BUCKET`. Do not make this bucket public; it can
  contain private service-request attachments.
- Cloudflare Access: protect `/admin*` and `/api/admin/*` on every enabled host.
  The Worker validates signed Access tokens against `CF_ACCESS_TEAM_DOMAIN`
  and `CF_ACCESS_AUD` and restricts administration to the configured IAC account.
- Configure `SQUARE_CONFIG_KEY` and `GMAIL_BRIDGE_SECRET` as Worker secrets.
  Configure Square and optional Gmail delivery through the protected admin UI.
- Credentials, private submissions, database exports, local login state, and
  historical hosting metadata are excluded from this repository.

The public Google Analytics measurement ID is `G-KED5EQY5KT`.
The page build adds its tag once per page. Hall rental pages and the Hall rental
service selection use the dedicated rental contact number.

Cloudflare usage allowances and storage charges depend on the account's plan
and actual usage. This repository does not provision a paid plan.
