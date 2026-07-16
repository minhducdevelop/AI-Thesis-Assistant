import React, { useState } from 'react';
import { Settings, Search, MessageSquare, Plus, LogOut, Trash2 } from 'lucide-react';

interface ChatThread {
  id: number;
  title: string;
  created_at: string;
}

interface SidebarProps {
  // User Authentication
  username: string; // User display name, empty if anonymous
  onLogout: () => void;
  onOpenSettings: () => void;

  // Chat Threads / Sessions History
  threads: ChatThread[];
  activeThreadId: number | null;
  onSelectThread: (id: number) => void;
  onCreateThread: () => void;
  onDeleteThread: (id: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  username,
  onLogout,
  onOpenSettings,
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredThreads = threads.filter(thread => 
    thread.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isLoggedIn = !!username;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">
          <img src="/logo.png" alt="ThesisAI Logo" className="sidebar-logo-img" />
        </span>
      </div>

      <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Search Chats */}
        <div className="form-group" style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Tìm kiếm đoạn chat..."
            style={{ paddingLeft: '36px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search 
            size={16} 
            color="var(--text-muted)" 
            style={{ position: 'absolute', left: '12px', top: '14px' }} 
          />
        </div>

        {/* Chat History Section */}
        <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="sidebar-section-title">
            <span>Lịch sử đoạn chat</span>
            <button 
              className="btn-new-chat" 
              onClick={onCreateThread}
              title="Tạo đoạn chat mới"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="thread-list" style={{ flex: 1, overflowY: 'auto' }}>
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <div 
                  key={thread.id} 
                  className={`thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
                  onClick={() => onSelectThread(thread.id)}
                >
                  <MessageSquare size={14} className="thread-icon" />
                  <span className="thread-title" title={thread.title}>
                    {thread.title}
                  </span>
                  <button
                    className="thread-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteThread(thread.id);
                    }}
                    title="Xóa đoạn chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="no-threads" onClick={onCreateThread} style={{ cursor: 'pointer' }}>
                + Tạo đoạn chat mới để bắt đầu
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!isLoggedIn && (
          <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', textAlign: 'center', lineHeight: '1.4' }}>
            💡 Đăng nhập để lưu trữ lịch sử đoạn chat trực tuyến vĩnh viễn.
          </div>
        )}
        {isLoggedIn && (
          <div className="user-profile-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
            <div className="user-info">
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Thành viên:</span>
              <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13px' }}>{username}</div>
            </div>
            <button 
              className="btn-logout" 
              onClick={onLogout} 
              title="Đăng xuất"
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--error)', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '6px',
                borderRadius: '4px'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        
        <button className="btn-sidebar" onClick={onOpenSettings}>
          <Settings size={16} />
          Cấu hình API & AI
        </button>
      </div>
    </aside>
  );
};
