#!/bin/sh
set -eu

mode="${CORS_MODE:-restricted}"

case "$mode" in
  restricted)
    cp /etc/nginx/templates/default.restricted.conf /etc/nginx/conf.d/default.conf
    ;;
  open)
    cp /etc/nginx/templates/default.open.conf /etc/nginx/conf.d/default.conf
    ;;
  *)
    echo "Unsupported CORS_MODE '$mode'. Expected 'restricted' or 'open'." >&2
    exit 1
    ;;
esac

echo "Using CORS mode: $mode"