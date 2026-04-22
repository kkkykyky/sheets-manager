import { useState } from 'react';

export default function TreeNode({ node, onAddFolder, onAddLink, onEdit, onDelete, onMove, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const isFolder = node.type === 'folder';

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

  return (
    <div className="tree-node" style={{ paddingLeft: depth * 16 + 'px' }}>
      <div className={`tree-row ${isFolder ? 'folder' : 'link'}`} onClick={handleClick}>
        <span className="tree-icon">
          {isFolder ? (open ? '📂' : '📁') : '📄'}
        </span>
        <span className="tree-label">{node.name}</span>
        <div className="tree-menu-wrap">
          <button
            className="menu-btn"
            onClick={handleMenuToggle}
            title="メニュー"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="context-menu" onMouseLeave={() => setMenuOpen(false)}>
              {isFolder && (
                <>
                  <button onClick={(e) => handleMenuAction(e, () => onAddFolder(node.id))}>📁 フォルダを追加</button>
                  <button onClick={(e) => handleMenuAction(e, () => onAddLink(node.id))}>📄 リンクを追加</button>
                  <hr />
                </>
              )}
              <button onClick={(e) => handleMenuAction(e, () => onEdit(node))}>✏️ 編集</button>
              <button onClick={(e) => handleMenuAction(e, () => onMove(node))}>📦 移動</button>
              <button className="danger" onClick={(e) => handleMenuAction(e, () => onDelete(node.id, node.name))}>🗑️ 削除</button>
            </div>
          )}
        </div>
      </div>

      {isFolder && open && node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onAddFolder={onAddFolder}
              onAddLink={onAddLink}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {isFolder && open && node.children && node.children.length === 0 && (
        <div className="tree-empty" style={{ paddingLeft: (depth + 1) * 16 + 'px' }}>
          空のフォルダ
        </div>
      )}
    </div>
  );
}
