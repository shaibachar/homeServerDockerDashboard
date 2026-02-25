#!/bin/bash
set -e

echo "🐳 Starting homeServerDockerDashboard..."

# Auto-detect the host IP
export HOST_IP=$(hostname -I | awk '{print $1}')
echo "Host IP detected: $HOST_IP"

# Build and start the services
docker-compose up --build -d

echo ""
echo "✅ Dashboard is running!"
echo "   Frontend: http://$HOST_IP:8021"
echo "   Backend API: http://$HOST_IP:8020/api/projects"
