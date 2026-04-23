export default function SearchResults({ results, onTogglePin }) {
  if (results.length === 0) {
    return (
      <div className="search-empty">
        <p>🔍 該当なし</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      {results.map(({ node, path }) => (
        <div key={node.id} className="search-item">
          <div
            className="search-item-main"
            onClick={() => {
              if (node.type === 'link') window.open(node.url, '_blank', 'noopener,noreferrer');
            }}
            style={{ cursor: node.type === 'link' ? 'pointer' : 'default' }}
          >
            <span className="search-item-icon">{node.type === 'folder' ? '📁' : '🔗'}</span>
            <div className="search-item-info">
              <span className="search-item-name">{node.name}</span>
              {path.length > 0 && (
                <span className="search-item-path">{path.join(' › ')}</span>
              )}
            </div>
          </div>
          <button
            className={`pin-btn ${node.pinned ? 'pinned' : ''}`}
            onClick={() => onTogglePin(node.id)}
            title={node.pinned ? 'お気に入り解除' : 'お気に入り追加'}
          >
            {node.pinned ? '⭐' : '☆'}
          </button>
        </div>
      ))}
    </div>
  );
}
