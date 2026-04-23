import { useState } from 'react';

// フォルダの色テーマ
const FOLDER_THEMES = [
  { bg: '#e8f0fe', icon: '#1a73e8', emoji: '📁' },
  { bg: '#e6f4ea', icon: '#34a853', emoji: '📁' },
  { bg: '#fce8e6', icon: '#ea4335', emoji: '📁' },
  { bg: '#fef7e0', icon: '#f29900', emoji: '📁' },
  { bg: '#f3e8fd', icon: '#a142f4', emoji: '📁' },
  { bg: '#e6f3fb', icon: '#039be5', emoji: '📁' },
];

const LINK_THEME = { bg: '#e6f4ea', icon: '#34a853', emoji: '🔗' };

function getTheme(index) {
  return FOLDER_THEMES[index % FOLDER_THEMES.length];
}

export default function GridView({ tree, onAddFolder, onAddLink, onEdit, onDelete, onMove }) {
  // パス: [{ id, name }] のスタック
  const [path, setPath] = useState([]);

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
    if (node.type === 'folder') {
      setPath([...path, { id: node.id, name: node.name }]);
    } else {
      window.open(node.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleBreadcrumb = (index) => {
    setPath(path.slice(0, index));
  };

  const [menuOpen, setMenuOpen] = useState(null);

  return (
    <div className="grid-view">
      {/* パンくずリスト */}
      <div className="breadcrumb">
        <button className="breadcrumb-item root" onClick={() => setPath([])}>
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
          return (
            <div key={node.id} className="icon-item">
              <div
                className="icon-card"
                style={{ background: theme.bg }}
                onClick={() => handleItemClick(node)}
                onContextMenu={(e) => { e.preventDefault(); setMenuOpen(menuOpen === node.id ? null : node.id); }}
              >
                <span className="icon-emoji">{theme.emoji}</span>
                {isFolder && node.children?.length > 0 && (
                  <span className="icon-badge">{node.children.length}</span>
                )}
              </div>
              <span className="icon-label">{node.name}</span>

              {/* 長押し or 右クリックメニュー */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
