# Machete — project context

Date: 2026-11-19. Current release: **v2.0.1**.

Repo: https://github.com/DownAirOnly/machete

## Identity and design
- Name Machete, lowercase **m.** symbol (bold white m, amber dot, near-black background). Visual family resembles portfolio's **n.** and Command's **c.**.
- Dark-first, mobile-first, self-contained PWA; clear color hierarchy, compact cards, fixed bottom navigation, no unnecessary workflows.
- User wants a full picture-rich Amazon purchase history, full changes in prices paid, price per unit, and future easy rolling imports (possibly OCR).

## User data context and privacy
- User previously received a personal Amazon **Your Orders.zip** data export with folders for Retail Order History, Digital Content Orders, Refund Details and photos of deliveries. Previous conversation also produced \`Amazon_Categorized_Transactions.csv\`.
- **NEVER commit, publish, send to third-party endpoints, or bundle their real order export or transaction contents into the public Machete repo.** Source is sensitive and contains addresses/payment information and delivery photos.
- Imported files are parsed client-side. Only minimal derived fields are stored locally: item title, ASIN, date, order ID, quantity, Amazon Unit Price, total, status and type. The old ZIP and sensitive columns are intentionally discarded.
- Product pictures: Amazon's order ZIP has delivery photos, not actual catalog pictures. v2 allows optional user photo upload and HTTPS photo URL, no automatic image sourcing.

## v2 scope and structures
- \`index.html\`, \`styles.css\`, \`app.js\`, \`sw.js\`, \`manifest.webmanifest\`, \`icon.svg\`, \`vendor/jszip.min.js\`, \`vendor/LICENSE.markdown\`.
- Browser storage: \`localStorage['machete.v2']\` with \`orders\`, \`watchlist\`, \`meta\`, \`theme\`, \`importedAt\`. Image blobs in IndexedDB \`machete-images/images\`.
- CSV parser handles quoted multiline fields. Imports: original order CSV, digital orders, refunds, older categorized ledger, or ZIP containing any of these.
- Order record: id, key, asin, title, date, qty, unitPrice, total, kind, orderId, status. Dedup hash of source/type, order ID, date, ASIN/title, qty/pricing/status.
- Each product's metadata: packageUnits (explicit quantity inside purchased item), unitLabel, target, imageUrl.
- Home: imported net spending and spending by year, recent purchases, update entry point.
- History: search/filter retail/digital/refund, each recorded transaction.
- Products: gallery, detail purchase-paid chart, package-unit normalization, target prices, photos, watchlist.
- Deals: targets only, no false live price claims.
- Settings: import, complete ZIP backups with local photo blobs, theme, clear.

## Known limits/follow-ups
- Paid price on purchase dates ≠ Amazon market pricing between dates. Never connect dots as continuous actual market prices; label charts clearly.
- \`Unit Price\` is for Amazon's sold package/item. To get per-bottle/per-oz etc, a trustworthy package-size field is needed. v2 uses the quantity the user enters.
- No automatic product images; an authorized product catalog source is next, with backend if API key is needed.
- OCR receipt import is a fallback. Prefer direct structured data reimport, overlapping date detection and dedup.
- No cloud sync.
- Watch for refund double counts, returns, digital purchase/Prime fees, and older CSV schema.
- Add iOS raster touch icon if SVG is not supported by installed Safari.
- Continue focused version bumps, keep README / PROJECT_CONTEXT / version.json aligned.

## Next priority
1. Connect real product pictures and Amazon price histories through a durable, permitted data source such as Keepa (server-side key, confirmed API access).
2. Improve package detection (count / weight / volume / multipacks) and comparable per-unit prices; review inferred unit metadata rather than guessing.
3. Smarter recurring history update (Amazon export reimport or optional account-connected source) with clear dedup/report.
4. OCR of order screenshots/receipts only when structured extraction unavailable.
