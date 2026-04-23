import { useState } from 'react';

// 深さに応じたフォルダの色
const FOLDER_COLORS = ['#1a73e8', '#34a853', '#f29900', '#e37400', '#a142f4'];
const getFolderIcon = (depth, open) => open ? '📂' : '📁';

export default function TreeNode({
  node, onAddFolder, onAddLink, onEdit, onDelete, onMove, onDragMove,
  depth = 0, isLast = false
}) {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isFolder = node.type === 'folder';
  const hasChildren = isFolder && node.children && node.children.length > 0;

  const handleClick = () => {
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
    e.stopPropagation();
    e.dataTransfer.setData('dragNodeId', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => setIsDragging(false);

  const handleDragOver = (e) => {
    if (!isFolder) return;
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
          className={`tree-row ${isFolder ? 'folder' : 'link'} ${dragOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
          onClick={handleClick}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="drag-handle" title="ドラッグして移動">⠿</span>

          <span className="node-icon">
            {isFolder
              ? getFolderIcon(depth, open)
              : '🔗'}
          </span>

          <span className="tree-label">{node.name}</span>

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
                depth={depth + 1}
                isLast={i === node.children.length - 1}
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
