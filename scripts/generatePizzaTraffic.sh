#!/bin/bash

# Simulating traffic — from devops329 instruction simulatingTraffic.md
# Usage: ./scripts/generatePizzaTraffic.sh <host>
# Example: ./scripts/generatePizzaTraffic.sh https://pizza-service.yourdomainname.click
# Example: ./scripts/generatePizzaTraffic.sh http://localhost:3000

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 http://localhost:3000"
  echo "Example: $0 https://pizza-service.yourdomainname.click"
  exit 1
fi
host=$1

cleanup() {
  echo "Terminating background processes..."
  kill $pid1 $pid1b $pid2 $pid3 $pid4 $pid5 2>/dev/null
  exit 0
}
trap cleanup SIGINT

execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

login() {
  response=$(curl -s -X PUT $host/api/auth -d "{\"email\":\"$1\", \"password\":\"$2\"}" -H 'Content-Type: application/json')
  token=$(echo $response | jq -r '.token')
  echo $token
}

while true; do
  result=$(execute_curl "$host/api/order/menu")
  echo "Requesting menu..." $result
  sleep 1
done &
pid1=$!

while true; do
  result=$(execute_curl "$host/api/order/menu")
  echo "Requesting menu (2)..." $result
  sleep 0.8
done &
pid1b=$!

while true; do
  result=$(execute_curl "-X PUT \"$host/api/auth\" -d '{\"email\":\"unknown@jwt.com\", \"password\":\"bad\"}' -H 'Content-Type: application/json'")
  echo "Logging in with invalid credentials..." $result
  sleep 5
done &
pid2=$!

while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "Login franchisee..." $( [ -z "$token" ] && echo "false" || echo "true" )
  sleep 25
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out franchisee..." $result
  sleep 3
done &
pid3=$!

while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login diner..." $( [ -z "$token" ] && echo "false" || echo "true" )
  result=$(execute_curl "-X POST $host/api/order -H 'Content-Type: application/json' -d '{\"franchiseId\": 1, \"storeId\":1, \"items\":[{ \"menuId\": 1, \"description\": \"Veggie\", \"price\": 25 }]}' -H \"Authorization: Bearer $token\"")
  echo "Bought a pizza..." $result
  sleep 5
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out diner..." $result
  sleep 8
done &
pid4=$!

while true; do
  token=$(login "d@jwt.com" "diner")
  echo "Login hungry diner..." $( [ -z "$token" ] && echo "false" || echo "true" )

  items='{ "menuId": 1, "description": "Veggie", "price": 25 }'
  for (( i=0; i < 21; i++ ))
  do items+=', { "menuId": 1, "description": "Veggie", "price": 25 }'
  done

  result=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$host/api/order" -H 'Content-Type: application/json' -d "{\"franchiseId\": 1, \"storeId\":1, \"items\":[$items]}" -H "Authorization: Bearer $token")
  echo "Bought too many pizzas..." $result
  sleep 2
  result=$(execute_curl "-X DELETE $host/api/auth -H \"Authorization: Bearer $token\"")
  echo "Logging out hungry diner..." $result
  sleep 45
done &
pid5=$!

wait $pid1 $pid1b $pid2 $pid3 $pid4 $pid5
