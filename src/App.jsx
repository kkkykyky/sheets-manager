import { useState, useCallback, useEffect } from 'react';
import { loadData, saveData, genId, removeNode, insertNode, updateNode, defaultData } from './store';
import TreeNode from './components/TreeNode';
import Modal from './components/Modal';
import './App.css';

function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const persist = useCallback((newData) => {
    setData(newData);
    saveData(newData); // 非同期だがUIはすぐ更新
  }, []);

  const handleAddFolder = (parentId) => setModal({ type: 'addFolder', targetId: parentId });
  const handleAddLink = (parentId) => setModal({ type: 'addLink', targetId: parentId });
  const handleEdit = (node) => setModal({ type: node.type === 'folder' ? 'editFolder' : 'editLink', node });
  const handleMove = (node) => setModal({ type: 'move', node });

  const handleDelete = (id, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    persist({ ...data, tree: removeNode(data.tree, id) });
  };

  // ドラッグ&ドロップによる移動
  const handleDragMove = useCallback((fromId, toId) => {
    const node = (() => {
      const find = (tree) => {
        for (const n of tree) {
          if (n.id === fromId) return n;
          if (n.children) { const f = find(n.children); if (f) return f; }
        }
      };
      return find(data.tree);
    })();
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
      e.target.value = '';
      return;
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

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="header-top">
            <span className="app-logo">📊</span>
            <h1>Sheets Manager</h1>
          </div>
          <div className="root-actions">
            <button className="btn-add" onClick={() => handleAddFolder('__root__')}>📁 フォルダ追加</button>
            <button className="btn-add" onClick={() => handleAddLink('__root__')}>🔗 リンク追加</button>
          </div>
        </div>
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
              isLast={i === data.tree.length - 1}
            />
          ))}
        </nav>
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
    </div>
  );
}

export default App;
