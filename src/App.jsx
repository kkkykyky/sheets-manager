import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase, cacheProviderToken, getCachedProviderToken } from './supabase';
import { loadData, saveData, genId, removeNode, insertNode, updateNode, reorderNode, defaultData } from './store';
import TreeNode from './components/TreeNode';
import GridView from './components/GridView';
import Modal from './components/Modal';
import SearchResults from './components/SearchResults';
import PinnedSection from './components/PinnedSection';
import DriveImport from './components/DriveImport';
import Toast from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import AdBanner from './components/AdBanner';
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [syncStatus, setSyncStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, okLabel, danger, onConfirm }

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showConfirm = useCallback((message, onConfirm, { okLabel = '削除', danger = true } = {}) => {
    setConfirmDialog({ message, okLabel, danger, onConfirm });
  }, []);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sm_dark') === '1');
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sm_recent') || '[]'); } catch { return []; }
  });

  // ダークモード適用
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('sm_dark', darkMode ? '1' : '0');
  }, [darkMode]);

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.provider_token) cacheProviderToken(session.provider_token);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.provider_token) cacheProviderToken(session.provider_token);
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

  const handleToggleSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    showConfirm(`${selectedIds.size}件を削除しますか？`, () => {
      let newTree = data.tree;
      for (const id of selectedIds) newTree = removeNode(newTree, id);
      persist({ ...data, tree: newTree });
      setSelectedIds(new Set());
      setSelectionMode(false);
      showToast(`${selectedIds.size}件を削除しました`, 'success');
    });
  };

  const handleLinkOpen = useCallback((node) => {
    setRecentIds(prev => {
      const next = [node.id, ...prev.filter(id => id !== node.id)].slice(0, 10);
      localStorage.setItem('sm_recent', JSON.stringify(next));
      return next;
    });
    window.open(node.url, '_blank', 'noopener,noreferrer');
  }, []);

  const handleBulkMove = () => {
    if (selectedIds.size === 0) return;
    setModal({ type: 'bulkMove', ids: [...selectedIds] });
  };

  const handleDriveSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token || getCachedProviderToken();
      if (!token) { setSyncStatus({ error: 'token' }); return; }

      // ツリー内の全リンクを収集 (id → { nodeId, fileId })
      const linkMap = new Map(); // fileId → nodeId
      const walk = (nodes) => {
        for (const n of nodes) {
          if (n.type === 'link' && n.url) {
            const m = n.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (m) linkMap.set(m[1], n.id);
          }
          if (n.children) walk(n.children);
        }
      };
      walk(data.tree);

      if (linkMap.size === 0) { setSyncStatus({ updated: 0 }); return; }

      // Drive APIでファイル名を一括取得
      const fileIds = [...linkMap.keys()];
      const q = fileIds.map(id => `'${id}' in parents or id='${id}'`);
      // ファイルIDで直接取得 (idクエリ)
      const queryStr = fileIds.map(id => `id='${id}'`).join(' or ');
      const params = new URLSearchParams({
        q: `(${queryStr}) and trashed=false`,
        fields: 'files(id,name)',
        pageSize: '1000',
      });

      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?' + params,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) { setSyncStatus({ error: 'fetch' }); return; }

      const driveData = await res.json();
      const driveFiles = driveData.files || [];

      // 名前が変わっているものを更新
      let newTree = data.tree;
      let updatedCount = 0;
      for (const file of driveFiles) {
        const nodeId = linkMap.get(file.id);
        if (!nodeId) continue;
        // 現在の名前を確認
        const findNode = (nodes) => {
          for (const n of nodes) {
            if (n.id === nodeId) return n;
            if (n.children) { const f = findNode(n.children); if (f) return f; }
          }
        };
        const node = findNode(newTree);
        if (node && node.name !== file.name) {
          newTree = updateNode(newTree, nodeId, { name: file.name });
          updatedCount++;
        }
      }

      if (updatedCount > 0) persist({ ...data, tree: newTree });
      setSyncStatus({ updated: updatedCount });
    } catch (e) {
      console.error(e);
      setSyncStatus({ error: 'fetch' });
    }
    // 3秒後にリセット
    setTimeout(() => setSyncStatus(null), 3000);
  }, [data, persist]);

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
    showConfirm(`「${name}」を削除しますか？`, () => {
      persist({ ...data, tree: removeNode(data.tree, id) });
      showToast(`「${name}」を削除しました`, 'success');
    });
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

  const handleReorder = useCallback((fromId, targetId, position) => {
    const newTree = reorderNode(data.tree, fromId, targetId, position);
    persist({ ...data, tree: newTree });
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
    const { type, targetId, node, ids } = modal;

    if (type === 'addFolder') {
      const newNode = { id: genId(), type: 'folder', name: values.name, icon: values.icon || '', color: values.color || '', memo: values.memo || '', children: [] };
      if (targetId === '__root__') persist({ ...data, tree: [...data.tree, newNode] });
      else persist({ ...data, tree: insertNode(data.tree, targetId, newNode) });
    } else if (type === 'addLink') {
      const newNode = { id: genId(), type: 'link', name: values.name, url: values.url, icon: values.icon || '', memo: values.memo || '' };
      if (targetId === '__root__') persist({ ...data, tree: [...data.tree, newNode] });
      else persist({ ...data, tree: insertNode(data.tree, targetId, newNode) });
    } else if (type === 'editFolder') {
      persist({ ...data, tree: updateNode(data.tree, node.id, { name: values.name, icon: values.icon || '', color: values.color || '', memo: values.memo || '' }) });
    } else if (type === 'editLink') {
      persist({ ...data, tree: updateNode(data.tree, node.id, { name: values.name, url: values.url, icon: values.icon || '', memo: values.memo || '' }) });
    } else if (type === 'move') {
      let newTree = removeNode(data.tree, node.id);
      if (values.targetId === '__root__') newTree = [...newTree, node];
      else newTree = insertNode(newTree, values.targetId, node);
      persist({ ...data, tree: newTree });
    } else if (type === 'bulkMove') {
      // collect nodes first, then remove, then insert
      const nodesToMove = ids.map(id => {
        const find = (tree) => {
          for (const n of tree) {
            if (n.id === id) return n;
            if (n.children) { const f = find(n.children); if (f) return f; }
          }
        };
        return find(data.tree);
      }).filter(Boolean);
      let newTree = data.tree;
      for (const id of ids) newTree = removeNode(newTree, id);
      if (values.targetId === '__root__') newTree = [...newTree, ...nodesToMove];
      else for (const n of nodesToMove) newTree = insertNode(newTree, values.targetId, n);
      persist({ ...data, tree: newTree });
      setSelectedIds(new Set());
      setSelectionMode(false);
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
    e.target.value = '';
    showConfirm('バックアップから復元すると、現在のデータが上書きされます。よろしいですか？', () => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = JSON.parse(ev.target.result);
          if (imported.tree) { persist(imported); showToast('復元完了しました', 'success'); }
          else showToast('無効なファイルです', 'error');
        } catch { showToast('ファイルの読み込みに失敗しました', 'error'); }
      };
      reader.readAsText(file);
    }, { okLabel: '復元する', danger: true });
  };

  // 既存のリンクURLから Drive ファイルIDを抽出
  const getExistingFileIds = (tree) => {
    const ids = new Set();
    const walk = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'link' && n.url) {
          const m = n.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (m) ids.add(m[1]);
        }
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return ids;
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

  const recentNodes = useMemo(() => {
    const find = (tree, id) => {
      for (const n of tree) {
        if (n.id === id) return n;
        if (n.children) { const f = find(n.children, id); if (f) return f; }
      }
    };
    return recentIds.map(id => find(data.tree, id)).filter(Boolean);
  }, [recentIds, data.tree]);

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
        <div className="login-hero">
          <div className="login-hero-inner">
            <div className="login-brand">
              <img src="/icon-512.svg" alt="Sheets Manager" className="login-app-icon" />
              <span className="login-app-name">Sheets Manager</span>
            </div>
            <h1 className="login-headline">
              散らばったスプレッドシートを<br />すっきり整理
            </h1>
            <p className="login-sub">Googleスプレッドシートのリンクをフォルダで管理。<br />どこからでも素早くアクセス。</p>
            <ul className="login-features">
              <li><span>📁</span>フォルダで階層管理・色分け</li>
              <li><span>⭐</span>お気に入りピン留め</li>
              <li><span>🔍</span>名前で即座に検索</li>
              <li><span>📥</span>Driveから一括インポート</li>
              <li><span>🌙</span>ダークモード対応</li>
              <li><span>📱</span>スマホにインストール可能（PWA）</li>
            </ul>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-card">
            <img src="/icon-512.svg" alt="" className="login-card-icon" />
            <h2>ログイン</h2>
            <p className="login-desc">Googleアカウントで無料で始められます</p>
            <button className="btn-google-login" onClick={handleLogin}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Googleでログイン
            </button>
            <p className="login-legal">
              ログインすることで
              <a href="/terms.html" target="_blank" rel="noopener">利用規約</a>および
              <a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>
              に同意したものとみなします
            </p>
          </div>
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
            <button
              className="btn-dark-mode"
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'ライトモードに切替' : 'ダークモードに切替'}
            >{darkMode ? '☀️' : '🌙'}</button>
            <div className="view-toggle">
              <button className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => { setViewMode('grid'); handleCancelSelection(); }} title="アイコン表示">⊞</button>
              <button className={`toggle-btn ${viewMode === 'tree' ? 'active' : ''}`}
                onClick={() => { setViewMode('tree'); handleCancelSelection(); }} title="ツリー表示">☰</button>
              <button className={`toggle-btn ${selectionMode ? 'active' : ''}`}
                onClick={() => selectionMode ? handleCancelSelection() : setSelectionMode(true)} title="選択モード">☑</button>
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

          {!isSearching && !selectionMode && (
            <div className="root-actions">
              <div className="root-actions-row">
                <button className="btn-add" onClick={handleAddFolderContextual}>📁 フォルダ追加</button>
                <button className="btn-add" onClick={handleAddLinkContextual}>🔗 リンク追加</button>
              </div>
              <div className="root-actions-row">
                <button className="btn-drive-import" onClick={() => setDriveImportOpen(true)}>📥 Driveから読み込む</button>
                <button
                  className={`btn-drive-sync ${syncStatus === 'syncing' ? 'syncing' : ''}`}
                  onClick={handleDriveSync}
                  disabled={syncStatus === 'syncing'}
                  title="Driveのファイル名変更を同期"
                >
                  {syncStatus === 'syncing' ? '🔄' :
                   syncStatus?.updated !== undefined ? `✅ ${syncStatus.updated}件更新` :
                   syncStatus?.error ? '⚠️ 失敗' : '🔄 名前を同期'}
                </button>
              </div>
            </div>
          )}
          {!isSearching && selectionMode && (
            <div className="selection-bar">
              <span className="selection-count">
                {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : 'アイテムをタップして選択'}
              </span>
              <div className="selection-actions">
                <button className="btn-cancel-select" onClick={handleCancelSelection}>キャンセル</button>
                <button className="btn-move-selected" onClick={handleBulkMove} disabled={selectedIds.size === 0}>
                  📦 移動
                </button>
                <button className="btn-delete-selected" onClick={handleBulkDelete} disabled={selectedIds.size === 0}>
                  🗑️ {selectedIds.size > 0 ? `${selectedIds.size}件削除` : '削除'}
                </button>
              </div>
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
            {recentNodes.length > 0 && !selectionMode && (
              <div className="recent-section">
                <div className="pinned-title">🕐 最近開いたシート</div>
                <div className="recent-list">
                  {recentNodes.map(n => (
                    <button
                      key={n.id}
                      className="recent-item"
                      onClick={() => handleLinkOpen(n)}
                      title={n.memo || n.url}
                    >
                      <span className="recent-icon">🔗</span>
                      <span className="recent-name">{n.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <PinnedSection
              pinnedNodes={pinnedNodes}
              onTogglePin={handleTogglePin}
              onLinkOpen={handleLinkOpen}
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
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelection={handleToggleSelection}
                    onLinkOpen={handleLinkOpen}
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
                onReorder={handleReorder}
                onTogglePin={handleTogglePin}
                onLinkOpen={handleLinkOpen}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelection={handleToggleSelection}
              />
            )}
          </>
        )}

        <AdBanner />

        <div className="sidebar-footer">
          <button onClick={handleExport} title="データをファイルに保存">💾 バックアップ保存</button>
          <label className="btn-import" title="保存したファイルから復元">
            📂 バックアップから復元
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <div className="footer-legal">
            <a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>
            <span>·</span>
            <a href="/terms.html" target="_blank" rel="noopener">利用規約</a>
          </div>
        </div>
      </aside>

      {modal && (
        <Modal
          modal={modal}
          folders={getAllFolders(data.tree, modal.type === 'bulkMove' ? null : modal.node?.id)}
          onSubmit={handleModalSubmit}
          onClose={() => setModal(null)}
        />
      )}

      {driveImportOpen && (
        <DriveImport
          onImport={handleDriveImport}
          onClose={() => setDriveImportOpen(false)}
          existingFileIds={getExistingFileIds(data.tree)}
        />
      )}

      <ConfirmDialog
        dialog={confirmDialog}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
        onCancel={() => setConfirmDialog(null)}
      />
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
