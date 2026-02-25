const express = require('express');
const cors = require('cors');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8020;

app.use(cors());
app.use(express.json());

function resolveMetadataPath() {
  if (process.env.PROJECTS_JSON) return process.env.PROJECTS_JSON;

  const mountedPath = '/projects.json';
  if (fs.existsSync(mountedPath)) return mountedPath;

  return path.join(__dirname, '..', 'projects.json');
}

const metadataPath = resolveMetadataPath();

// Serve project images from resources directory
const resourcesPath = process.env.RESOURCES_PATH || (fs.existsSync('/resources') ? '/resources' : path.join(__dirname, '..', 'resources'));
app.use('/resources', express.static(resourcesPath));

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error reading ${filePath}:`, err.message);
    }
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeMetadataEntry(entry = {}) {
  const containerName = typeof entry.containerName === 'string' ? entry.containerName.trim() : '';
  if (!containerName) return null;

  const tags = Array.isArray(entry.tags)
    ? entry.tags.map(tag => String(tag).trim()).filter(Boolean)
    : typeof entry.tags === 'string'
      ? entry.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      : [];

  const defaultPort = entry.defaultPort === '' || entry.defaultPort == null
    ? null
    : Number.isFinite(Number(entry.defaultPort))
      ? Number(entry.defaultPort)
      : null;

  return {
    id: entry.id || containerName,
    containerName,
    name: entry.name ? String(entry.name).trim() : '',
    description: entry.description ? String(entry.description).trim() : '',
    image: entry.image ? String(entry.image).trim() : '',
    tags,
    defaultPort,
    hidden: Boolean(entry.hidden)
  };
}

function loadMetadata() {
  const data = readJsonFile(metadataPath, []);
  const list = Array.isArray(data) ? data : [];
  return list.map(normalizeMetadataEntry).filter(Boolean);
}

function saveMetadata(entries) {
  const normalized = entries
    .map(normalizeMetadataEntry)
    .filter(Boolean)
    .sort((a, b) => a.containerName.localeCompare(b.containerName));
  writeJsonFile(metadataPath, normalized);
  return normalized;
}

function upsertMetadataEntry(input, { forceHidden } = {}) {
  const nextEntry = normalizeMetadataEntry(input);
  if (!nextEntry) {
    return { error: 'containerName is required' };
  }

  if (typeof forceHidden === 'boolean') {
    nextEntry.hidden = forceHidden;
  }

  const entries = loadMetadata();
  const existingIndex = entries.findIndex(e => e.containerName === nextEntry.containerName);
  const merged = existingIndex >= 0 ? { ...entries[existingIndex], ...nextEntry } : nextEntry;
  if (typeof forceHidden === 'boolean') merged.hidden = forceHidden;

  if (existingIndex >= 0) entries[existingIndex] = merged;
  else entries.push(merged);

  saveMetadata(entries);
  return { entry: merged };
}

// Get Docker container info from `docker ps` equivalent (running containers only)
async function getRunningContainers() {
  const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

  try {
    const containers = await docker.listContainers({ all: false });
    return containers.map(container => {
      const names = (container.Names || []).map(n => n.replace(/^\//, ''));
      const primaryName = names[0] || container.Id.substring(0, 12);
      const ports = (container.Ports || [])
        .map(p => ({
          privatePort: p.PrivatePort,
          publicPort: p.PublicPort,
          type: p.Type,
          ip: p.IP
        }))
        .filter(p => p.publicPort);

      return {
        id: container.Id.substring(0, 12),
        containerId: container.Id,
        containerName: primaryName,
        aliases: names,
        imageName: container.Image,
        containerStatus: container.State || 'unknown',
        containerStatusText: container.Status || 'unknown',
        ports
      };
    });
  } catch (err) {
    console.error('Docker connection error:', err.message);
    return [];
  }
}

function getRequestBase(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol || 'http';

  const forwardedHost = req.get('x-forwarded-host');
  const rawHost = (forwardedHost ? forwardedHost.split(',')[0].trim() : req.get('host') || '').trim();
  const hostWithoutPort = rawHost.replace(/:\d+$/, '');

  return {
    protocol,
    host: hostWithoutPort || process.env.HOST_IP || 'localhost'
  };
}

function buildCard(container, metadata, base) {
  const firstPort = container.ports[0];
  const port = firstPort?.publicPort || metadata?.defaultPort || null;
  const host = base?.host || process.env.HOST_IP || 'localhost';
  const protocol = base?.protocol || 'http';

  return {
    id: metadata?.id || container.containerName,
    containerName: container.containerName,
    aliases: container.aliases,
    name: metadata?.name || container.containerName,
    description: metadata?.description || '',
    image: metadata?.image || '',
    tags: metadata?.tags || [],
    hidden: Boolean(metadata?.hidden),
    defaultPort: metadata?.defaultPort ?? null,
    containerStatus: container.containerStatus,
    containerStatusText: container.containerStatusText,
    imageName: container.imageName,
    livePort: port,
    liveIp: host,
    url: port ? `${protocol}://${host}:${port}` : null,
    ports: container.ports
  };
}

async function getMergedCards({ includeHidden = false, req } = {}) {
  const [containers, metadataEntries] = await Promise.all([
    getRunningContainers(),
    Promise.resolve(loadMetadata())
  ]);

  const metadataByContainer = new Map(metadataEntries.map(entry => [entry.containerName, entry]));
  const base = req ? getRequestBase(req) : null;
  const cards = containers.map(container => buildCard(container, metadataByContainer.get(container.containerName), base));

  return includeHidden ? cards : cards.filter(card => !card.hidden);
}

// Public portal cards (docker-driven, metadata-enhanced)
app.get('/api/projects', async (req, res) => {
  const cards = await getMergedCards({ includeHidden: false, req });
  res.json(cards);
});

// Admin endpoints for management UI
app.get('/api/admin/containers', async (req, res) => {
  const cards = await getMergedCards({ includeHidden: true, req });
  res.json(cards);
});

app.get('/api/admin/projects', (req, res) => {
  res.json(loadMetadata());
});

app.post('/api/admin/projects', (req, res) => {
  const result = upsertMetadataEntry({ ...req.body, hidden: false });
  if (result.error) return res.status(400).json({ error: result.error });
  return res.status(201).json(result.entry);
});

app.put('/api/admin/projects/:containerName', (req, res) => {
  const result = upsertMetadataEntry({
    ...req.body,
    containerName: req.params.containerName
  });

  if (result.error) return res.status(400).json({ error: result.error });
  return res.json(result.entry);
});

// "Remove from portal" is a soft-delete via hidden=true so docker-discovered apps can be restored.
app.delete('/api/admin/projects/:containerName', (req, res) => {
  const existing = loadMetadata().find(e => e.containerName === req.params.containerName) || { containerName: req.params.containerName };
  const result = upsertMetadataEntry(existing, { forceHidden: true });
  if (result.error) return res.status(400).json({ error: result.error });
  return res.json({ ok: true, entry: result.entry });
});

app.post('/api/admin/projects/:containerName/restore', (req, res) => {
  const entries = loadMetadata();
  const existing = entries.find(e => e.containerName === req.params.containerName) || { containerName: req.params.containerName };
  const result = upsertMetadataEntry({ ...existing, hidden: false });
  if (result.error) return res.status(400).json({ error: result.error });
  return res.json(result.entry);
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    metadataPath,
    resourcesPath
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Metadata file: ${metadataPath}`);
  });
}

module.exports = app;
