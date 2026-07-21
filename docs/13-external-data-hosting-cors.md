# External Data Hosting — S3 CORS Setup

> **Status:** Reference document (21 July 2026)
>
> Ops runbook for configuring the object-storage bucket that hosts the
> SRIM/Geant4 reference `.webdedx` datasets consumed by the
> [External Data](04-feature-specs/external-data.md) feature. This is
> infrastructure configuration on the storage provider (Cyfronet), not
> something this repo's CI or build pipeline can set — it must be applied
> manually with `s3cmd` (or an equivalent S3 client) by whoever holds the
> bucket credentials.

---

## 1. Why this is needed

The webdedx app fetches `.webdedx` Zarr stores directly from the browser via
`fetch()`, cross-origin (the app is served from `https://aptg.github.io/...`,
the data from a Cyfronet S3 bucket). Per
[external-data.md §2.4](04-feature-specs/external-data.md#24-hosting-requirements),
the bucket must:

- Send `Access-Control-Allow-Origin` on **every** file in the store
  (`zarr.json`, group/array metadata, shard files) — without it, the browser
  blocks the entire cold-start fetch sequence.
- Support **Range requests** (`Accept-Ranges: bytes`, honoring `Range`
  headers) — shard reads use byte ranges. S3 supports this natively; CORS
  must additionally **expose** the range-related response headers
  (`Content-Range`, `Content-Length`, `Accept-Ranges`) or the browser's
  `fetch()` can't read them cross-origin even though the request itself
  succeeds.

A bucket with no CORS configuration will still serve files fine to `curl` or
a same-origin request, but every browser request from the app's origin will
fail with a CORS error — the failure is silent from the server's point of
view (plain `200`/`206` responses, no error), so it's easy to miss without
explicitly checking headers.

---

## 2. Prerequisites

- `s3cmd` installed (`apt install s3cmd`, `brew install s3cmd`, or `pip
install s3cmd`).
- `~/.s3cfg` configured for the Cyfronet S3P endpoint:

  ```ini
  [default]
  access_key = <your access key>
  secret_key = <your secret key>
  host_base = s3p.cloud.cyfronet.pl
  host_bucket = s3p.cloud.cyfronet.pl/%(bucket)s
  use_https = True
  signature_v2 = True
  ```

  Run `s3cmd --configure` to generate this interactively, or edit it by hand.
  `host_bucket` uses **path-style** addressing (`host/bucket`, not
  `bucket.host`) — Cyfronet's S3P endpoint requires this.

- Confirm you can reach the bucket before touching CORS:

  ```sh
  s3cmd info s3://dedxweb
  ```

  A `CORS: none` line in the output confirms the bucket currently has no CORS
  rules (this was the case for the `dedxweb` bucket right after the
  2026-07-21 migration from `s3.cloud.cyfronet.pl` to `s3p.cloud.cyfronet.pl`
  — the new endpoint/bucket did not inherit the old CORS configuration).

---

## 3. Write the CORS configuration

Create `cors.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>Content-Range</ExposeHeader>
    <ExposeHeader>Accept-Ranges</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

`AllowedOrigin: *` is appropriate here: the dataset is public, read-only
(bucket ACL already grants `*anon*: READ`), and there's no cookie/credential
exchange involved, so there is no confidentiality benefit to restricting the
origin list — only maintenance cost (every new dev port, preview deployment,
or PR-preview origin would otherwise need to be added by hand).

If you'd rather restrict to known origins (matching how the old
`s3.cloud.cyfronet.pl` bucket was configured — confirmed by probing it with
`curl` before it was decommissioned, it allowed only an explicit list, not a
wildcard), use one `<AllowedOrigin>` element per origin instead:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://aptg.github.io</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedOrigin>http://127.0.0.1:5173</AllowedOrigin>
    <AllowedOrigin>http://localhost:4173</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>Content-Length</ExposeHeader>
    <ExposeHeader>Content-Range</ExposeHeader>
    <ExposeHeader>Accept-Ranges</ExposeHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

Both snippets above are complete, standalone `cors.xml` files (top-level
`<CORSConfiguration>` root with the XML declaration) — copy either one in
full; don't paste just the inner `<CORSRule>` block on its own, `s3cmd` will
reject it with `ERROR: S3 error: 400 (MalformedXML)`.

(`5173` is Vite's dev-server default port, `4173` is `vite preview`'s
default — used by `pnpm test:e2e` locally.)

---

## 4. Apply it

```sh
s3cmd setcors cors.xml s3://dedxweb
```

`s3cmd` has no `getcors` subcommand — verify the rule was accepted with:

```sh
s3cmd info s3://dedxweb
```

The `CORS:` line should now show the rule instead of `none`.

To remove CORS entirely:

```sh
s3cmd delcors s3://dedxweb
```

---

## 5. Verify from the outside

Don't rely solely on `s3cmd info` — confirm the headers actually come back
on a real request, including the CORS **preflight** (`OPTIONS`) that browsers
send before a `Range` request:

```sh
# Simple GET with Origin header — checks Access-Control-Allow-Origin
curl -sD - -o /dev/null \
  -H "Origin: https://aptg.github.io" \
  https://s3p.cloud.cyfronet.pl/dedxweb/dedxweb/srim-gui.webdedx/zarr.json \
  | grep -i "^HTTP\|access-control"

# Preflight OPTIONS — checks Allow-Methods/Allow-Headers/Expose-Headers
curl -sD - -o /dev/null -X OPTIONS \
  -H "Origin: https://aptg.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: range" \
  https://s3p.cloud.cyfronet.pl/dedxweb/dedxweb/srim-gui.webdedx/zarr.json \
  | grep -i "^HTTP\|access-control"
```

Expect to see `access-control-allow-origin`, `access-control-allow-methods`,
and (on the preflight) `access-control-expose-headers` containing
`Content-Range,Content-Length,Accept-Ranges`. If any of these are missing,
the browser will still block the request even though `curl` sees a
successful `200`/`204`.

Finally, confirm end-to-end in the app itself: load the "Calculator with the
SRIM reference dataset" example link from the
[in-app user guide](../src/routes/docs/user-guide/+page.svelte) (built from
`buildSrimCalculatorExampleUrl` in
[`src/lib/utils/external-data-example-urls.ts`](../src/lib/utils/external-data-example-urls.ts))
and check the browser console for CORS errors.

---

## 6. Cross-references

| Topic                                     | Location                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Hosting requirements (CORS, Range, HTTPS) | [04-feature-specs/external-data.md §2.4](04-feature-specs/external-data.md)  |
| CORS & mixed content in the app           | [04-feature-specs/external-data.md §10.4](04-feature-specs/external-data.md) |
| Example dataset URL (source of truth)     | `src/lib/utils/external-data-example-urls.ts`                                |
| GitHub Pages deployment                   | [08-deployment.md](08-deployment.md)                                         |
