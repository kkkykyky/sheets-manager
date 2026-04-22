import { useState } from 'react';

export default function Modal({ modal, folders, onSubmit, onClose }) {
  const { type, node } = modal;

  const [name, setName] = useState(node?.name || '');
  const [url, setUrl] = useState(node?.url || '');
  const [targetId, setTargetId] = useState('__root__');

  const titles = {
    addFolder: 'フォルダを追加',
    addLink: 'リンクを追加',
    editFolder: 'フォルダを編集',
    editLink: 'リンクを編集',
    move: '移動先を選択',
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'move') {
      onSubmit({ targetId });
    } else {
      if (!name.trim()) return;
      if ((type === 'addLink' || type === 'editLink') && !url.trim()) return;
      onSubmit({ name: name.trim(), url: url.trim() });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titles[type]}</h3>
        <form onSubmit={handleSubmit}>
          {type !== 'move' && (
            <div className="form-group">
              <label>表示名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: OST1.0"
                autoFocus
                required
              />
            </div>
          )}

          {(type === 'addLink' || type === 'editLink') && (
            <div className="form-group">
              <label>Google Sheets URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                required
              />
              <small>特定シートタブのURL（#gid=...付き）も使用できます</small>
            </div>
          )}

          {type === 'move' && (
            <div className="form-group">
              <label>移動先フォルダ</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" className="btn-primary">
              {type === 'move' ? '移動' : type.startsWith('add') ? '追加' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
