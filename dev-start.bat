@echo off
echo 🚀 Starting Development Environment with Docker...

echo 📦 Building and starting services...
docker-compose -f docker-compose.dev.yml up --build

echo.
echo ✅ Development environment is ready!
echo 📱 Frontend: http://localhost:5173
echo 🔧 Backend: http://localhost:3001
echo.
echo Press Ctrl+C to stop all services
