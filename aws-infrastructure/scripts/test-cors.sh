#!/bin/bash

# Test CORS and API endpoints

API_URL="https://ivn6epkqwh.execute-api.us-east-1.amazonaws.com/dev/api"

echo "========================================="
echo "Testing API Gateway CORS Configuration"
echo "========================================="
echo ""

echo "1. Testing OPTIONS request to /auth/login"
echo "   This should return CORS headers..."
echo ""
curl -v -X OPTIONS "${API_URL}/auth/login" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  2>&1 | grep -i "access-control"

echo ""
echo "========================================="
echo ""

echo "2. Testing POST request to /auth/login (demo credentials)"
echo "   This should return user data and token..."
echo ""
curl -v -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"demo@buildertrend.com","password":"demo123"}' \
  2>&1 | grep -E "(HTTP|access-control|{)"

echo ""
echo "========================================="
echo ""

echo "3. Testing OPTIONS request to /projects"
echo "   This should return CORS headers..."
echo ""
curl -v -X OPTIONS "${API_URL}/projects" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  2>&1 | grep -i "access-control"

echo ""
echo "========================================="
echo "Done!"
echo "========================================="
