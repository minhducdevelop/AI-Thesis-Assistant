import React, { useEffect, useRef, useState } from 'react';
import { Send, Quote, FileText, Trash2, RefreshCw, Search } from 'lucide-react';
import { ChatMessage, Citation, Document } from '../types';
import { UploadZone } from './UploadZone';
import { MindmapView } from './MindmapView';
import { DebateView } from './DebateView';
import { DeepCitationPopup } from './DeepCitationPopup';
import welcomeLogo from '../vju_logo_red.png';

interface ChatAreaProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  
  // Document Management inside the selected Thread
  activeThreadId: number | null;
  documents: Document[];
  onUploadFiles: (files: File[]) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  isUploading: boolean;
  uploadProgress?: { current: number; total: number; fileName: string };
  onReindex: () => void;
  isReindexing: boolean;
  token?: string | null;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  isLoading,
  activeThreadId,
  documents,
  onUploadFiles,
  onDelete,
  isUploading,
  uploadProgress,
  onReindex,
  isReindexing,
  token
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Helper: Renders **bold** markdown within a plain text string
  const renderTextWithBold = (text: string, baseKey: string): React.ReactNode[] => {
    const boldRegex = /\*\*(.+?)\*\*/g;
    const result: React.ReactNode[] = [];
    let lastIdx = 0;
    let boldMatch;

    while ((boldMatch = boldRegex.exec(text)) !== null) {
      // Text before the bold
      if (boldMatch.index > lastIdx) {
        result.push(text.substring(lastIdx, boldMatch.index));
      }
      // The bold text
      result.push(
        <strong key={`${baseKey}-b-${boldMatch.index}`} className="msg-bold">
          {boldMatch[1]}
        </strong>
      );
      lastIdx = boldRegex.lastIndex;
    }
    // Remaining text after last bold
    if (lastIdx < text.length) {
      result.push(text.substring(lastIdx));
    }
    return result.length > 0 ? result : [text];
  };

  // Regular expression to parse [Filename.pdf:Page] or [Filename:Page]
  const renderMessageContent = (content: string, citations: Citation[] = []) => {
    const regex = /\[([^\]]+?):(\d+)\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const matchIndex = match.index;
      
      // Push leading text (with bold support)
      if (matchIndex > lastIndex) {
        const textSegment = content.substring(lastIndex, matchIndex);
        parts.push(...renderTextWithBold(textSegment, `t-${lastIndex}`));
      }

      const source = match[1];
      const page = parseInt(match[2], 10);

      // Find matching citation by comparing source string
      const matchingCitation = citations.find(c => {
        const normSource = c.source.toLowerCase();
        const normMatch = source.toLowerCase();
        return (
          normSource === normMatch || 
          normSource.replace(/\.[pP][dD][fF]$/, '') === normMatch ||
          c.title.toLowerCase().includes(normMatch)
        ) && c.page === page;
      });

      // Display name (strip .pdf suffix for aesthetics)
      const displayName = source.replace(/\.[pP][dD][fF]$/, '');

      const citationKey = `${source}:${page}:${matchIndex}`;

      // Use DeepCitationPopup if we have a matching citation with page image
      if (matchingCitation) {
        parts.push(
          <DeepCitationPopup 
            key={matchIndex} 
            citation={matchingCitation}
            token={token}
          >
            <span 
              className={`inline-citation ${expandedCitation === citationKey ? 'expanded' : ''}`}
              onClick={() => setExpandedCitation(expandedCitation === citationKey ? null : citationKey)}
            >
              {displayName} (Tr. {page})
            </span>
          </DeepCitationPopup>
        );
      } else {
        parts.push(
          <span key={matchIndex} className="inline-citation-wrapper">
            <span 
              className={`inline-citation ${expandedCitation === citationKey ? 'expanded' : ''}`}
              onClick={() => setExpandedCitation(expandedCitation === citationKey ? null : citationKey)}
            >
              {displayName} (Tr. {page})
            </span>
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Remaining text after last citation (with bold support)
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      parts.push(...renderTextWithBold(remainingText, `t-end`));
    }

    return parts.length > 0 ? parts : content;
  };

  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocs = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.title.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Left Chat Frame Wrapper */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%' }}>
        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <img src={welcomeLogo} alt="Welcome Logo" className="welcome-icon-img" />
              <h2 className="welcome-title">Trợ lý AI sẵn sàng</h2>
              <p className="welcome-desc">
                Hệ thống RAG chuyên biệt giúp bạn tìm kiếm thông tin, giải đáp thắc mắc và trích dẫn trực tiếp từ các bài báo khoa học.
              </p>
              <div className="welcome-steps">
                <div className="welcome-step-card">
                  <span className="welcome-step-num">Bước 1</span>
                  <span className="welcome-step-title">Tạo đoạn chat mới</span>
                  <span className="welcome-step-desc">Tạo một cuộc hội thoại ở menu lịch sử bên trái để bắt đầu.</span>
                </div>
                <div className="welcome-step-card">
                  <span className="welcome-step-num">Bước 2</span>
                  <span className="welcome-step-title">Tải PDF & Trò chuyện</span>
                  <span className="welcome-step-desc">Tải tài liệu PDF ở cột quản lý tài liệu bên phải dành riêng cho đoạn chat đó.</span>
                </div>
              </div>

              {/* Feature highlights */}
              <div className="welcome-features">
                <div className="welcome-feature-item">
                  <span className="welcome-feature-icon">🔬</span>
                  <span className="welcome-feature-text">Sơ đồ tư duy tự động</span>
                </div>
                <div className="welcome-feature-item">
                  <span className="welcome-feature-icon">⚔️</span>
                  <span className="welcome-feature-text">Tranh biện đa chiều</span>
                </div>
                <div className="welcome-feature-item">
                  <span className="welcome-feature-icon">📍</span>
                  <span className="welcome-feature-text">Truy vết trích dẫn thông minh</span>
                </div>
              </div>

              <p className="welcome-desc" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px' }}>
                Hãy hỏi ví dụ: <i>"Tác động của lạm phát đến tăng trưởng kinh tế"</i>
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className="message-wrapper">
                  <div className={`message-bubble ${msg.isError ? 'error' : ''}`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <>
                        <div style={{ whiteSpace: 'pre-line' }}>
                          {renderMessageContent(msg.content, msg.citations)}
                        </div>

                        {/* Feature 1: Hypothesis Map (Mindmap) */}
                        {msg.hypothesis_map && (
                          <MindmapView data={msg.hypothesis_map} />
                        )}

                        {/* Feature 2: Multi-Perspective Debate */}
                        {msg.debate && (
                          <DebateView data={msg.debate} />
                        )}
                        
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="citations-container">
                            <div className="citations-title">
                              <Quote size={12} />
                              <span>Tài liệu trích dẫn ({msg.citations.length})</span>
                            </div>
                            <div className="citations-list">
                              {msg.citations.map((cit, idx) => (
                                <DeepCitationPopup key={idx} citation={cit} token={token}>
                                  <div className="citation-chip">
                                    <FileText size={12} className="doc-icon" />
                                    <span>{cit.source.replace(/\.[pP][dD][fF]$/, '')} (Trang {cit.page})</span>
                                    {cit.has_page_image && (
                                      <span className="citation-has-preview" title="Có xem trước trang PDF">📄</span>
                                    )}
                                  </div>
                                </DeepCitationPopup>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span className="message-time">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="loading-row">
              <div className="loading-bubble">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-container">
          <form onSubmit={onSubmit} className="chat-input-form">
            <input
              type="text"
              className="chat-input"
              placeholder={
                isLoading 
                  ? "AI đang suy nghĩ và trích dẫn tài liệu..." 
                  : activeThreadId === null 
                    ? "Vui lòng chọn hoặc tạo đoạn chat mới để bắt đầu hỏi..."
                    : "Hỏi về các bài báo khoa học đã tải lên..."
              }
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={isLoading || activeThreadId === null}
            />
            <button type="submit" className="btn-send" disabled={isLoading || !inputValue.trim() || activeThreadId === null}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>



      {/* Right Side Thread Document Library - Only visible when an active chat is selected */}
      {activeThreadId !== null && (
        <div className="thread-documents-panel">
          <div className="sidebar-section-title" style={{ marginBottom: '16px' }}>
            <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--primary)" /> Tài liệu của đoạn chat
            </span>
          </div>

          {/* Search Documents within Thread */}
          <div className="form-group" style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Tìm kiếm tài liệu..."
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

          {/* Documents Count & Reindex */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>Số lượng: <strong>{documents.length}</strong> tệp tin</span>
            {documents.length > 0 && (
              <button
                onClick={onReindex}
                disabled={isReindexing}
                title="Cập nhật chỉ mục tài liệu (re-index)"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: isReindexing ? 'wait' : 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: isReindexing ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                <RefreshCw size={12} style={{ animation: isReindexing ? 'spin 1s linear infinite' : 'none' }} />
                <span>{isReindexing ? 'Đang chỉ mục...' : 'Cập nhật chỉ mục'}</span>
              </button>
            )}
          </div>

          {/* Document list */}
          <div className="document-list" style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <div key={doc.filename} className="document-item" style={{ marginBottom: '8px' }}>
                  <div className="doc-info">
                    <FileText size={16} className="doc-icon" />
                    <div className="doc-details">
                      <span className="doc-name" title={doc.title} style={{ fontSize: '12.5px' }}>
                        {doc.title}
                      </span>
                      <span className="doc-meta" style={{ fontSize: '10.5px' }}>
                        {doc.filename.length > 25 ? `${doc.filename.substring(0, 22)}...` : doc.filename} • {doc.total_pages} trang
                      </span>
                    </div>
                  </div>
                  <button
                    className="doc-delete-btn"
                    onClick={() => onDelete(doc.filename)}
                    title="Xóa tài liệu"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            ) : (
              <div className="no-docs" style={{ padding: '30px 10px', fontSize: '12.5px' }}>
                Chưa có tài liệu nào cho đoạn chat này.<br />Hãy kéo thả hoặc tải tệp PDF lên bên dưới.
              </div>
            )}
          </div>

          {/* Upload Zone */}
          <div style={{ marginTop: 'auto' }}>
            <UploadZone onUploadFiles={onUploadFiles} isUploading={isUploading} uploadProgress={uploadProgress} />
          </div>
        </div>
      )}
    </div>
  );
};
