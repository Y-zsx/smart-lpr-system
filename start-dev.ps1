# Basic dependency checks
$missing = @()
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $missing += "npm" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $missing += "python" }
if ($missing.Count -gt 0) {
    Write-Error "Missing required tools: $($missing -join ', '). Please install them first."
    exit 1
}

# Start AI Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ai-service; Write-Host 'Starting AI Service on port 8001...'; pip install -r requirements.txt; python -m app.main"

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; Write-Host 'Starting Backend on port 8000...'; npm install; npm run dev"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host 'Starting Frontend on port 5173...'; npm install; npm run dev"

Write-Host "All services are starting in separate windows..."
