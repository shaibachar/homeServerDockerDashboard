import React, { useEffect, useState } from 'react';
import ProjectCard from './components/ProjectCard';
import './App.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/projects`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
      })
      .then(data => {
        setProjects(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🐳 Home Server Dashboard</h1>
        <p>Docker Projects Portal</p>
      </header>
      <main className="App-main">
        {loading && <div className="loading">Loading projects...</div>}
        {error && <div className="error">⚠️ {error}</div>}
        {!loading && !error && projects.length === 0 && (
          <div className="empty">No projects configured yet.</div>
        )}
        <div className="projects-grid">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} apiBase={API_BASE} />
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
