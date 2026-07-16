import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { AuthScreen } from './components/AuthScreen';
import { Document, ChatMessage, UserSettings } from './types';

const DEFAULT_SETTINGS: UserSettings = {
  provider: 'gemini',
  gemini_api_key: '',
  openai_api_key: ''
};

interface ChatThread {
  id: number;
  title: string;
  created_at: string;
}

function App() {
  // Authentication states
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('thesis_assistant_token');
  });
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('thesis_assistant_username') || '';
  });
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('thesis_assistant_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string }>({ current: 0, total: 0, fileName: '' });
  const [isQuerying, setIsQuerying] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

  // Chat Threads History states
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);

  // Force light theme by adding light-theme class
  useEffect(() => {
    document.documentElement.classList.add('light-theme');
  }, []);

  // Auto-logout on 401: Axios interceptor detects expired tokens
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - auto logout
          console.warn('[Auth] Token expired, auto-logging out...');
          localStorage.removeItem('thesis_assistant_token');
          localStorage.removeItem('thesis_assistant_username');
          setToken(null);
          setUsername('');
          setDocuments([]);
          setThreads([]);
          setMessages([]);
          setActiveThreadId(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Validate token on startup: check if saved token is still valid
  useEffect(() => {
    if (!token) return;
    axios.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      // Token is valid, update username
      setUsername(res.data.full_name);
    }).catch(() => {
      // Token invalid - clear it
      console.warn('[Auth] Saved token is invalid, clearing...');
      localStorage.removeItem('thesis_assistant_token');
      localStorage.removeItem('thesis_assistant_username');
      setToken(null);
      setUsername('');
    });
  }, []); // Only on mount

  // Sync settings to localStorage
  useEffect(() => {
    localStorage.setItem('thesis_assistant_settings', JSON.stringify(settings));
  }, [settings]);

  // Resolve request headers based on settings and authentication
  const getHeaders = () => {
    const headers: Record<string, string> = {
      'X-Provider': settings.provider
    };
    
    const activeKey = 
      settings.provider === 'gemini' 
        ? settings.gemini_api_key 
        : settings.openai_api_key;
        
    if (activeKey.trim()) {
      headers['X-API-Key'] = activeKey;
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (activeThreadId !== null) {
      headers['X-Thread-Id'] = String(activeThreadId);
    }
    
    return headers;
  };

  // Fetch documents list from backend
  const fetchDocuments = async () => {
    // Don't try to fetch if no API key configured (would fail on embedding init)
    const hasKey = settings.provider === 'gemini' ? !!settings.gemini_api_key : !!settings.openai_api_key;
    if (!hasKey) {
      setDocuments([]);
      return;
    }
    try {
      const response = await axios.get('/api/documents', {
        headers: getHeaders()
      });
      setDocuments(response.data);
    } catch (error: any) {
      console.error('Failed to fetch documents', error);
      if (error.response?.status === 400) {
        alert(`Lỗi cấu hình: ${error.response.data.detail}`);
      }
    }
  };

  // Fetch chat threads history from backend or localStorage
  const fetchThreads = async () => {
    if (!token) {
      const local = localStorage.getItem('thesis_assistant_local_threads');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setThreads(parsed);
          if (parsed.length > 0 && activeThreadId === null) {
            handleSelectThread(parsed[0].id);
          }
        } catch (e) {
          setThreads([]);
        }
      } else {
        setThreads([]);
      }
      return;
    }
    try {
      const response = await axios.get('/api/chat/threads', {
        headers: getHeaders()
      });
      setThreads(response.data);
      
      // Auto-select the first thread if none is active and threads are available
      if (response.data.length > 0 && activeThreadId === null) {
        handleSelectThread(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch chat history threads', error);
    }
  };

  // Fetch all threads and documents when authenticated user, thread, or settings change
  useEffect(() => {
    fetchDocuments();
    fetchThreads();
  }, [token, activeThreadId, settings.provider, settings.gemini_api_key, settings.openai_api_key]);

  // Handle Thread Select
  const handleSelectThread = async (threadId: number) => {
    setActiveThreadId(threadId);
    if (!token) {
      const savedMsgs = localStorage.getItem(`thesis_assistant_local_messages_${threadId}`);
      if (savedMsgs) {
        try {
          setMessages(JSON.parse(savedMsgs));
        } catch (e) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      return;
    }
    try {
      const response = await axios.get(`/api/chat/threads/${threadId}/messages`, {
        headers: getHeaders()
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch thread messages', error);
      alert('Không thể tải tin nhắn của cuộc hội thoại này.');
    }
  };

  // Handle Thread Create
  const handleCreateThread = async () => {
    const title = prompt('Nhập tên cuộc hội thoại mới:', `Hội thoại ngày ${new Date().toLocaleDateString('vi-VN')}`);
    if (!title || !title.trim()) return;

    if (!token) {
      const newThread: ChatThread = {
        id: Date.now(),
        title: title.trim(),
        created_at: new Date().toISOString()
      };
      const updatedThreads = [newThread, ...threads];
      setThreads(updatedThreads);
      localStorage.setItem('thesis_assistant_local_threads', JSON.stringify(updatedThreads));
      setActiveThreadId(newThread.id);
      setMessages([]);
      return;
    }

    try {
      const response = await axios.post('/api/chat/threads', { title: title.trim() }, {
        headers: getHeaders()
      });
      setThreads(prev => [response.data, ...prev]);
      setActiveThreadId(response.data.id);
      setMessages([]); // Clear chat panel
    } catch (error) {
      console.error('Failed to create thread on server, falling back to local thread', error);
      const newThread: ChatThread = {
        id: Date.now(),
        title: title.trim(),
        created_at: new Date().toISOString()
      };
      const updatedThreads = [newThread, ...threads];
      setThreads(updatedThreads);
      localStorage.setItem('thesis_assistant_local_threads', JSON.stringify(updatedThreads));
      setActiveThreadId(newThread.id);
      setMessages([]);
    }
  };

  // Handle Thread Delete
  const handleDeleteThread = async (threadId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cuộc hội thoại này cùng toàn bộ lịch sử câu hỏi?')) return;

    if (!token) {
      const updatedThreads = threads.filter(t => t.id !== threadId);
      setThreads(updatedThreads);
      localStorage.setItem('thesis_assistant_local_threads', JSON.stringify(updatedThreads));
      localStorage.removeItem(`thesis_assistant_local_messages_${threadId}`);
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
      return;
    }

    try {
      await axios.delete(`/api/chat/threads/${threadId}`, {
        headers: getHeaders()
      });
      setThreads(prev => prev.filter(t => t.id !== threadId));
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete thread', error);
      alert('Không thể xóa cuộc hội thoại.');
    }
  };

  // Handle PDF document upload (supports multiple files)
  const handleUploadFiles = async (files: File[]) => {
    setIsUploading(true);
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });

      const formData = new FormData();
      formData.append('file', file);

      try {
        await axios.post('/api/documents', formData, {
          headers: {
            ...getHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        succeeded.push(file.name);
      } catch (error: any) {
        console.error('Upload failed', error);
        const errMsg = error.response?.data?.detail || error.message;
        failed.push(`${file.name}: ${errMsg}`);
      }
    }

    await fetchDocuments();

    if (succeeded.length > 0 && failed.length === 0) {
      alert(`Đã tải lên thành công ${succeeded.length} tệp tin.`);
    } else if (succeeded.length > 0 && failed.length > 0) {
      alert(`Thành công: ${succeeded.length} tệp.\nThất bại: ${failed.length} tệp:\n${failed.join('\n')}`);
    } else {
      alert(`Tải lên thất bại:\n${failed.join('\n')}`);
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0, fileName: '' });
  };

  // Handle document deletion
  const handleDelete = async (filename: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${filename}" khỏi thư viện?`)) {
      return;
    }
    
    try {
      await axios.delete(`/api/documents/${filename}`, {
        headers: getHeaders()
      });
      await fetchDocuments();
    } catch (error: any) {
      console.error('Deletion failed', error);
      alert(`Lỗi xóa tài liệu: ${error.response?.data?.detail || error.message}`);
    }
  };

  // Handle Q&A submit
  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isQuerying) return;

    const userQuery = inputValue.trim();
    setInputValue('');
    setIsQuerying(true);

    let currentThreadId = activeThreadId;

    // 1. If no thread is active, auto-create one
    if (currentThreadId === null) {
      const title = userQuery.length > 30 ? userQuery.substring(0, 27) + '...' : userQuery;
      if (!token) {
        // Guest mode auto-creation
        const newThread: ChatThread = {
          id: Date.now(),
          title,
          created_at: new Date().toISOString()
        };
        const updatedThreads = [newThread, ...threads];
        setThreads(updatedThreads);
        localStorage.setItem('thesis_assistant_local_threads', JSON.stringify(updatedThreads));
        currentThreadId = newThread.id;
        setActiveThreadId(currentThreadId);
      } else {
        // Logged in mode auto-creation
        try {
          const res = await axios.post('/api/chat/threads', { title }, { headers: getHeaders() });
          setThreads(prev => [res.data, ...prev]);
          currentThreadId = res.data.id;
          setActiveThreadId(currentThreadId);
        } catch (err) {
          console.error('Auto thread creation failed', err);
          alert('Không thể tạo cuộc hội thoại.');
          setIsQuerying(false);
          return;
        }
      }
    }

    // 2. Add local user message immediately for responsive UI
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: userQuery,
      timestamp: new Date()
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (!token && currentThreadId !== null) {
      localStorage.setItem(`thesis_assistant_local_messages_${currentThreadId}`, JSON.stringify(updatedMessages));
    }

    // 3. Request query API
    try {
      const requestData: any = { query: userQuery };
      if (currentThreadId !== null) {
        requestData.thread_id = currentThreadId;
      }

      // We resolve headers manually here to ensure the new thread ID is included in headers
      const headers = getHeaders();
      if (currentThreadId !== null) {
        headers['X-Thread-Id'] = String(currentThreadId);
      }

      const response = await axios.post('/api/query', 
        requestData, 
        { headers }
      );
      
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.data.answer,
        citations: response.data.citations,
        hypothesis_map: response.data.hypothesis_map || null,
        debate: response.data.debate || null,
        timestamp: new Date()
      };
      
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      if (!token && currentThreadId !== null) {
        localStorage.setItem(`thesis_assistant_local_messages_${currentThreadId}`, JSON.stringify(finalMessages));
      }
    } catch (error: any) {
      console.error('Query failed', error);
      const errMsg = error.response?.data?.detail || error.message;
      
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: `Đã xảy ra lỗi: ${errMsg}`,
        timestamp: new Date(),
        isError: true
      };
      
      const finalErrorMessages = [...updatedMessages, errorMsg];
      setMessages(finalErrorMessages);
      if (!token && currentThreadId !== null) {
        localStorage.setItem(`thesis_assistant_local_messages_${currentThreadId}`, JSON.stringify(finalErrorMessages));
      }
    } finally {
      setIsQuerying(false);
    }
  };

  // Auth modal login success handler
  const handleLoginSuccess = (userToken: string, userFullName: string, userPhone: string) => {
    localStorage.setItem('thesis_assistant_token', userToken);
    localStorage.setItem('thesis_assistant_username', userFullName);
    setToken(userToken);
    setUsername(userFullName);
  };

  // Auth logout handler
  const handleLogout = async () => {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tài khoản?')) return;
    try {
      await axios.post('/api/auth/logout', {}, { headers: getHeaders() });
    } catch (e) {
      console.error('Failed backend logout', e);
    }
    localStorage.removeItem('thesis_assistant_token');
    localStorage.removeItem('thesis_assistant_username');
    setToken(null);
    setUsername('');
    setDocuments([]);
    setThreads([]);
    setMessages([]);
    setActiveThreadId(null);
  };

  const handleSaveSettings = (newSettings: UserSettings) => {
    setSettings(newSettings);
    // Clear active chat thread messages when settings change
    if (newSettings.provider !== settings.provider) {
      setMessages([]);
    }
  };

  // Handle Reindex all documents
  const handleReindex = async () => {
    if (!confirm('Cập nhật chỉ mục sẽ xử lý lại toàn bộ tài liệu đã tải lên. Tiếp tục?')) return;
    setIsReindexing(true);
    try {
      const response = await axios.post('/api/documents/reindex', {}, {
        headers: getHeaders()
      });
      const data = response.data;
      alert(`Đã cập nhật chỉ mục thành công!\n${data.total_files} tài liệu, ${data.total_chunks} đoạn văn bản.`);
      await fetchDocuments();
    } catch (error: any) {
      console.error('Reindex failed', error);
      alert(`Lỗi cập nhật chỉ mục: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsReindexing(false);
    }
  };

  const hasKey = settings.provider === 'gemini' ? !!settings.gemini_api_key : !!settings.openai_api_key;

  return (
    <div className="app-container">
      <Sidebar
        username={username}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onCreateThread={handleCreateThread}
        onDeleteThread={handleDeleteThread}
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
        <header className="top-bar">
          <div className="current-setup">
            <span className="provider-badge">{settings.provider}</span>
            {!hasKey && (
              <span style={{ fontSize: '12px', color: 'var(--error)', fontWeight: '600' }}>
                ⚠️ Chưa nhập API Key
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="document-count" style={{ display: 'flex', alignItems: 'center' }}>
              <span>Tài liệu của đoạn chat:</span>
              <strong style={{ marginLeft: '4px' }}>{activeThreadId !== null ? `${documents.length} tài liệu` : 'Chưa chọn chat'}</strong>
            </div>



            {/* Login / Auth status on the topbar taskbar */}
            <div className="auth-status-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {token ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Thành viên: <strong style={{ color: 'var(--text-primary)' }}>{username}</strong>
                  </span>
                  <button 
                    className="btn-auth-bar"
                    onClick={handleLogout}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      border: '1px solid var(--border-color)', 
                      background: 'var(--bg-card)', 
                      color: 'var(--text-primary)', 
                      cursor: 'pointer', 
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 600,
                      transition: 'var(--transition)'
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : (
                <button 
                  className="btn btn-primary btn-auth-bar"
                  onClick={() => setIsAuthOpen(true)}
                  style={{ 
                    padding: '8px 16px', 
                    fontSize: '12.5px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Đăng nhập / Đăng ký
                </button>
              )}
            </div>
          </div>
        </header>

        <ChatArea
          messages={messages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleQuerySubmit}
          isLoading={isQuerying}
          activeThreadId={activeThreadId}
          documents={documents}
          onUploadFiles={handleUploadFiles}
          onDelete={handleDelete}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onReindex={handleReindex}
          isReindexing={isReindexing}
          token={token}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {/* Auth Screen Modal Dialog */}
      <AuthScreen
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
