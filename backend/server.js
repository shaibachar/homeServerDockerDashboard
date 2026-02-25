const express = require('express');
const cors = require('cors');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve project images from resources directory
const resourcesPath = process.env.RESOURCES_PATH || path.join(__dirname, '..', 'resources');
app.use('/resources', express.static(resourcesPath));

// Load projects configuration
function loadProjects() {
  const projectsPath = process.env.PROJECTS_JSON || path.join(__dirname, '..', 'projects.json');
  try {
    const data = fs.readFileSync(projectsPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading projects.json:', err.message);
    return [];
  }
}

// Get Docker container info
async function getContainerInfo() {
  const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
  try {
    const containers = await docker.listContainers({ all: false });
    const containerMap = {};
    containers.forEach(container => {
      const names = container.Names.map(n => n.replace(/^\//, ''));
      const ports = container.Ports || [];
      names.forEach(name => {
        containerMap[name] = {
          id: container.Id.substring(0, 12),
          image: container.Image,
          status: container.Status,
          state: container.State,
          ports: ports.map(p => ({
            privatePort: p.PrivatePort,
            publicPort: p.PublicPort,
            type: p.Type,
            ip: p.IP
          })).filter(p => p.publicPort)
        };
      });
    });
    return containerMap;
  } catch (err) {
    console.error('Docker connection error:', err.message);
    return {};
  }
}

// GET /api/projects - returns projects enriched with live Docker data
app.get('/api/projects', async (req, res) => {
  const projects = loadProjects();
  const containerInfo = await getContainerInfo();

  const enriched = projects.map(project => {
    const container = containerInfo[project.containerName] || {};
    const port = container.ports && container.ports.length > 0
      ? container.ports[0].publicPort
      : project.defaultPort;
    const ip = (container.ports && container.ports.length > 0 && container.ports[0].ip && container.ports[0].ip !== '0.0.0.0')
      ? container.ports[0].ip
      : process.env.HOST_IP || 'localhost';

    return {
      ...project,
      containerStatus: container.state || 'unknown',
      containerStatusText: container.status || 'Not running',
      url: port ? `http://${ip}:${port}` : null,
      livePort: port || null,
      liveIp: ip
    };
  });

  res.json(enriched);
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

module.exports = app;
