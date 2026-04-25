export default function PinnedSection({ pinnedNodes, onTogglePin, onLinkOpen }) {
  if (pinnedNodes.length === 0) return null;

  return (
    <div className="pinned-section">
      <div className="pinned-header">⭐ お気に入り</div>
      <div className="pinned-list">
        {pinnedNodes.map((node) => (
          <div key={node.id} className="pinned-item">
            <div
              className="pinned-item-main"
              onClick={() => {
                if (node.type === 'link') {
                  if (onLinkOpen) onLinkOpen(node);
                  else window.open(node.url, '_blank', 'noopener,noreferrer');
                }
              }}
              style={{ cursor: node.type === 'link' ? 'pointer' : 'default' }}
            >
              <span>{node.icon || (node.type === 'folder' ? '📁' : '🔗')}</span>
              <span className="pinned-item-name">{node.name}</span>
            </div>
            <button
              className="pin-btn pinned"
              onClick={() => onTogglePin(node.id)}
              title="お気に入り解除"
            >⭐</button>
          </div>
        ))}
      </div>
    </div>
  );
}
