# Test login script for LIMS
Write-Host "Testing LIMS Login..." -ForegroundColor Cyan

# Test backend health
Write-Host "`nChecking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
    Write-Host "✓ Backend is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend health check failed: $_" -ForegroundColor Red
    exit 1
}

# Test login
Write-Host "`nTesting login with admin credentials..." -ForegroundColor Yellow
$body = @{
    username = "sslork"
    password = "sslork634827@@##"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/auth/login" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Login successful!" -ForegroundColor Green
    Write-Host "  Access Token: $($response.access_token.Substring(0,50))..." -ForegroundColor Gray
    Write-Host "  Token Type: $($response.token_type)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    Write-Host "  Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All tests passed! You can now login at http://localhost:3000" -ForegroundColor Green
Write-Host "  Username: sslork" -ForegroundColor Cyan
Write-Host "  Password: sslork634827@@##" -ForegroundColor Cyan
