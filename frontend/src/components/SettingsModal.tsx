import React, { useState } from 'react';
import { X, Key, ShieldCheck } from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave
}) => {
  const [provider, setProvider] = useState<'gemini' | 'openai'>(settings.provider);
  const [geminiKey, setGeminiKey] = useState<string>(settings.gemini_api_key);
  const [openaiKey, setOpenaiKey] = useState<string>(settings.openai_api_key);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      provider,
      gemini_api_key: geminiKey,
      openai_api_key: openaiKey
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Cấu hình API & Nhà cung cấp</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Chọn mô hình ngôn ngữ</label>
              <div className="provider-options">
                <div
                  className={`provider-card ${provider === 'gemini' ? 'active' : ''}`}
                  onClick={() => setProvider('gemini')}
                >
                  <span className="provider-card-title">Google Gemini</span>
                  <span className="provider-card-desc">Sử dụng mô hình Gemini 3.5 Flash</span>
                </div>
                <div
                  className={`provider-card ${provider === 'openai' ? 'active' : ''}`}
                  onClick={() => setProvider('openai')}
                >
                  <span className="provider-card-title">OpenAI GPT</span>
                  <span className="provider-card-desc">Sử dụng mô hình GPT-4o Mini</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Key size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Gemini API Key
              </label>
              <input
                type="password"
                className="form-input"
                placeholder={settings.gemini_api_key ? '••••••••••••••••' : 'Nhập Google Gemini API Key...'}
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Key size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                OpenAI API Key
              </label>
              <input
                type="password"
                className="form-input"
                placeholder={settings.openai_api_key ? '••••••••••••••••' : 'Nhập OpenAI API Key...'}
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '12px', marginTop: '4px' }}>
              <ShieldCheck size={14} />
              <span>API key được lưu trữ an toàn trong LocalStorage trình duyệt của bạn.</span>
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: '600',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '4px 0',
                  fontFamily: 'inherit'
                }}
              >
                {showInstructions ? '📖 Ẩn hướng dẫn lấy API Key' : '📖 Xem hướng dẫn lấy API Key chi tiết'}
              </button>
              
              {showInstructions && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: 'rgba(99, 102, 241, 0.03)',
                  border: '1px solid rgba(99, 102, 241, 0.1)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12.5px',
                  color: 'var(--text-color)',
                  lineHeight: '1.6',
                  animation: 'fadeIn 0.3s ease',
                  textAlign: 'left'
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>🔑 Cách lấy Google Gemini API Key (Miễn phí):</strong>
                    <ol style={{ margin: '0', paddingLeft: '18px' }}>
                      <li>Truy cập <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Google AI Studio</a> và đăng nhập bằng tài khoản Google.</li>
                      <li>Nhấp vào nút <strong>"Get API key"</strong> ở thanh bên trái.</li>
                      <li>Chọn <strong>"Create API key"</strong>, sau đó nhấn tiếp <strong>"Create API key in new project"</strong> (hoặc chọn dự án có sẵn).</li>
                      <li>Sao chép mã khóa vừa tạo và dán vào ô nhập <strong>Gemini API Key</strong> ở trên.</li>
                    </ol>
                  </div>
                  <div>
                    <strong style={{ color: '#10b981', display: 'block', marginBottom: '4px' }}>🔑 Cách lấy OpenAI API Key:</strong>
                    <ol style={{ margin: '0', paddingLeft: '18px' }}>
                      <li>Truy cập <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: '#10b981', textDecoration: 'underline' }}>OpenAI Platform</a> và đăng nhập tài khoản.</li>
                      <li>Nhấn chọn <strong>"Create new secret key"</strong>.</li>
                      <li>Đặt tên cho khóa, nhấn <strong>"Create secret key"</strong> và sao chép mã (bắt đầu bằng <code>sk-...</code>).</li>
                      <li>Dán mã khóa vào ô nhập <strong>OpenAI API Key</strong> ở trên.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn-primary">
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
