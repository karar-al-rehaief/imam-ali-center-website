# Imam Ali Center Website

A responsive single-page redesign for Imam Ali Center in Springfield, Virginia.

## Preview locally

From this folder, run:

```sh
python3 -m http.server 8765 --directory dist
```

Then open `http://127.0.0.1:8765/`.

## Notes

- Static files live in `dist/`; `.openai/hosting.json` points Sites to that directory.
- Prayer times load from AlAdhan with the Jafari calculation method. If the service is unavailable, the page asks visitors to check the IAC app.
- Inquiry and newsletter forms prepare a message in the visitor’s email app. This static version does not have a form submission or newsletter backend.
- Video cards link to IAC’s YouTube channel and Shorts page. The current uploads are not fetched dynamically.
- Weekly schedule entries reflect the source website and include a reminder to check current announcements.

## Hall rental and Square

The hall cards lead to `/hall-rental/`. The form uses the service questionnaire and includes optional fees verified on IAC's Square Online rental page. Visitors review all fees before submitting a request or paying.

Square account activation is in `/admin/#square-setup` (owner sign-in required). Start with a Square Sandbox application, then connect Production using its matching application ID, active USD card-processing location, and access token. The integration requires Orders read/write and Payments write access. The owner must confirm the displayed fees are final amounts including applicable taxes. No calendar, inventory, cancellation, or refund policy is inferred from Square Online. Confirm the date with IAC before payment.

The Web Payments SDK renders Square's card fields and handles tokenization/buyer authentication. The server creates an itemized Square order and charges its server-calculated USD total. It never receives raw card numbers. The access token and any temporary payment token are AES-GCM encrypted using the Sites secret `SQUARE_CONFIG_KEY`; preserve this secret across deployments. Do not put Square credentials in source or browser code.

Unpaid checkouts expire after a day; old open drafts are removed after a week. In-progress payments retain their original token and idempotency key for safe retries after timeouts. The browser retains a checkout capability in session storage to recover after a reload. Only Square-confirmed COMPLETED payments with matching amount, currency, and location appear as paid. Payment metadata remains for reconciliation; after successful Gmail notification, personal form answers are removed from the checkout row. When Gmail is not connected, paid rental details reach the existing protected admin inbox. Notification failure never changes a completed payment to unpaid.

Apply append-only migration `drizzle/0003_hall_checkout.sql`. Build with `npm run build`; preview with `npm run dev` at port 8766. No live payment has been made during implementation. End-to-end payment review requires IAC's Sandbox connection before Production activation.
