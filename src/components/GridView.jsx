import { useState, useRef } from 'react';

const FOLDER_THEMES = [
  { bg: '#e8f0fe', icon: '#1a73e8' },
  { bg: '#e6f4ea', icon: '#34a853' },
  { bg: '#fce8e6', icon: '#ea4335' },
  { bg: '#fef7e0', icon: '#f29900' },
  { bg: '#f3e8fd', icon: '#a142f4' },
  { bg: '#e6f3fb', icon: '#039be5' },
];

const LINK_THEME = { bg: '#e6f4ea', icon: '#34a853' };
const DEFAULT_FOLDER_COLORS = ['#e8f0fe','#e6f4ea','#fce8e6','#fef7e0','#f3e8fd','#e6f3fb'];

function getTheme(node, index) {
  if (node.type !== 'folder') return LINK_THEME;
  if (node.color) return { bg: node.color, icon: '#555' };
  return FOLDER_THEMES[index % FOLDER_THEMES.length];
}

export default function GridView({
  tree, path, onPathChange,
  onAddFolder, onAddLink, onEdit, onDelete, onMove, onDragMove, onReorder, onTogglePin,
  selectionMode = false, selectedIds = new Set(), onToggleSelection,
  onLinkOpen,
}) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuFlip, setMenuFlip] = useState(false); // true = right寄せ
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dropPosition, setDropPosition] = useState('before'); // 'before'|'after'|'inside'
  const dragNodeRef = useRef(null);

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
    if (selectionMode) { onToggleSelection(node.id); return; }
    if (menuOpen) { setMenuOpen(null); return; }
    if (node.type === 'folder') {
      onPathChange([...path, { id: node.id, name: node.name }]);
    } else {
      if (onLinkOpen) onLinkOpen(node);
      else window.open(node.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBreadcrumb = (index) => onPathChange(path.slice(0, index));

  // ===== ドラッグ&ドロップ（並び替え＋フォルダ移動）=====
  const handleDragStart = (e, node) => {
    if (selectionMode) { e.preventDefault(); return; }
    e.dataTransfer.setData('dragNodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(node.id);
    dragNodeRef.current = node;
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, node) => {
    if (selectionMode) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;

    if (node.type === 'folder' && x > w * 0.25 && x < w * 0.75) {
      setDropPosition('inside');
    } else {
      setDropPosition(x < w / 2 ? 'before' : 'after');
    }
    setDragOverId(node.id);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = () => setDragOverId(null);

  const handleDrop = (e, node) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('dragNodeId');
    setDragOverId(null);
    setDraggingId(null);
    if (!fromId || fromId === node.id) return;

    if (node.type === 'folder' && dropPosition === 'inside') {
      onDragMove(fromId, node.id);
    } else {
      onReorder(fromId, node.id, dropPosition);
    }
  };

  // 全選択
  const allSelected = currentItems.length > 0 && currentItems.every(n => selectedIds.has(n.id));
  const handleSelectAll = () => {
    if (allSelected) currentItems.forEach(n => onToggleSelection(n.id));
    else currentItems.filter(n => !selectedIds.has(n.id)).forEach(n => onToggleSelection(n.id));
  };

  return (
    <div className="grid-view">
      <div className="breadcrumb">
        <button className="breadcrumb-item root" onClick={() => onPathChange([])}>🏠 ホーム</button>
        {path.map((p, i) => (
          <span key={p.id} className="breadcrumb-sep-wrap">
            <span className="breadcrumb-sep">›</span>
            <button className="breadcrumb-item" onClick={() => handleBreadcrumb(i + 1)}>{p.name}</button>
          </span>
        ))}
        {!selectionMode && path.length > 0 && <span className="breadcrumb-hint">← ここに追加されます</span>}
        {selectionMode && currentItems.length > 0 && (
          <button className="breadcrumb-select-all" onClick={handleSelectAll}>
            {allSelected ? '✅ 全解除' : '☑ 全選択'}
          </button>
        )}
      </div>

      <div className="icon-grid">
        {currentItems.length === 0 && (
          <div className="grid-empty">
            <p>📭 まだ何もありません</p>
            <p>上のボタンから追加してください</p>
          </div>
        )}
        {currentItems.map((node, i) => {
          const theme = getTheme(node, i);
          const isDragging = draggingId === node.id;
          const isOver = dragOverId === node.id;
          const isSelected = selectedIds.has(node.id);

          return (
            <div
              key={node.id}
              className={`icon-item ${isOver && dropPosition === 'before' ? 'drop-before' : ''} ${isOver && dropPosition === 'after' ? 'drop-after' : ''}`}
            >
              <div
                className={`icon-card ${isDragging ? 'dragging' : ''} ${isOver && dropPosition === 'inside' ? 'drag-over' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ background: isSelected ? '#c8e6c9' : theme.bg }}
                onClick={() => handleItemClick(node)}
                draggable={!selectionMode}
                onDragStart={(e) => handleDragStart(e, node)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, node)}
              >
                {selectionMode ? (
                  <span className="icon-checkbox">{isSelected ? '✅' : '⬜'}</span>
                ) : null}
                <span className="icon-emoji" style={{ opacity: selectionMode ? 0.5 : 1 }}>
                  {node.icon || (node.type === 'folder' ? '📁' : '🔗')}
                </span>
                {!selectionMode && node.type === 'folder' && node.children?.length > 0 && (
                  <span className="icon-badge">{node.children.length}</span>
                )}
              </div>
              <div className="icon-label-wrap">
                <span className="icon-label">{node.name}</span>
                {node.memo && <span className="icon-memo" title={node.memo}>{node.memo}</span>}
              </div>

              {!selectionMode && (
                <>
                  <button
                    className={`icon-pin-btn ${node.pinned ? 'pinned' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(node.id); }}
                    title={node.pinned ? 'お気に入り解除' : 'お気に入り追加'}
                  >{node.pinned ? '⭐' : '☆'}</button>
                  <button
                    className="icon-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (menuOpen === node.id) { setMenuOpen(null); return; }
                      // 画面左端からの距離が200px未満なら右寄せ
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuFlip(rect.left < 200);
                      setMenuOpen(node.id);
                    }}
                  >⋮</button>
                  {menuOpen === node.id && (
                    <div className={`icon-context-menu ${menuFlip ? 'flip-right' : ''}`} onMouseLeave={() => setMenuOpen(null)}>
                      {node.type === 'folder' && (
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
