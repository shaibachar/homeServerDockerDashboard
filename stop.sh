#!/bin/bash
set -e

echo "🛑 Stopping homeServerDockerDashboard..."
docker-compose down
echo "✅ Stopped."
