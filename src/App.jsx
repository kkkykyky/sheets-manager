import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import { loadData, saveData, genId, removeNode, insertNode, updateNode, defaultData } from './store';
import TreeNode from './components/TreeNode';
import GridView from './components/GridView';
import Modal from './components/Modal';
import SearchResults from './components/SearchResults';
import PinnedSection from './components/PinnedSection';
import DriveImport from './components/DriveImport';
import './App.css';

// ツリー全体を検索して一致するノードとパスを返す
function searchTree(tree, query) {
  const results = [];
  const walk = (nodes, path) => {
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({ node, path: [...path] });
      }
      if (node.children) walk(node.children, [...path, node.name]);
    }
  };
  walk(tree, []);
  return results;
}

// ピン留めされたノードを全て取得
function getPinnedNodes(tree) {
  const results = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.pinned) results.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(tree);
  return results;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState(defaultData);
  const [dataLoading, setDataLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [driveImportOpen, setDriveImportOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [gridPath, setGridPath] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ユーザーが確定したらデータを読み込む
  useEffect(() => {
    if (authLoading || !user) return;
    setDataLoading(true);
    loadData(user.id).then((d) => {
      setData(d);
      setDataLoading(false);
    });
  }, [user, authLoading]);

  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData, user?.id);
  }, [user]);

  const handleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive.readonly',
      },
    });
  };

  const handleDriveImport = (files) => {
    const targetId = (viewMode === 'grid' && gridPath.length > 0)
      ? gridPath[gridPath.length - 1].id : '__root__';

    const newLinks = files.map(f => ({
      id: `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'link',
      name: f.name,
      url: f.webViewLink,
    }));

    let newTree = data.tree;
    if (targetId === '__root__') {
      newTree = [...newTree, ...newLinks];
    } else {
      for (const link of newLinks) {
        newTree = insertNode(newTree, targetId, link);
      }
    }
    persist({ ...data, tree: newTree });
    setDriveImportOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setData(defaultData);
    setGridPath([]);
    setSearchQuery('');
  };

  const handleAddFolder = (parentId) => setModal({ type: 'addFolder', targetId: parentId });
  const handleAddLink = (parentId) => setModal({ type: 'addLink', targetId: parentId });

  const handleAddFolderContextual = () => {
    const targetId = (viewMode === 'grid' && gridPath.length > 0)
      ? gridPath[gridPath.length - 1].id : '__root__';
    handleAddFolder(targetId);
  };
  const handleAddLinkContextual = () => {
    const targetId = (viewMode === 'grid' && gridPath.length > 0)
      ? gridPath[gridPath.length - 1].id : '__root__';
    handleAddLink(targetId);
  };

  const handleEdit = (node) => setModal({ type: node.type === 'folder' ? 'editFolder' : 'editLink', node });
  const handleMove = (node) => setModal({ type: 'move', node });

  const handleDelete = (id, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    persist({ ...data, tree: removeNode(data.tree, id) });
  };

  // お気に入りトグル
  const handleTogglePin = useCallback((id) => {
    const node = (() => {
      const find = (tree) => {
        for (const n of tree) {
          if (n.id === id) return n;
          if (n.children) { const f = find(n.children); if (f) return f; }
        }
      };
      return find(data.tree);
    })();
    if (!node) return;
    persist({ ...data, tree: updateNode(data.tree, id, { pinned: !node.pinned }) });
  }, [data, persist]);

  const handleDragMove = useCallback((fromId, toId) => {
    const find = (tree) => {
      for (const n of tree) {
        if (n.id === fromId) return n;
        if (n.children) { const f = find(n.children); if (f) return f; }
      }
    };
    const node = find(data.tree);
    if (!node) return;
    let newTree = removeNode(data.tree, fromId);
    newTree = insertNode(newTree, toId, node);
    persist({ ...data, tree: newTree });
  }, [data, persist]);

  const handleModalSubmit = (values) => {
    if (!modal) return;
    const { type, targetId, node } = modal;

    if (type === 'addFolder') {
      const newNode = { id: genId(), type: 'folder', name: values.name, children: [] };
      if (targetId === '__root__') persist({ ...data, tree: [...data.tree, newNode] });
      else persist({ ...data, tree: insertNode(data.tree, targetId, newNode) });
    } else if (type === 'addLink') {
      const newNode = { id: genId(), type: 'link', name: values.name, url: values.url };
      if (targetId === '__root__') persist({ ...data, tree: [...data.tree, newNode] });
      else persist({ ...data, tree: insertNode(data.tree, targetId, newNode) });
    } else if (type === 'editFolder') {
      persist({ ...data, tree: updateNode(data.tree, node.id, { name: values.name }) });
    } else if (type === 'editLink') {
      persist({ ...data, tree: updateNode(data.tree, node.id, { name: values.name, url: values.url }) });
    } else if (type === 'move') {
      let newTree = removeNode(data.tree, node.id);
      if (values.targetId === '__root__') newTree = [...newTree, node];
      else newTree = insertNode(newTree, values.targetId, node);
      persist({ ...data, tree: newTree });
    }
    setModal(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sheets-manager-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('バックアップから復元すると、現在のデータが上書きされます。よろしいですか？')) {
      e.target.value = ''; return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (imported.tree) { persist(imported); alert('✅ 復元完了しました'); }
        else alert('無効なファイルです');
      } catch { alert('ファイルの読み込みに失敗しました'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getAllFolders = (tree, excludeId) => {
    const result = [{ id: '__root__', name: 'トップ（ルート）' }];
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'folder' && n.id !== excludeId) {
          result.push(n);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(tree);
    return result;
  };

  const searchResults = useMemo(() =>
    searchQuery.trim() ? searchTree(data.tree, searchQuery) : [],
    [data.tree, searchQuery]
  );

  const pinnedNodes = useMemo(() => getPinnedNodes(data.tree), [data.tree]);

  const isSearching = searchQuery.trim().length > 0;

  // 読み込み中
  if (authLoading || dataLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">読み込み中...</div>
      </div>
    );
  }

  // 未ログイン → ログイン画面
  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <span className="login-logo">📊</span>
          <h1>Sheets Manager</h1>
          <p className="login-desc">スプレッドシートを整理・管理するツール</p>
          <button className="btn-google-login" onClick={handleLogin}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        {/* ヘッダー */}
        <div className="sidebar-header">
          <div className="header-top">
            <span className="app-logo">📊</span>
            <h1>Sheets Manager</h1>
            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')} title="アイコン表示">⊞</button>
              <button className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setViewMode('tree')} title="ツリー表示">☰</button>
            </div>
          </div>

          {/* ユーザー情報 */}
          <div className="user-info">
            {user.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} alt="" className="user-avatar" referrerPolicy="no-referrer" />
            )}
            <span className="user-name">{user.user_metadata?.full_name || user.email}</span>
            <button className="btn-logout" onClick={handleLogout} title="ログアウト">↩ ログアウト</button>
          </div>

          {/* 検索バー */}
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="シート・フォルダを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          {!isSearching && (
            <div className="root-actions">
              <button className="btn-add" onClick={handleAddFolderContextual}>📁 フォルダ追加</button>
              <button className="btn-add" onClick={handleAddLinkContextual}>🔗 リンク追加</button>
              <button className="btn-add btn-drive" onClick={() => setDriveImportOpen(true)}>📥 Driveから読み込む</button>
            </div>
          )}
        </div>

        {/* コンテンツ */}
        {isSearching ? (
          <SearchResults
            results={searchResults}
            onTogglePin={handleTogglePin}
          />
        ) : (
          <>
            <PinnedSection
              pinnedNodes={pinnedNodes}
              onTogglePin={handleTogglePin}
            />
            {viewMode === 'tree' ? (
              <nav className="tree">
                {data.tree.length === 0 && (
                  <p className="empty">フォルダまたはリンクを追加してください</p>
                )}
                {data.tree.map((node, i) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    onAddFolder={handleAddFolder}
                    onAddLink={handleAddLink}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    onDragMove={handleDragMove}
                    onTogglePin={handleTogglePin}
                    isLast={i === data.tree.length - 1}
                  />
                ))}
              </nav>
            ) : (
              <GridView
                tree={data.tree}
                path={gridPath}
                onPathChange={setGridPath}
                onAddFolder={handleAddFolder}
                onAddLink={handleAddLink}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onMove={handleMove}
                onDragMove={handleDragMove}
                onTogglePin={handleTogglePin}
              />
            )}
          </>
        )}

        <div className="sidebar-footer">
          <button onClick={handleExport} title="データをファイルに保存">💾 バックアップ保存</button>
          <label className="btn-import" title="保存したファイルから復元">
            📂 バックアップから復元
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
        </div>
      </aside>

      {modal && (
        <Modal
          modal={modal}
          folders={getAllFolders(data.tree, modal.node?.id)}
          onSubmit={handleModalSubmit}
          onClose={() => setModal(null)}
        />
      )}

      {driveImportOpen && (
        <DriveImport
          onImport={handleDriveImport}
          onClose={() => setDriveImportOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
