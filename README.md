# Machete

Mobile-first, installable Amazon purchasing-history and price-comparison PWA, designed to match the lowercase logo family of Everyday, Command, and the portfolio.

**v2.0.0 — November 19, 2026**

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
