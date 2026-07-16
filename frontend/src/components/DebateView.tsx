import React, { useState } from 'react';
import { Swords, ChevronDown, ChevronRight, FileText, Shield, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Debate, DebatePerspective } from '../types';

interface DebateViewProps {
  data: Debate;
}

const STANCE_CONFIG: Record<string, { 
  color: string; bg: string; border: string; icon: React.ReactNode; label: string 
}> = {
  'thuận': { 
    color: '#059669', bg: 'rgba(16, 185, 129, 0.06)', border: 'rgba(16, 185, 129, 0.3)', 
    icon: <Shield size={14} />, label: 'Góc nhìn thuận' 
  },
  'phản biện': { 
    color: '#dc2626', bg: 'rgba(239, 68, 68, 0.06)', border: 'rgba(239, 68, 68, 0.3)', 
    icon: <Swords size={14} />, label: 'Góc nhìn phản biện' 
  },
  'bổ sung': { 
    color: '#2563eb', bg: 'rgba(59, 130, 246, 0.06)', border: 'rgba(59, 130, 246, 0.3)', 
    icon: <Plus size={14} />, label: 'Bổ sung' 
  },
  'hạn chế': { 
    color: '#d97706', bg: 'rgba(245, 158, 11, 0.06)', border: 'rgba(245, 158, 11, 0.3)', 
    icon: <AlertTriangle size={14} />, label: 'Hạn chế' 
  },
};

const getStanceConfig = (stance: string) => {
  const key = stance.toLowerCase();
  return STANCE_CONFIG[key] || STANCE_CONFIG['bổ sung'];
};

const STRENGTH_COLORS: Record<string, string> = {
  'mạnh': '#059669',
  'trung bình': '#d97706',
  'yếu': '#9ca3af',
};

const PerspectiveCard: React.FC<{ perspective: DebatePerspective; index: number }> = ({ perspective, index }) => {
  const config = getStanceConfig(perspective.stance);
  
  return (
    <div 
      className="debate-card" 
      style={{
        background: config.bg,
        borderLeft: `4px solid ${config.border}`,
        borderRadius: '0 12px 12px 0',
        padding: '16px 18px',
        animation: `debateSlideIn 0.3s ease-out ${index * 0.1}s both`,
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: config.color }}>{config.icon}</span>
          <span style={{ 
            fontSize: '11px', fontWeight: 700, color: config.color, 
            textTransform: 'uppercase', letterSpacing: '0.5px' 
          }}>
            {config.label}
          </span>
        </div>
        {perspective.strength && (
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: STRENGTH_COLORS[perspective.strength] || '#9ca3af',
            padding: '2px 8px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.04)',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}>
            {perspective.strength}
          </span>
        )}
      </div>

      {/* Claim */}
      <p style={{ 
        fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', 
        marginBottom: '8px', lineHeight: 1.5 
      }}>
        {perspective.claim}
      </p>

      {/* Evidence */}
      <p style={{ 
        fontSize: '12.5px', color: 'var(--text-secondary)', 
        lineHeight: 1.6, fontStyle: 'italic',
        paddingLeft: '12px',
        borderLeft: `2px solid ${config.border}`,
        marginBottom: '10px',
      }}>
        "{perspective.evidence}"
      </p>

      {/* Source */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <FileText size={12} style={{ color: config.color, opacity: 0.7 }} />
        <span style={{ 
          fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 
        }}>
          {perspective.source.replace(/\.[pP][dD][fF]$/, '')} — Trang {perspective.page}
        </span>
      </div>
    </div>
  );
};

export const DebateView: React.FC<DebateViewProps> = ({ data }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!data || !data.perspectives || data.perspectives.length === 0) {
    return null;
  }

  // Group perspectives by stance
  const proViews = data.perspectives.filter(p => 
    ['thuận', 'bổ sung'].includes(p.stance.toLowerCase())
  );
  const conViews = data.perspectives.filter(p => 
    ['phản biện', 'hạn chế'].includes(p.stance.toLowerCase())
  );
  // Any uncategorized goes to pro
  const otherViews = data.perspectives.filter(p => 
    !['thuận', 'bổ sung', 'phản biện', 'hạn chế'].includes(p.stance.toLowerCase())
  );

  return (
    <div className="debate-container">
      <div className="debate-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Swords size={15} />
          <span className="debate-title-text">Tranh biện đa chiều</span>
          <span className="debate-count">
            {data.perspectives.length} góc nhìn
          </span>
        </div>
        <span className="debate-toggle">
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>

      {!isCollapsed && (
        <div className="debate-body">
          {/* Two-column layout for pro vs con */}
          <div className="debate-columns">
            {/* Pro column */}
            <div className="debate-column">
              <div className="debate-column-header debate-pro-header">
                <Shield size={14} />
                <span>Thuận / Bổ sung</span>
              </div>
              <div className="debate-cards">
                {[...proViews, ...otherViews].map((p, idx) => (
                  <PerspectiveCard key={`pro-${idx}`} perspective={p} index={idx} />
                ))}
                {proViews.length === 0 && otherViews.length === 0 && (
                  <div className="debate-empty">Không tìm thấy góc nhìn thuận</div>
                )}
              </div>
            </div>

            {/* Con column */}
            <div className="debate-column">
              <div className="debate-column-header debate-con-header">
                <Minus size={14} />
                <span>Phản biện / Hạn chế</span>
              </div>
              <div className="debate-cards">
                {conViews.map((p, idx) => (
                  <PerspectiveCard key={`con-${idx}`} perspective={p} index={idx} />
                ))}
                {conViews.length === 0 && (
                  <div className="debate-empty">Không tìm thấy góc nhìn phản biện</div>
                )}
              </div>
            </div>
          </div>

          {/* Synthesis section */}
          {data.synthesis && (
            <div className="debate-synthesis">
              <div className="debate-synthesis-label">🔬 Tổng hợp & Nhận xét</div>
              <p className="debate-synthesis-text">{data.synthesis}</p>
            </div>
          )}

          {/* Research gaps */}
          {data.research_gaps && (
            <div className="debate-research-gaps">
              <div className="debate-gaps-label">🔍 Khoảng trống nghiên cứu</div>
              <p className="debate-gaps-text">{data.research_gaps}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
