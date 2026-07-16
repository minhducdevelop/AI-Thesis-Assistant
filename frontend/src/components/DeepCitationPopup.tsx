import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExternalLink, FileText, Image, Loader } from 'lucide-react';
import { Citation } from '../types';

interface DeepCitationPopupProps {
  citation: Citation;
  children: React.ReactNode;
  token?: string | null;
}

// Simple in-memory cache for page images to avoid repeated API calls
const imageCache: Record<string, string> = {};

export const DeepCitationPopup: React.FC<DeepCitationPopupProps> = ({ citation, children, token }) => {
  const [isHovering, setIsHovering] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('top');
  const containerRef = useRef<HTMLSpanElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate popup position to avoid viewport overflow
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const popupHeight = 340; // Estimated popup height
    
    if (spaceAbove < popupHeight + 20) {
      setPopupPosition('bottom');
    } else {
      setPopupPosition('top');
    }
  }, []);

  // Load page image on hover (with delay to prevent flickering)
  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(true);
      calculatePosition();

      // Only load if the citation has page image support
      if (citation.has_page_image && !imageUrl && !isLoading) {
        const cacheKey = `${citation.source}:${citation.page}`;
        
        if (imageCache[cacheKey]) {
          setImageUrl(imageCache[cacheKey]);
          return;
        }

        setIsLoading(true);
        setImageError(false);
        
        // Build API URL with authentication
        let url = `/api/documents/page-image/${encodeURIComponent(citation.source)}/${citation.page}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error('Failed to load image');
            return res.blob();
          })
          .then(blob => {
            const objectUrl = URL.createObjectURL(blob);
            imageCache[cacheKey] = objectUrl;
            setImageUrl(objectUrl);
            setIsLoading(false);
          })
          .catch(() => {
            setImageError(true);
            setIsLoading(false);
          });
      }
    }, 300); // 300ms delay before showing popup
  }, [citation, imageUrl, isLoading, token, calculatePosition]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovering(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <span
      ref={containerRef}
      className="deep-citation-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline' }}
    >
      {children}

      {isHovering && (
        <div 
          className={`deep-citation-popup ${popupPosition}`}
          style={{
            position: 'absolute',
            [popupPosition === 'top' ? 'bottom' : 'top']: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
          }}
        >
          {/* Popup arrow */}
          <div className={`deep-citation-arrow ${popupPosition}`} />

          {/* Header */}
          <div className="deep-citation-popup-header">
            <FileText size={13} />
            <span className="deep-citation-popup-filename">
              {citation.title || citation.source.replace(/\.[pP][dD][fF]$/, '')}
            </span>
            <span className="deep-citation-popup-page">Trang {citation.page}</span>
          </div>

          {/* Page image or text preview */}
          <div className="deep-citation-popup-content">
            {citation.has_page_image && (
              <div className="deep-citation-image-container">
                {isLoading && (
                  <div className="deep-citation-loading">
                    <Loader size={16} className="deep-citation-spinner" />
                    <span>Đang tải trang PDF...</span>
                  </div>
                )}
                {imageUrl && !isLoading && (
                  <img 
                    src={imageUrl} 
                    alt={`${citation.source} - Trang ${citation.page}`}
                    className="deep-citation-page-image"
                  />
                )}
                {imageError && !isLoading && (
                  <div className="deep-citation-error">
                    <Image size={16} />
                    <span>Không thể tải ảnh trang</span>
                  </div>
                )}
              </div>
            )}

            {/* Text preview always shown */}
            <div className="deep-citation-text-preview">
              <div className="deep-citation-text-label">📌 Trích dẫn gốc:</div>
              <div className="deep-citation-text-content">
                "{citation.content_preview}"
              </div>
            </div>
          </div>

          {/* Footer with action */}
          <div className="deep-citation-popup-footer">
            <a 
              href={`/api/documents/view/${encodeURIComponent(citation.source)}${token ? `?token=${encodeURIComponent(token)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="deep-citation-open-btn"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
              <span>Mở trang PDF</span>
            </a>
          </div>
        </div>
      )}
    </span>
  );
};
