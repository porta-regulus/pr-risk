#!/usr/bin/env bash
# Scan every commit of every branch for secrets with gitleaks (CI job "secrets").
# Usage: scripts/secret-scan.sh <path to gitleaks>
#
# The git scan of gitleaks finds an archive by its file name only, and it skips
# every other binary file. A ZIP or gzip file without the extension, such as a
# saved Terraform plan, is never opened. So step 2 finds archives by their first
# bytes, copies them out with the right extension and scans them as a directory.
set -euo pipefail

gitleaks="${1:?path to gitleaks}"

# 1. Text files and archives with a known extension, in every commit.
"$gitleaks" git --log-opts="--all" --max-archive-depth 2 --redact --no-banner -v .

# 2. Archives found by content, in every blob of every commit.
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
git rev-list --all --objects | cut -d' ' -f1 | git cat-file --batch-check='%(objecttype) %(objectname)' | awk '$1 == "blob" { print $2 }' |
  while read -r blob; do
    magic="$({ git cat-file blob "$blob" || true; } | od -An -tx1 -N4 | tr -d ' \n')"
    case "$magic" in
      504b0304) git cat-file blob "$blob" >"$out/$blob.zip" ;;
      1f8b*)
        # A gzip file that holds a tar file has "ustar" at byte 257 of the tar.
        if [ "$({ git cat-file blob "$blob" | gzip -dc 2>/dev/null || true; } | od -An -c -j257 -N5 | tr -d ' \n')" = "ustar" ]; then
          git cat-file blob "$blob" >"$out/$blob.tar.gz"
        else
          git cat-file blob "$blob" >"$out/$blob.gz"
        fi
        ;;
    esac
  done
echo "Archives found by content: $(find "$out" -type f | wc -l | tr -d ' ')"
"$gitleaks" dir --max-archive-depth 2 --redact --no-banner -v "$out"
