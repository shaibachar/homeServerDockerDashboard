import React from 'react';
import './ProjectCard.css';

function ProjectCard({ project, apiBase }) {
  const {
    name,
    description,
    image,
    url,
    containerStatus,
    containerStatusText,
    tags = []
  } = project;

  const isRunning = containerStatus === 'running';
  const imageUrl = image ? `${apiBase}/resources/${image}` : null;

  return (
    <div className={`project-card ${isRunning ? 'running' : 'stopped'}`}>
      <div className="card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={name} onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <div className="card-image-placeholder">🐳</div>
        )}
      </div>
      <div className="card-body">
        <div className="card-header">
          <h2>{name}</h2>
          <span className={`status-badge ${isRunning ? 'running' : 'stopped'}`}>
            {isRunning ? '● Running' : '○ Stopped'}
          </span>
        </div>
        {description && <p className="description">{description}</p>}
        {containerStatusText && containerStatusText !== 'Not running' && (
          <p className="container-status">{containerStatusText}</p>
        )}
        {tags.length > 0 && (
          <div className="tags">
            {tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        )}
        <div className="card-actions">
          {url && isRunning ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              Open ↗
            </a>
          ) : (
            <span className="btn btn-disabled">Not Available</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectCard;
