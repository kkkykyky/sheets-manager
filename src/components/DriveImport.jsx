import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function DriveImport({ onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null | 'no_token' | 'fetch_failed'
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;
      if (!token) { setError('no_token'); setLoading(false); return; }

      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
          q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
          fields: 'files(id,name,webViewLink,modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: '100',
        }),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) { setError('no_token'); setLoading(false); return; }

      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setError('fetch_failed');
    }
    setLoading(false);
  };

  const handleReauth = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/drive.readonly',
      },
    });
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map(f => f.id)));
  };

  const handleImport = () => {
    const toImport = files.filter(f => selected.has(f.id));
    onImport(toImport);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal drive-modal" onClick={e => e.stopPropagation()}>
        <h3>📥 Driveからスプレッドシートを読み込む</h3>

        {loading && (
          <div className="drive-loading">
            <span>🔄 Googleドライブを検索中...</span>
          </div>
        )}

        {!loading && error === 'no_token' && (
          <div className="drive-error">
            <p>🔑 Googleドライブへのアクセス権限がありません。</p>
            <p>一度ログアウトして、再度Googleでログインしてください。</p>
            <button className="btn-reauth" onClick={handleReauth}>
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Googleで再ログイン（Drive権限付き）
            </button>
          </div>
        )}

        {!loading && error === 'fetch_failed' && (
          <div className="drive-error">
            <p>⚠️ 読み込みに失敗しました。</p>
            <button className="btn-retry" onClick={fetchFiles}>🔄 再試行</button>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="drive-empty">
            <p>📭 スプレッドシートが見つかりませんでした</p>
          </div>
        )}

        {!loading && !error && files.length > 0 && (
          <>
            <div className="drive-select-all">
              <label>
                <input
                  type="checkbox"
                  checked={selected.size === files.length}
                  onChange={toggleAll}
                />
                すべて選択（{files.length}件）
              </label>
              <span className="drive-selected-count">
                {selected.size > 0 && `${selected.size}件選択中`}
              </span>
            </div>

            <div className="drive-file-list">
              {files.map(f => (
                <label key={f.id} className={`drive-file-item ${selected.has(f.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggleSelect(f.id)}
                  />
                  <span className="drive-file-icon">📊</span>
                  <span className="drive-file-name">{f.name}</span>
                  <span className="drive-file-date">{formatDate(f.modifiedTime)}</span>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button onClick={onClose}>キャンセル</button>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={selected.size === 0}
              >
                📥 {selected.size}件を取り込む
              </button>
            </div>
          </>
        )}

        {(loading || error) && (
          <div className="modal-actions">
            <button onClick={onClose}>閉じる</button>
          </div>
        )}
      </div>
    </div>
  );
}
