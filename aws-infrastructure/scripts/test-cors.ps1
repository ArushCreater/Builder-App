# Test CORS and API endpoints

$ErrorActionPreference = "Continue"
$ApiUrl = "https://ivn6epkqwh.execute-api.us-east-1.amazonaws.com/dev/api"

Write-Host "=========================================" -ForegroundColor Green
Write-Host "Testing API Gateway CORS Configuration" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "1. Testing OPTIONS request to /auth/login" -ForegroundColor Yellow
Write-Host "   This should return CORS headers..." -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/auth/login" `
        -Method OPTIONS `
        -Headers @{
            "Origin" = "http://localhost:3000"
            "Access-Control-Request-Method" = "POST"
            "Access-Control-Request-Headers" = "Content-Type,Authorization"
        } `
        -UseBasicParsing

    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "CORS Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor White
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "2. Testing POST request to /auth/login (demo credentials)" -ForegroundColor Yellow
Write-Host "   This should return user data and token..." -ForegroundColor Gray
Write-Host ""

try {
    $body = @{
        email = "demo@buildertrend.com"
        password = "demo123"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$ApiUrl/auth/login" `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Origin" = "http://localhost:3000"
        } `
        -Body $body `
        -UseBasicParsing

    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
    Write-Host ""
    Write-Host "CORS Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor White
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "3. Testing OPTIONS request to /projects" -ForegroundColor Yellow
Write-Host "   This should return CORS headers..." -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/projects" `
        -Method OPTIONS `
        -Headers @{
            "Origin" = "http://localhost:3000"
            "Access-Control-Request-Method" = "GET"
            "Access-Control-Request-Headers" = "Content-Type,Authorization"
        } `
        -UseBasicParsing

    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "CORS Headers:" -ForegroundColor Cyan
    $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor White
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.Value__)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Done!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
