#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

bucket="$(terraform -chdir=infra output -raw site_bucket)"
distribution="$(terraform -chdir=infra output -raw distribution_id)"

pnpm build

aws s3 sync out/_next/static "s3://$bucket/_next/static" --region us-east-1 \
  --cache-control "public,max-age=31536000,immutable"
aws s3 sync out/photos "s3://$bucket/photos" --region us-east-1 \
  --cache-control "public,max-age=86400"

aws s3 sync out "s3://$bucket" --region us-east-1 --delete \
  --exclude "_next/static/*" --exclude "photos/*" \
  --cache-control "public,max-age=0,s-maxage=60,must-revalidate"

invalidation="$(aws cloudfront create-invalidation --distribution-id "$distribution" --paths "/*" --output text --query "Invalidation.Id")"
aws cloudfront wait invalidation-completed --distribution-id "$distribution" --id "$invalidation"

aws s3 sync out/_next/static "s3://$bucket/_next/static" --region us-east-1 --delete --size-only \
  --cache-control "public,max-age=31536000,immutable"
aws s3 sync out/photos "s3://$bucket/photos" --region us-east-1 --delete --size-only \
  --cache-control "public,max-age=86400"
