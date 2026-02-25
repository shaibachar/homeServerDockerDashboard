# homeServerDockerDashboard

A portal dashboard that exposes links and details for all your Docker projects. IPs and ports are read live from the Docker daemon; project details and images come from `projects.json` and the `resources/` folder.

## Stack

- **Backend**: Node.js + Express + Dockerode
- **Frontend**: React.js
- **Infrastructure**: Docker + docker-compose
- **Scripts**: Bash

## Quick Start

```bash
# Build and start everything
./start.sh

# Frontend: http://<HOST_IP>:8021
# Backend API: http://<HOST_IP>:8020/api/projects

# Stop
./stop.sh
```

## Project Structure

```
.
├── backend/          # Express API — reads Docker socket + projects.json
├── frontend/         # React dashboard UI
├── resources/        # Project images (PNG/JPG/SVG/WEBP)
├── projects.json     # Project metadata (name, description, containerName, port, image, tags)
├── docker-compose.yml
├── start.sh
└── stop.sh
```

## Adding a Project

1. Add an entry to `projects.json`:
```json
{
  "id": "myapp",
  "name": "My App",
  "description": "My awesome service",
  "containerName": "myapp",
  "defaultPort": 8080,
  "image": "myapp.png",
  "tags": ["web"]
}
```
2. Place `myapp.png` in `resources/`
3. Restart with `./start.sh`

## Development

```bash
# Backend
cd backend && npm install && npm start   # http://localhost:8020

# Frontend
cd frontend && npm install && npm start  # http://localhost:8021
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/projects` | All projects enriched with live Docker container status/ports |
| `GET /api/health` | Health check |
| `GET /resources/:image` | Serve project images |
