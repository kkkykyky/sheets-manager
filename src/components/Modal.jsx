import { useState } from 'react';

const FOLDER_COLORS = [
  '#e8f0fe', '#e6f4ea', '#fce8e6', '#fef7e0', '#f3e8fd', '#e6f3fb',
  '#fff3e0', '#fce4ec', '#e0f7fa', '#f1f8e9', '#ede7f6', '#e8eaf6',
];

const EMOJI_CATEGORIES = [
  {
    label: 'フォルダ・整理',
    emojis: ['📁','📂','🗂️','📦','🗃️','📋','🗄️','📌','📍','🗑️'],
  },
  {
    label: '書類・データ',
    emojis: ['📊','📈','📉','📄','📝','📑','📃','🗒️','📜','🔢'],
  },
  {
    label: 'ビジネス・お金',
    emojis: ['💰','💴','💵','💹','🏦','💳','🧾','💼','🏢','🛒'],
  },
  {
    label: '状態・優先度',
    emojis: ['⭐','🌟','✅','🔴','🟡','🟢','🔵','🟣','⚠️','🚨'],
  },
  {
    label: 'その他',
    emojis: ['💡','🚀','🎨','🔑','🔒','⚙️','🌐','🎯','🏆','🎁'],
  },
];

export default function Modal({ modal, folders, onSubmit, onClose }) {
  const { type, node, ids } = modal;

  const [name, setName] = useState(node?.name || '');
  const [url, setUrl] = useState(node?.url || '');
  const [color, setColor] = useState(node?.color || '');
  const [memo, setMemo] = useState(node?.memo || '');
  const [icon, setIcon] = useState(node?.icon || '');
  const [targetId, setTargetId] = useState('__root__');
  const [emojiOpen, setEmojiOpen] = useState(false);

  const titles = {
    addFolder: '📁 フォルダを追加',
    addLink: '🔗 リンクを追加',
    editFolder: '📁 フォルダを編集',
    editLink: '🔗 リンクを編集',
    move: '📦 移動先を選択',
    bulkMove: `📦 ${ids?.length ?? 0}件を移動`,
  };

  const defaultIcon = type === 'addFolder' || type === 'editFolder' ? '📁' : '🔗';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'move' || type === 'bulkMove') {
      onSubmit({ targetId });
    } else {
      if (!name.trim()) return;
      if ((type === 'addLink' || type === 'editLink') && !url.trim()) return;
      onSubmit({ name: name.trim(), url: url.trim(), color, memo: memo.trim(), icon });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{titles[type]}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {type !== 'move' && type !== 'bulkMove' && (
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

          {/* アイコン絵文字ピッカー */}
          {type !== 'move' && type !== 'bulkMove' && (
            <div className="form-group">
              <div className="emoji-label-row">
                <label>アイコン</label>
                <button type="button" className="emoji-toggle-btn" onClick={() => setEmojiOpen(v => !v)}>
                  {emojiOpen ? '▲ 閉じる' : '▼ 一覧から選ぶ'}
                </button>
              </div>
              <div className="emoji-picker-wrap">
                <div className="emoji-input-row">
                  <div className="emoji-preview">{icon || defaultIcon}</div>
                  <input
                    className="emoji-text-input"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="絵文字を直接入力..."
                    maxLength={4}
                  />
                  {icon && (
                    <button type="button" className="emoji-clear-btn" onClick={() => setIcon('')}>
                      リセット
                    </button>
                  )}
                </div>
                {emojiOpen && EMOJI_CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    <div className="emoji-category-label">{cat.label}</div>
                    <div className="emoji-grid">
                      {cat.emojis.map(em => (
                        <button
                          key={em}
                          type="button"
                          className={icon === em ? 'active' : ''}
                          onClick={() => setIcon(icon === em ? '' : em)}
                          title={em}
                        >{em}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(type === 'addFolder' || type === 'editFolder') && (
            <div className="form-group">
              <label>フォルダの色</label>
              <div className="color-picker">
                <button
                  type="button"
                  className={`color-swatch ${color === '' ? 'active' : ''}`}
                  style={{ background: 'linear-gradient(135deg, #e8f0fe, #e6f4ea)' }}
                  onClick={() => setColor('')}
                  title="デフォルト"
                >✨</button>
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          )}

          {type !== 'move' && type !== 'bulkMove' && (
            <div className="form-group">
              <label>メモ（任意）</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="説明や備考を入力..."
              />
            </div>
          )}

          {(type === 'move' || type === 'bulkMove') && (
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
              {(type === 'move' || type === 'bulkMove') ? '移動' : type.startsWith('add') ? '追加' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
