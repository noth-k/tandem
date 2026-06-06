#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rm -rf .bundle function.zip
mkdir -p .bundle

if grep -q '^[[:space:]]*[^#[:space:]]' requirements.txt; then
  python3 -m pip install -r requirements.txt -t .bundle
fi

cp index.py .bundle/

(
  cd .bundle
  zip -r ../function.zip .
)

rm -rf .bundle

echo "Created $(pwd)/function.zip"
