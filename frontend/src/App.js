import React, { useEffect, useState } from 'react';
import ProjectCard from './components/ProjectCard';
import './App.css';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

const emptyDraft = {
  containerName: '',
  name: '',
  description: '',
  image: '',
  tags: '',
  defaultPort: ''
};

function toDraft(card) {
  return {
    containerName: card.containerName || '',
    name: card.name || '',
    description: card.description || '',
    image: card.image || '',
    tags: Array.isArray(card.tags) ? card.tags.join(', ') : '',
    defaultPort: card.defaultPort ?? ''
  };
}

function App() {
  const [projects, setProjects] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingName, setSavingName] = useState('');
  const [drafts, setDrafts] = useState({});
  const [showAdmin, setShowAdmin] = useState(false);

  const loadData = async () => {
    setError(null);
    try {
      const [projectsRes, adminRes] = await Promise.all([
        fetch(`${API_BASE}/api/projects`),
        fetch(`${API_BASE}/api/admin/containers`)
      ]);

      if (!projectsRes.ok) throw new Error('Failed to fetch portal cards');
      if (!adminRes.ok) throw new Error('Failed to fetch container catalog');

      const [projectsData, adminData] = await Promise.all([projectsRes.json(), adminRes.json()]);
      setProjects(projectsData);
      setCatalog(adminData);
      setDrafts(prev => {
        const next = { ...prev };
        adminData.forEach(card => {
          if (!next[card.containerName]) next[card.containerName] = toDraft(card);
        });
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateDraft = (containerName, field, value) => {
    setDrafts(prev => ({
      ...prev,
      [containerName]: {
        ...(prev[containerName] || { ...emptyDraft, containerName }),
        [field]: value
      }
    }));
  };

  const saveCard = async containerName => {
    const draft = drafts[containerName];
    if (!draft?.containerName) return;

    setSavingName(containerName);
    try {
      const payload = {
        ...draft,
        defaultPort: draft.defaultPort === '' ? null : Number(draft.defaultPort)
      };
      const res = await fetch(`${API_BASE}/api/admin/projects/${encodeURIComponent(containerName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save card');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName('');
    }
  };

  const removeCard = async containerName => {
    setSavingName(containerName);
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${encodeURIComponent(containerName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove card');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName('');
    }
  };

  const restoreCard = async containerName => {
    setSavingName(containerName);
    try {
      const res = await fetch(`${API_BASE}/api/admin/projects/${encodeURIComponent(containerName)}/restore`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to restore card');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingName('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Home Server Dashboard</h1>
        <p>Docker-backed application portal</p>
        <button className="btn btn-secondary admin-toggle" onClick={() => setShowAdmin(v => !v)}>
          {showAdmin ? 'Hide Management' : 'Manage Cards'}
        </button>
      </header>

      <main className="App-main">
        {loading && <div className="loading">Loading applications...</div>}
        {error && <div className="error">{error}</div>}

        {!loading && (
          <>
            <section className="portal-section">
              <div className="section-head">
                <h2>Portal</h2>
                <span>{projects.length} visible cards</span>
              </div>
              {projects.length === 0 && !error && (
                <div className="empty">No running containers are currently visible in the portal.</div>
              )}
              <div className="projects-grid">
                {projects.map(project => (
                  <ProjectCard key={project.containerName} project={project} apiBase={API_BASE} />
                ))}
              </div>
            </section>

            {showAdmin && (
              <section className="admin-panel">
                <div className="section-head">
                  <h2>Management</h2>
                  <span>{catalog.length} running containers from docker ps</span>
                </div>

                <div className="admin-grid">
                  {catalog.map(card => {
                    const draft = drafts[card.containerName] || toDraft(card);
                    const busy = savingName === card.containerName;
                    return (
                      <div className={`admin-card ${card.hidden ? 'hidden-card' : ''}`} key={card.containerName}>
                        <div className="admin-card-header">
                          <div>
                            <h3>{card.containerName}</h3>
                            <p>{card.imageName}</p>
                          </div>
                          <span className={`status-pill ${card.containerStatus}`}>
                            {card.hidden ? 'Hidden' : 'Visible'} · {card.containerStatus}
                          </span>
                        </div>

                        <label>
                          Display Name
                          <input
                            value={draft.name}
                            onChange={e => updateDraft(card.containerName, 'name', e.target.value)}
                            placeholder={card.containerName}
                          />
                        </label>

                        <label>
                          Description
                          <textarea
                            value={draft.description}
                            onChange={e => updateDraft(card.containerName, 'description', e.target.value)}
                            rows={2}
                          />
                        </label>

                        <label>
                          Image File (under /resources)
                          <input
                            value={draft.image}
                            onChange={e => updateDraft(card.containerName, 'image', e.target.value)}
                            placeholder="example.png"
                          />
                        </label>

                        <div className="admin-row">
                          <label>
                            Tags (comma separated)
                            <input
                              value={draft.tags}
                              onChange={e => updateDraft(card.containerName, 'tags', e.target.value)}
                              placeholder="monitoring, infra"
                            />
                          </label>

                          <label>
                            Default Port
                            <input
                              type="number"
                              value={draft.defaultPort}
                              onChange={e => updateDraft(card.containerName, 'defaultPort', e.target.value)}
                              placeholder="8080"
                            />
                          </label>
                        </div>

                        <div className="admin-actions">
                          <button className="btn btn-secondary" disabled={busy} onClick={() => saveCard(card.containerName)}>
                            {busy ? 'Saving...' : 'Save'}
                          </button>
                          {card.hidden ? (
                            <button className="btn btn-primary" disabled={busy} onClick={() => restoreCard(card.containerName)}>
                              Restore
                            </button>
                          ) : (
                            <button className="btn btn-danger" disabled={busy} onClick={() => removeCard(card.containerName)}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
