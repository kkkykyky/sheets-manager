import { useState } from 'react';

const FOLDER_THEMES = [
  { bg: '#e8f0fe', icon: '#1a73e8' },
  { bg: '#e6f4ea', icon: '#34a853' },
  { bg: '#fce8e6', icon: '#ea4335' },
  { bg: '#fef7e0', icon: '#f29900' },
  { bg: '#f3e8fd', icon: '#a142f4' },
  { bg: '#e6f3fb', icon: '#039be5' },
];

const LINK_THEME = { bg: '#e6f4ea', icon: '#34a853' };

function getTheme(index) {
  return FOLDER_THEMES[index % FOLDER_THEMES.length];
}

export default function GridView({
  tree, path, onPathChange,
  onAddFolder, onAddLink, onEdit, onDelete, onMove, onDragMove, onTogglePin,
  selectionMode = false, selectedIds = new Set(), onToggleSelection
}) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // 現在のフォルダの中身を取得
  const getCurrentItems = () => {
    if (path.length === 0) return tree;
    let items = tree;
    for (const step of path) {
      const folder = items.find(n => n.id === step.id);
      if (!folder) return [];
      items = folder.children || [];
    }
    return items;
  };

  const currentItems = getCurrentItems();

  const handleItemClick = (node) => {
    if (selectionMode) {
      onToggleSelection(node.id);
      return;
    }
    if (menuOpen) { setMenuOpen(null); return; }
    if (node.type === 'folder') {
      onPathChange([...path, { id: node.id, name: node.name }]);
    } else {
      window.open(node.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBreadcrumb = (index) => {
    onPathChange(path.slice(0, index));
  };

  // ===== ドラッグ&ドロップ =====
  const handleDragStart = (e, node) => {
    if (selectionMode) { e.preventDefault(); return; }
    e.dataTransfer.setData('dragNodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(node.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e, node) => {
    if (selectionMode || node.type !== 'folder') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(node.id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e, node) => {
    e.preventDefault();
    setDragOverId(null);
    setDraggingId(null);
    if (node.type !== 'folder') return;
    const draggedId = e.dataTransfer.getData('dragNodeId');
    if (draggedId && draggedId !== node.id) {
      onDragMove(draggedId, node.id);
    }
  };

  // 全選択トグル
  const allSelected = currentItems.length > 0 && currentItems.every(n => selectedIds.has(n.id));
  const handleSelectAll = () => {
    if (allSelected) {
      currentItems.forEach(n => onToggleSelection(n.id));
    } else {
      currentItems.filter(n => !selectedIds.has(n.id)).forEach(n => onToggleSelection(n.id));
    }
  };

  return (
    <div className="grid-view">
      {/* パンくずリスト */}
      <div className="breadcrumb">
        <button className="breadcrumb-item root" onClick={() => onPathChange([])}>
          🏠 ホーム
        </button>
        {path.map((p, i) => (
          <span key={p.id} className="breadcrumb-sep-wrap">
            <span className="breadcrumb-sep">›</span>
            <button
              className="breadcrumb-item"
              onClick={() => handleBreadcrumb(i + 1)}
            >
              {p.name}
            </button>
          </span>
        ))}
        {!selectionMode && path.length > 0 && (
          <span className="breadcrumb-hint">← ここに追加されます</span>
        )}
        {selectionMode && currentItems.length > 0 && (
          <button className="breadcrumb-select-all" onClick={handleSelectAll}>
            {allSelected ? '✅ 全解除' : '☑ 全選択'}
          </button>
        )}
      </div>

      {/* アイコングリッド */}
      <div className="icon-grid">
        {currentItems.length === 0 && (
          <div className="grid-empty">
            <p>📭 まだ何もありません</p>
            <p>上のボタンから追加してください</p>
          </div>
        )}
        {currentItems.map((node, i) => {
          const isFolder = node.type === 'folder';
          const theme = isFolder ? getTheme(i) : LINK_THEME;
          const isDragging = draggingId === node.id;
          const isDragOver = dragOverId === node.id;
          const isSelected = selectedIds.has(node.id);

          return (
            <div key={node.id} className="icon-item">
              <div
                className={`icon-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ background: isSelected ? '#c8e6c9' : theme.bg }}
                onClick={() => handleItemClick(node)}
                draggable={!selectionMode}
                onDragStart={(e) => handleDragStart(e, node)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
              >
                {selectionMode && (
                  <span className="icon-checkbox">
                    {isSelected ? '✅' : '⬜'}
                  </span>
                )}
                {!selectionMode && (
                  <>
                    <span className="icon-emoji">
                      {isFolder ? '📁' : '🔗'}
                    </span>
                    {isFolder && node.children?.length > 0 && (
                      <span className="icon-badge">{node.children.length}</span>
                    )}
                  </>
                )}
                {selectionMode && (
                  <span className="icon-emoji" style={{ opacity: 0.5 }}>
                    {isFolder ? '📁' : '🔗'}
                  </span>
                )}
              </div>
              <span className="icon-label">{node.name}</span>

              {!selectionMode && (
                <>
                  <button
                    className={`icon-pin-btn ${node.pinned ? 'pinned' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(node.id); }}
                    title={node.pinned ? 'お気に入り解除' : 'お気に入り追加'}
                  >{node.pinned ? '⭐' : '☆'}</button>

                  <button
                    className="icon-menu-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === node.id ? null : node.id); }}
                  >⋮</button>

                  {menuOpen === node.id && (
                    <div className="icon-context-menu" onMouseLeave={() => setMenuOpen(null)}>
                      {isFolder && (
                        <>
                          <button onClick={() => { setMenuOpen(null); onAddFolder(node.id); }}>📁 フォルダを追加</button>
                          <button onClick={() => { setMenuOpen(null); onAddLink(node.id); }}>🔗 リンクを追加</button>
                          <hr />
                        </>
                      )}
                      <button onClick={() => { setMenuOpen(null); onEdit(node); }}>✏️ 編集</button>
                      <button onClick={() => { setMenuOpen(null); onMove(node); }}>📦 移動先を選ぶ</button>
                      <button className="danger" onClick={() => { setMenuOpen(null); onDelete(node.id, node.name); }}>🗑️ 削除</button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
