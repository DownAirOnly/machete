# Machete — project context

Date: 2026-11-20. Current release: **v3.3.0**.

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


## v3.0 update — Google account gate and logo

- Authentication via existing Command Firebase project (\`command-c8162\`) using Firebase Web SDK v13.2.0 and Google popup.
- New files: \`firebase-config.js\`, \`auth.js\`, \`SECURITY.md\`. No Firestore writes or access.
- App screens and import are hidden until Google Auth resolves with a verified user.
- Account-local data is keyed \`machete.v3.<uid>\` and IndexedDB product photos use \`<uid>::<productKey>\`.
- Migration from anonymous \`machete.v2\` / \`machete.v1\` happens only when a signed-in account explicitly claims that previous on-device data. It should not be automatically assigned to whichever user signs in first.
- Logo changed from a dynamic SVG text glyph to a self-contained vector path, keeping black/white/amber identity consistent with portfolio/Command icons.
- This is an auth gate and account-scoped local data only, **not encrypted at rest and not cloud backup**. Document limitations and Firebase configuration in SECURITY.md. Machete's personal data is never put in GitHub.
- Next cloud phase must use deployed Firestore security rules for private, UID-bound documents with revisions and conflict detection; do not upload any history until validated.


## v3.1 — Product photos
- New client-side \`product-photos.js\` implements BOGO-inspired progressive verification and caching.
- Existing BOGO public JSON catalogs (\`data/current-deals.json\`, \`data/deals.json\`) can supply previously checked image files by matching product names/variants (never by fuzzy first token alone).
- Category-specific Open Facts product catalog APIs supply optional community photo URLs with strict name/brand/pack similarity checks.
- Images are loaded only near visible cards; lookups are throttled to about 7/minute, verify dimensions, cache success/miss per UID, and allow retry.
- Manual user-selected image URL/blob always wins.
- Privacy: only search phrases derived from product title leave the device (no ASIN, order ID, dates, prices, UID); no private purchase catalog is committed to GitHub.
- Accuracy preference: false negatives are acceptable, false positives not. Remaining missing hardware photos should motivate a future permitted image metadata backend if broad coverage is necessary.

Photo-search hotfix v3.1.1: use Open Facts legacy /cgi/search.pl?search_terms=...&search_simple=1&action=process&json=1, not unsupported v2 full-text search. Keep conservative image matching and rate limit.

## v3.1.2 — User reported zero photos
- Key finding: previous attempt copied only BOGO browser fallback, not its robust build-time DuckDuckGo labeled search and caching pipeline.
- Added verified legacy ASIN image URL attempts (Amazon image hosts), shorter Open Facts searches, less overstrict verbose-title coverage, new photo-cache namespace and visible diagnostics.
- Exact ASIN is only sent to Amazon's image CDN as a direct image request; Open Facts receives product-name query. No order history is posted.
- **Do not claim automatic photos reliably work without testing on the user's actual iPhone.** GitHub Pages cannot run server-side search, and many ASINs no longer support old photo URLs.
- Future durable options: user-approved backend with product catalog API (Keepa/Amazon Associates / appropriate provider), or an isolated, private product image manifest. Never publish user purchase titles/IDs in a public repo.

## v3.1.3 Amazon-first image strategy
- Added two waves of direct Amazon-owned legacy image URL patterns by ASIN; success is verified by image load and minimum dimensions.
- Gallery displays a per-photo provenance chip, not an implicit promise the image came from Amazon. Settings shows Amazon vs catalog match counts.
- Amazon Creators API is the current official supported image-metadata service, but eligibility/licensing restrict its use; it requires approved Associates credentials, secure server-side token management and compliance. Do not add anonymous browser calls or ship credentials in public JS. A private purchase-history app may not satisfy its advertising/marketing eligibility criteria.
- Do not claim broad exact-photo coverage; user can provide an image URL or manual upload. An appropriately licensed product metadata provider may be needed for complete automation.


## v3.2 — Purchased-only cleanup
- User requested removing pending, cancelled and returned/refunded items from purchase history and simplifying cards: photo, abbreviated name, paid amount, date, quantity only; detailed metadata appears after tap.
- New retainedOrders()/excludedOrders() filtering applied consistently to Home, History, spend-by-year, unique product catalog and product detail purchases.
- "Returned or refunded" is order-level from a return/refund dataset, **not always an exact line-item match**. When only the order ID is known (often multi-line orders), all affected items are hidden by default to meet the user's clutter preference; Settings > Review excluded records permits restoring a specific completed item.
- Source ZIP parser now reads Returns Status.csv and Digital Returns.csv; existing Machete v3 accounts have old refund records but not these new flags until original ZIP is imported again.
- \`state.returnOrderIds\` and \`state.restoredIds\` are UID-local, saved with v3 state, merged on import/claim and included in ZIP backup.
- New purchased vs wishlist segmented catalog. Non-purchased watchlisted items no longer pollute Purchase History or Purchased Products.
- History cards are entire-click surfaces, 2-line clipped titles and no visible type/order IDs/unit price. Tapping selects the specific order in the product detail.
- Gallery "Lowest paid" uses Amazon export's total per quantity, not its unrelated Unit Price.
- Known gap: product image coverage continues to be incomplete. Avoid additional speculative scraping approaches, prefer a licensed or properly authorized image-metadata source without exposing private purchase history.

## v3.3 — Private canonical product image library
- Normal product, history and deal views only render locally saved approved photos. Automatic image guesses were removed from normal browsing.
- Photo metadata lives in the account-scoped photoCatalog map (key, ASIN, normalized title, optional variant, source, sourceUrl, fileName, format, dimensions, approval timestamp). Canonical JPEG bytes remain in account-namespaced IndexedDB.
- New approvals normalize to white-background 480×480 JPEG with consistent padding and compression. Older user-uploaded images are recognized as approved; prior remote imageUrl entries do not count as permanent storage.
- Products and Settings lead to a Needs pictures queue. Explicit Find possible pictures requests obtain candidate images from BOGO, ASIN legacy paths and Open Facts. Only approval places an image in regular views.
- Remote hosts may block CORS image download; those images cannot be stored as a permanent copy through a static GitHub Pages app. The user can instead upload the image from Photos.
- ZIP backup includes photoCatalog and JPG files for saved images. No cloud sync; Google account sign-in alone cannot preserve pictures across devices.
- Never publish user's per-product catalog, purchased ASINs, images, order records, or personal history in the public repo.
- Product history, returns filtering, unit-price and wishlist logic remain intact; 100% catalog coverage still requires sufficient permitted sources and user approval.
