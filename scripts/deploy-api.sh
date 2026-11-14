#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pnpm --filter api build

for name in api worker; do
  aws lambda update-function-code --region us-east-1 \
    --function-name "where-is-waldo-$name" --zip-file "fileb://api/.build/$name.zip" --query LastModified --output text
  aws lambda wait function-updated --region us-east-1 --function-name "where-is-waldo-$name"
done
