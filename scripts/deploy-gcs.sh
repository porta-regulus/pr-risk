#!/usr/bin/env bash
# Upload a built bundle to the site bucket and clear the CDN cache (ADR-0006).
# Usage: scripts/deploy-gcs.sh <dist dir> <gs://bucket> <url map name>
#
# Order matters. Hashed assets go first. index.html and sw.js go last, so a
# visitor never gets an index.html that points to a file that is not there yet.
# Old hashed assets stay, because open tabs of the previous version still use them.
set -euo pipefail

dist="${1:?dist directory}"
bucket="${2:?gs://bucket}"
url_map="${3:?url map name}"

if [[ -d "$dist/assets" ]]; then
  gcloud storage rsync --recursive \
    --cache-control="public, max-age=31536000, immutable" \
    "$dist/assets" "$bucket/assets"
fi

upload() {
  local file="$1" type="$2"
  gcloud storage cp --cache-control="no-cache" --content-type="$type" "$dist/$file" "$bucket/$file"
}

upload icon.svg image/svg+xml
upload manifest.webmanifest application/manifest+json
upload index.html "text/html; charset=utf-8"
upload sw.js "text/javascript; charset=utf-8"

gcloud compute url-maps invalidate-cdn-cache "$url_map" --global --path="/*"
