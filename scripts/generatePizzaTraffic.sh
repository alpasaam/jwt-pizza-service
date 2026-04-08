#!/usr/bin/env bash

# Simulating traffic — from devops329 instruction simulatingTraffic.md
#
# Defaults: run 8 hours then exit; long sleeps to keep request volume (and
# Grafana/active-series pressure) low while dashboards still show activity.
#
# Usage:
#   ./scripts/generatePizzaTraffic.sh <host> [hours]
# Example:
#   ./scripts/generatePizzaTraffic.sh https://pizza-service.saamn.dev
#   ./scripts/generatePizzaTraffic.sh https://pizza-service.saamn.dev 8

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <host> [hours]"
  echo "Example: $0 https://pizza-service.saamn.dev"
  echo "Example: $0 https://pizza-service.saamn.dev 8"
  exit 1
fi

host=$1
DURATION_HOURS="${2:-8}"
DURATION_SEC=$((DURATION_HOURS * 3600))
END_TIME=$(($(date +%s) + DURATION_SEC))

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq"
  exit 1
fi

echo "==> Target: $host"
echo "==> Auto-stop after ${DURATION_HOURS}h (~$((DURATION_SEC / 3600)) hours from now)"
echo "==> Ctrl+C to stop early"
echo ""

cleanup() {
  echo ""
  echo "==> Stopping background workers..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 0
}

PIDS=()
trap cleanup SIGINT SIGTERM

start_worker() {
  "$@" &
  PIDS+=("$!")
}

execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

login() {
  response=$(curl -s -X PUT "$host/api/auth" -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  token=$(echo "$response" | jq -r '.token')
  echo "$token"
}

# One menu poller only (was two) — enough for steady GET /api/order/menu signal.
start_worker bash -c '
  host="$0"
  end="$1"
  while [ "$(date +%s)" -lt "$end" ]; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$host/api/order/menu")
    echo "Requesting menu... $code"
    sleep 120
  done
' "$host" "$END_TIME"

# Failed auth — infrequent to avoid noisy logs / cardinality.
start_worker bash -c '
  host="$0"
  end="$1"
  while [ "$(date +%s)" -lt "$end" ]; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$host/api/auth" \
      -d "{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}" \
      -H "Content-Type: application/json")
    echo "Invalid login attempt... $code"
    sleep 300
  done
' "$host" "$END_TIME"

# Franchisee: login → wait → logout (active_users + auth traffic).
start_worker bash -c '
  host="$0"
  end="$1"
  while [ "$(date +%s)" -lt "$end" ]; do
    r=$(curl -s -X PUT "$host/api/auth" \
      -d "{\"email\":\"f@jwt.com\", \"password\":\"franchisee\"}" \
      -H "Content-Type: application/json")
    t=$(echo "$r" | jq -r ".token")
    echo "Login franchisee... $([ -n "$t" ] && [ "$t" != "null" ] && echo ok || echo fail)"
    sleep 600
    if [ -n "$t" ] && [ "$t" != "null" ]; then
      curl -s -o /dev/null -X DELETE "$host/api/auth" -H "Authorization: Bearer $t"
      echo "Logout franchisee..."
    fi
    sleep 180
  done
' "$host" "$END_TIME"

# Diner: occasional order (hits factory — keep rare).
start_worker bash -c '
  host="$0"
  end="$1"
  while [ "$(date +%s)" -lt "$end" ]; do
    r=$(curl -s -X PUT "$host/api/auth" \
      -d "{\"email\":\"d@jwt.com\", \"password\":\"diner\"}" \
      -H "Content-Type: application/json")
    t=$(echo "$r" | jq -r ".token")
    echo "Login diner... $([ -n "$t" ] && [ "$t" != "null" ] && echo ok || echo fail)"
    if [ -n "$t" ] && [ "$t" != "null" ]; then
      code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$host/api/order" \
        -H "Content-Type: application/json" \
        -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[{\"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05}]}" \
        -H "Authorization: Bearer $t")
      echo "Order... $code"
      sleep 120
      curl -s -o /dev/null -X DELETE "$host/api/auth" -H "Authorization: Bearer $t"
      echo "Logout diner..."
    fi
    sleep 480
  done
' "$host" "$END_TIME"

# Too-many-items: very rare (heavy POST + factory); still exercises failure path occasionally.
start_worker bash -c '
  host="$0"
  end="$1"
  while [ "$(date +%s)" -lt "$end" ]; do
    r=$(curl -s -X PUT "$host/api/auth" \
      -d "{\"email\":\"d@jwt.com\", \"password\":\"diner\"}" \
      -H "Content-Type: application/json")
    t=$(echo "$r" | jq -r ".token")
    if [ -z "$t" ] || [ "$t" = "null" ]; then
      sleep 900
      continue
    fi
    items="{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }"
    for ((i = 0; i < 21; i++)); do
      items+=", { \"menuId\": 1, \"description\": \"Veggie\", \"price\": 0.05 }"
    done
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$host/api/order" \
      -H "Content-Type: application/json" \
      -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}" \
      -H "Authorization: Bearer $t")
    echo "Too-many-items order... $code"
    curl -s -o /dev/null -X DELETE "$host/api/auth" -H "Authorization: Bearer $t"
    sleep 3600
  done
' "$host" "$END_TIME"

echo "==> Started ${#PIDS[@]} workers (PIDs: ${PIDS[*]})"
wait || true
echo ""
echo "==> ${DURATION_HOURS}h elapsed — exiting normally."
