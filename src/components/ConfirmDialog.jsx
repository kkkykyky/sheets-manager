export default function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{dialog.message}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={onCancel}>キャンセル</button>
          <button className={`confirm-ok ${dialog.danger ? 'danger' : ''}`} onClick={onConfirm}>
            {dialog.okLabel || '確認'}
          </button>
        </div>
      </div>
    </div>
  );
}
