import React, { useState } from 'react';
import { GitBranch, ChevronDown, ChevronRight } from 'lucide-react';
import { HypothesisMap, HypothesisMapBranch } from '../types';

interface MindmapViewProps {
  data: HypothesisMap;
}

// Color scheme for entity types - vibrant and distinct
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  organism:  { bg: 'rgba(16, 185, 129, 0.1)',  border: '#10b981', text: '#059669', icon: '🧬' },
  chemical:  { bg: 'rgba(245, 158, 11, 0.1)',  border: '#f59e0b', text: '#d97706', icon: '⚗️' },
  process:   { bg: 'rgba(139, 92, 246, 0.1)',  border: '#8b5cf6', text: '#7c3aed', icon: '⚙️' },
  organ:     { bg: 'rgba(236, 72, 153, 0.1)',  border: '#ec4899', text: '#db2777', icon: '🌿' },
  effect:    { bg: 'rgba(59, 130, 246, 0.1)',   border: '#3b82f6', text: '#2563eb', icon: '💫' },
  condition: { bg: 'rgba(234, 179, 8, 0.1)',    border: '#eab308', text: '#ca8a04', icon: '🌡️' },
  method:    { bg: 'rgba(20, 184, 166, 0.1)',   border: '#14b8a6', text: '#0d9488', icon: '🔬' },
  result:    { bg: 'rgba(239, 68, 68, 0.1)',    border: '#ef4444', text: '#dc2626', icon: '📊' },
};

const getTypeStyle = (type: string) => {
  return TYPE_COLORS[type] || { bg: 'rgba(99, 102, 241, 0.1)', border: '#6366f1', text: '#4f46e5', icon: '📌' };
};

const MindmapNode: React.FC<{ 
  branch: HypothesisMapBranch; 
  depth: number;
  isLast?: boolean;
}> = ({ branch, depth, isLast = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const style = getTypeStyle(branch.type);
  const hasChildren = branch.children && branch.children.length > 0;

  return (
    <div className="mindmap-node-container" style={{ 
      marginLeft: depth > 0 ? '24px' : '0',
      position: 'relative'
    }}>
      {/* Connection line */}
      {depth > 0 && (
        <div className="mindmap-connector" style={{
          position: 'absolute',
          left: '-16px',
          top: '0',
          width: '16px',
          height: isLast ? '20px' : '100%',
          borderLeft: `2px solid ${style.border}40`,
          borderBottom: `2px solid ${style.border}40`,
          borderBottomLeftRadius: '8px',
        }} />
      )}

      {/* Relation label (arrow label between nodes) */}
      {branch.relation && depth > 0 && (
        <div className="mindmap-relation" style={{
          fontSize: '10px',
          color: style.text,
          fontWeight: 600,
          padding: '1px 6px',
          background: style.bg,
          borderRadius: '4px',
          display: 'inline-block',
          marginBottom: '4px',
          marginLeft: depth > 0 ? '4px' : '0',
          letterSpacing: '0.3px',
        }}>
          ↳ {branch.relation}
        </div>
      )}

      {/* Node card */}
      <div 
        className="mindmap-node"
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: style.bg,
          border: `1.5px solid ${style.border}30`,
          borderRadius: '10px',
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          marginBottom: '6px',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: '14px' }}>{style.icon}</span>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 600, 
          color: style.text,
          flex: 1,
        }}>
          {branch.label}
        </span>
        <span style={{
          fontSize: '9px',
          color: style.text,
          opacity: 0.7,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          fontWeight: 700,
          padding: '2px 6px',
          background: `${style.border}15`,
          borderRadius: '4px',
        }}>
          {branch.type}
        </span>
        {hasChildren && (
          isExpanded 
            ? <ChevronDown size={14} color={style.text} /> 
            : <ChevronRight size={14} color={style.text} />
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mindmap-children" style={{
          animation: 'mindmapExpand 0.25s ease-out',
        }}>
          {branch.children!.map((child, idx) => (
            <MindmapNode 
              key={`${child.label}-${idx}`} 
              branch={child} 
              depth={depth + 1}
              isLast={idx === branch.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MindmapView: React.FC<MindmapViewProps> = ({ data }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!data || !data.branches || data.branches.length === 0) {
    return null;
  }

  return (
    <div className="mindmap-container">
      <div className="mindmap-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GitBranch size={15} />
          <span className="mindmap-title">Sơ đồ tư duy giả thuyết</span>
        </div>
        <span className="mindmap-toggle">
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </span>
      </div>
      
      {!isCollapsed && (
        <div className="mindmap-body">
          {/* Center node */}
          <div className="mindmap-center-node">
            <span className="mindmap-center-icon">🎯</span>
            <span className="mindmap-center-label">{data.center}</span>
          </div>

          {/* Branch tree */}
          <div className="mindmap-tree">
            {data.branches.map((branch, idx) => (
              <MindmapNode 
                key={`${branch.label}-${idx}`} 
                branch={branch} 
                depth={0}
                isLast={idx === data.branches.length - 1}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mindmap-legend">
            {Object.entries(TYPE_COLORS).map(([type, style]) => (
              <span key={type} className="mindmap-legend-item" style={{
                background: style.bg,
                border: `1px solid ${style.border}30`,
                color: style.text,
              }}>
                {style.icon} {type}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
