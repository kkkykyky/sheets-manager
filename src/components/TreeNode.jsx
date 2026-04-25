import { useState } from 'react';

const getFolderIcon = (depth, open) => open ? '📂' : '📁';

export default function TreeNode({
  node, onAddFolder, onAddLink, onEdit, onDelete, onMove, onDragMove, onTogglePin,
  depth = 0, isLast = false,
  selectionMode = false, selectedIds = new Set(), onToggleSelection
}) {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;
  const isSelected = selectedIds.has(node.id);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelection(node.id);
      return;
    }
    if (isFolder) setOpen((v) => !v);
    else window.open(node.url, '_blank', 'noopener,noreferrer');
  };

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleMenuAction = (e, action) => {
    e.stopPropagation();
    setMenuOpen(false);
    action();
  };

  // ===== ドラッグ&ドロップ =====
  const handleDragStart = (e) => {
    if (selectionMode) { e.preventDefault(); return; }
    e.stopPropagation();
    e.dataTransfer.setData('dragNodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => setIsDragging(false);

  const handleDragOver = (e) => {
    if (selectionMode || !isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData('dragNodeId');
    if (draggedId && draggedId !== node.id && isFolder) {
      onDragMove(draggedId, node.id);
    }
  };

  return (
    <div className={`tree-node depth-${depth}`}>
      <div className="tree-row-wrap">
        {depth > 0 && (
          <div className="tree-indent">
            {Array.from({ length: depth }).map((_, i) => (
              <div key={i} className="tree-line-v" />
            ))}
          </div>
        )}
        {depth > 0 && <div className={`tree-branch ${isLast ? 'last' : ''}`} />}

        <div
          className={`tree-row ${isFolder ? 'folder' : 'link'} ${dragOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={handleClick}
          draggable={!selectionMode}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {selectionMode ? (
            <span className="tree-checkbox">{isSelected ? '✅' : '⬜'}</span>
          ) : (
            <span className="drag-handle" title="ドラッグして移動">⠿</span>
          )}
          <span className="node-icon">
            {isFolder ? getFolderIcon(depth, open) : '🔗'}
          </span>
          <span className="tree-label">{node.name}</span>

          {!selectionMode && (
            <>
              <button
                className={`pin-btn ${node.pinned ? 'pinned' : ''}`}
                onClick={(e) => { e.stopPropagation(); onTogglePin(node.id); }}
                title={node.pinned ? 'お気に入り解除' : 'お気に入り追加'}
              >{node.pinned ? '⭐' : '☆'}</button>

              <div className="tree-menu-wrap">
                <button className="menu-btn" onClick={handleMenuToggle} title="メニュー">⋮</button>
                {menuOpen && (
                  <div className="context-menu" onMouseLeave={() => setMenuOpen(false)}>
                    {isFolder && (
                      <>
                        <button onClick={(e) => handleMenuAction(e, () => onAddFolder(node.id))}>📁 フォルダを追加</button>
                        <button onClick={(e) => handleMenuAction(e, () => onAddLink(node.id))}>🔗 リンクを追加</button>
                        <hr />
                      </>
                    )}
                    <button onClick={(e) => handleMenuAction(e, () => onEdit(node))}>✏️ 編集</button>
                    <button onClick={(e) => handleMenuAction(e, () => onMove(node))}>📦 移動先を選ぶ</button>
                    <button className="danger" onClick={(e) => handleMenuAction(e, () => onDelete(node.id, node.name))}>🗑️ 削除</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {isFolder && open && (
        <div className="tree-children">
          {hasChildren ? (
            node.children.map((child, i) => (
              <TreeNode
                key={child.id}
                node={child}
                onAddFolder={onAddFolder}
                onAddLink={onAddLink}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onDragMove={onDragMove}
                onTogglePin={onTogglePin}
                depth={depth + 1}
                isLast={i === node.children.length - 1}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelection={onToggleSelection}
              />
            ))
          ) : (
            <div className="tree-empty-row">
              <div className="tree-indent">
                {Array.from({ length: depth + 1 }).map((_, i) => (
                  <div key={i} className="tree-line-v" />
                ))}
              </div>
              <span className="tree-empty">空のフォルダ</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
