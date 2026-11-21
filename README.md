# Machete

Mobile-first, installable Amazon purchasing-history and price-comparison PWA, designed to match the lowercase logo family of Everyday, Command, and the portfolio.

**v3.2.0 — November 20, 2026**

## Works now
- Import original Amazon **Your Orders.zip** locally in the browser. Reads **Your Amazon Orders/Order History.csv**, **Digital Content Orders.csv**, and **Your Returns & Refunds/Refund Details.csv**. Supports the previous **Retail.OrderHistory.\*.csv** naming as well.
- Import individual original Amazon order CSVs and the older \`Amazon_Categorized_Transactions.csv\` ledger format.
- Reimport any updated export and **deduplicate** known records instead of replacing the entire history.
- Browse full records by year/type, with product and order search; browse a grouped, searchable product catalog.
- Charts of **prices actually paid on specific purchase dates**, spending by year, purchased-item unit prices, and normalized per-contained-unit cost when you enter units per package.
- Save a product by Amazon URL and set a target price.
- Attach a product photo from your phone or use an HTTPS photo URL, with photo blobs stored in IndexedDB on your device.
- Export/import a **complete Machete ZIP backup** containing the history, watchlist, metadata, and uploaded images.
- Dark and light mode, one-handed bottom navigation, offline-capable PWA.
- Legacy v1 local watchlist migration.

## Limits and important distinctions
- **This is purchase history, NOT Amazon-wide continuous price history.** The chart has observations only on dates you bought an item.
- The Amazon export **does not contain product catalog photos**. It contains delivery photos, which Machete intentionally skips. Photos cannot be automatically populated without a distinct catalog source; use Add Photo or a valid URL until one is integrated.
- Amazon's exported \`Unit Price\` refers to the price for one sold item/package. Machete divides it by your explicit **units inside one purchased item** field only when entered.
- Amazon export totals may differ from bank charges because of multiple shipments, cancellations, refunds, taxes, fees, and authorization statuses.
- The source ZIP can contain personal addresses and media. The importer extracts narrowly scoped fields in the browser; it does **not** send, publish or store the source ZIP. **Never commit an order export to this public repository.**
- Local history is saved in localStorage; selected pictures are in IndexedDB. Data does not sync between devices. Export a complete backup before clearing browser data.
- No automatic catalog images, live market price retrieval, price-drop alerts, OCR import, or background sync yet.

## Publishing
This is a static PWA, using relative asset URLs for GitHub Pages under \`https://downaironly.github.io/machete/\`. Turn on **Settings → Pages → Deploy from a branch → main / (root)** if GitHub Pages is not already enabled.

## Testing
1. Load the app on an HTTPS domain or local server and tap **Import your history**.
2. Select the full original **Your Orders.zip** export. Verify counts, spending timeline, search, and a product detail's purchase timeline.
3. Reimport the same ZIP; the new-entries count should be zero.
4. Open a multipack item and enter units per package, e.g. 24 bottles, then verify price per bottle.
5. Pick a local product picture and export a complete backup. Reimport that backup on another browser to restore data.
6. Optional: refresh offline after the PWA has loaded once and confirm navigation works. Avoid reusing data with fake orders or shipping addresses in a public bug report.

## Potential next phase
Connect a properly authorized product catalogue and price-history provider such as Keepa, using a backend to protect paid API credentials, for product images, continuously recorded prices, and true deal verification. For incremental new purchases, prefer reimporting a newer original ZIP or a structured browser share/export flow; OCR should be a fallback for receipts/screenshots, not the primary source.


## v3 Google Authentication & branding
- Google sign-in uses Firebase Authentication's existing Command project (\`command-c8162\`), with no Firestore write or read.
- Signed-out users see a login gate, not purchase history. Each signed-in UID receives separate device-local history and image keys.
- Old anonymous Machete history is only moved when a signed-in user explicitly chooses to attach it. Back up first if needed.
- Security limitation: Google authentication gates the UI but **does not encrypt device storage** and **does not sync your data to Firebase**. See [SECURITY.md](./SECURITY.md).
- \`m.\` now renders as outlined vector artwork rather than a device-dependent font. Includes a raster iPhone home-screen icon.

**Firebase setup:** Google Authentication must be enabled in the Command Firebase project and \`downaironly.github.io\` must be an authorized domain. If a mobile installed PWA blocks a popup, open the site in Safari and sign in there.


## v3.1 — Automatic product pictures

Adapted from BOGO's product-photo design with a privacy-preserving client-side approach:
- Known public photos from the **existing BOGO verified-product photo library** (product title and package matching) are attempted first.
- Then, category-specific community product catalogs (Open Food Facts, Open Beauty Facts, Open Products Facts, Open Pet Food Facts) are searched for closely matching product names.
- Image requests are lazy-loaded near visible cards, validated for image dimensions, limited in request rate and cached per Google account. Pictures with weak, missing or conflicting product identity are **not** displayed as matches.
- User-uploaded product photos and custom HTTPS URLs take priority over auto matches.
- Each product has a **Retry auto photo** control. Settings shows cached matched/unmatched counts and allows retrying without erasing custom pictures.
- **Only product names are queried** against public catalogs; the user's ASIN, order ID, pricing, date, and Google account information are not sent to them. The shared public BOGO catalog is downloaded without product-specific queries.
- No third-party API key, external deployment, paid account, setup task or bulk manual upload required.

**Limitations:** Open catalog coverage varies widely and is generally stronger for packaged food than for specific Amazon hardware/electronics and older listings. This version does **not** promise a picture for all 230 products. The intentionally conservative matching may leave placeholders where an exact picture cannot be verified. Photos use open community data with attribution in the product view and Settings. BOGO's own images were previously found via source-labeled image search and spot-checked, but aren't a guarantee of exact Amazon variants.

### v3.1.1 photo-search correction
Full-text searches use Open Facts' documented legacy /cgi/search.pl endpoint because API v2's structured search does not support keyword searching. Provider outages and limited catalog coverage can still leave placeholders.


## v3.1.2 — No-photo recovery
- v3.1.1 returned zero visible images in user testing. Root limitation: BOGO's high coverage comes from GitHub Actions image discovery with labeled search results, not from its browser Open Facts fallback; Machete has no equivalent server-side backend.
- Clear the prior over-aggressive negative cache by bumping the per-account image-cache namespace. Searches no longer suppress failed products for 14 days.
- For legacy ASINs, test two Amazon image aliases by exact ASIN with a strict image-load check. Not all products, particularly new ASINs, support those links.
- Reduce Open Facts searches from five informative words to three, and allow precise brand + three-token matches even when Amazon listings contain additional marketing text.
- Lower search spacing to remain within a conservative number of Open Facts searches per IP per minute. Client-side failures get short retry periods.
- Add photo-progress counts to the Products view and provider error/query diagnostics in Settings. Manual photos retain precedence.
- This remains an experimental best-effort browser image system. Full product-photo coverage requires an authorized backend/catalog API or privately delivered photo pack. No private order export or full purchase list is committed to GitHub.


## v3.1.3 — Amazon-first image sourcing
- Prioritizes several legacy Amazon-owned ASIN-based image URL patterns before trying BOGO / community catalog matches.
- The product grid now distinguishes **Amazon photo**, **Catalog match**, and **Your photo** so it is clear whether the image comes from Amazon or a different provider.
- Settings shows how many cached photos are sourced from Amazon vs other catalogs.
- These URL patterns are best-effort only: modern Amazon media filenames are not a function of the ASIN. Complete Amazon-hosted primary images require a properly authorized product-data source. The Amazon Creators API provides primary image metadata for approved Associates, with licensing restrictions that must be satisfied; Machete does not use it.
- Amazon CDN image requests disclose the product's public ASIN to Amazon, not purchase history or the Google account.


## v3.2 — Accurate retained-purchase history and concise cards
- The Home timeline, History screen, spending totals, and Purchased product catalog now include only **completed records** from orders that have not been marked returned or refunded. Pending and cancelled items, return/refund records and return-flagged orders do not appear in the normal views.
- **Underlying raw imported records are preserved**. Settings > Review excluded records lists filtered entries and offers an individual "Keep this item" override for completed items in return/refund-flagged orders. This is important because Amazon's return/refund exports sometimes identify only the order, not the specific item in a multi-item order. The default is to hide all items in an affected order, not claim an exact line-item match.
- Existing imported refund rows are applied to the filter automatically. **Reimport the original Your Orders.zip** to use the separate \`Your Returns & Refunds/Returns Status.csv\` and \`Your Amazon Orders/Digital Returns.csv\` tables, which older app versions omitted. The importer merges those order flags without duplicating existing purchases.
- History cards show only picture, short two-line title, purchase date, quantity, and total item amount. The whole card opens the product details. The tapped purchase's export unit price, original order ID, export status and other details remain in the new Purchase details section.
- Effective paid-per-item price (exported item total / quantity) is used for purchase comparisons. This can include discounts and tax, unlike Amazon's separately exported unit-price field.
- Purchased products and Amazon Wishlist are separate segments. Wishlist-only/pending entries no longer appear as pretend purchases. The add-to-wishlist URL form is moved into Wishlist.
- Raw records, return flags, account-local wishlist and restore overrides are included in Machete ZIP backups; no private transaction records are committed to GitHub.
- Image behavior is retained: verified Amazon ASIN aliases where available, then conservative catalog matches. Many images remain missing without a licensed product metadata backend; avoid claiming this fixes image coverage.
