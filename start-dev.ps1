# Start AI Service
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ai-service; Write-Host 'Starting AI Service on port 8001...'; pip install -r requirements.txt; python main.py"

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; Write-Host 'Starting Backend on port 8000...'; npm install; npm run dev"

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host 'Starting Frontend on port 5173...'; npm install; npm run dev"

Write-Host "All services are starting in separate windows..."
