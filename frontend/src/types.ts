export interface Document {
  filename: string;
  title: string;
  total_pages: number;
}

export interface Citation {
  source: string;
  title: string;
  page: number;
  content_preview: string;
  has_page_image?: boolean;
}

// Feature 1: Auto-Hypothesis Mapping (Sơ đồ tư duy giả thuyết)
export interface HypothesisMapBranch {
  label: string;
  type: 'organism' | 'chemical' | 'process' | 'organ' | 'effect' | 'condition' | 'method' | 'result' | string;
  relation?: string;
  children?: HypothesisMapBranch[];
}

export interface HypothesisMap {
  center: string;
  branches: HypothesisMapBranch[];
}

// Feature 2: Multi-Perspective Debate (Tranh biện đa chiều)
export interface DebatePerspective {
  stance: 'thuận' | 'phản biện' | 'bổ sung' | 'hạn chế' | string;
  source: string;
  page: number;
  claim: string;
  evidence: string;
  strength?: 'mạnh' | 'trung bình' | 'yếu' | string;
}

export interface Debate {
  perspectives: DebatePerspective[];
  synthesis: string;
  research_gaps?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  hypothesis_map?: HypothesisMap | null;
  debate?: Debate | null;
  timestamp: Date;
  isError?: boolean;
}

export interface UserSettings {
  provider: 'gemini' | 'openai';
  gemini_api_key: string;
  openai_api_key: string;
}
