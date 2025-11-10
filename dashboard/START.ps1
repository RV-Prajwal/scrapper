# ============================================
# Lead Scraper Dashboard - Startup Script
# ============================================

# Get the directory where this script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Display header
Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   📊 Lead Scraper Dashboard v2.0 - Startup Script         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if node is installed
Write-Host "🔍 Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
Write-Host "🔍 Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found!" -ForegroundColor Red
    exit 1
}

# Check if dependencies are installed
Write-Host "`n🔍 Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$scriptDir\node_modules")) {
    Write-Host "⚠️  Dependencies not installed. Installing now..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Get port configuration
Write-Host "`n🔌 Port Configuration" -ForegroundColor Yellow
$defaultPort = 5000
$port = Read-Host "Enter port number (default: $defaultPort)"
if ([string]::IsNullOrWhiteSpace($port)) {
    $port = $defaultPort
}

# Validate port is a number
if ($port -notmatch '^\d+$') {
    Write-Host "❌ Invalid port number" -ForegroundColor Red
    exit 1
}

# Display startup information
Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    STARTING DASHBOARD                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dashboard URL: http://localhost:$port" -ForegroundColor Cyan
Write-Host "📁 Data Directory: $(Join-Path (Split-Path -Parent $scriptDir) 'exports')" -ForegroundColor Cyan
Write-Host "📄 Configuration:" -ForegroundColor Cyan
Write-Host "   - Node.js: $nodeVersion" -ForegroundColor Gray
Write-Host "   - npm: v$npmVersion" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   - Open browser to: http://localhost:$port" -ForegroundColor Gray
Write-Host "   - Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host "   - Check README.md for full documentation" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Server is starting..." -ForegroundColor Green
Write-Host ""

# Start the server
$env:PORT = $port
npm start

# If script reaches here, server was stopped
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║              Dashboard Server Stopped                      ║" -ForegroundColor Yellow
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
Write-Host ""
