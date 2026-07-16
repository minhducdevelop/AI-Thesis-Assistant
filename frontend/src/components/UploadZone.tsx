import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadZoneProps {
  onUploadFiles: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadProgress?: { current: number; total: number; fileName: string };
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUploadFiles, isUploading, uploadProgress }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const filterPdfFiles = (fileList: FileList): File[] => {
    const pdfFiles: File[] = [];
    const rejected: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        pdfFiles.push(file);
      } else {
        rejected.push(file.name);
      }
    }

    if (rejected.length > 0) {
      alert(`Các tệp sau không phải PDF và đã bị bỏ qua:\n${rejected.join('\n')}`);
    }

    return pdfFiles;
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (isUploading) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const pdfFiles = filterPdfFiles(files);
      if (pdfFiles.length > 0) {
        await onUploadFiles(pdfFiles);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;
    
    const files = e.target.files;
    if (files && files.length > 0) {
      const pdfFiles = filterPdfFiles(files);
      if (pdfFiles.length > 0) {
        await onUploadFiles(pdfFiles);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileSelect = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileSelect}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        multiple
        style={{ display: 'none' }}
      />
      
      {isUploading && uploadProgress ? (
        <>
          <div className="uploading-spinner" />
          <span className="upload-text">
            Đang tải lên ({uploadProgress.current}/{uploadProgress.total})
          </span>
          <span className="upload-subtext" style={{ wordBreak: 'break-all', textAlign: 'center' }}>
            {uploadProgress.fileName}
          </span>
          <div className="upload-progress-bar">
            <div 
              className="upload-progress-fill"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <UploadCloud size={28} className="upload-icon" />
          <span className="upload-text">Tải lên tài liệu PDF</span>
          <span className="upload-subtext">Kéo thả hoặc click để chọn một hoặc nhiều file</span>
        </>
      )}
    </div>
  );
};
