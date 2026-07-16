import React, { useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';

interface AuthScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string, fullName: string, phone: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [mockOtpHint, setMockOtpHint] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setMockOtpHint('');

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setError('Vui lòng điền số điện thoại.');
      return;
    }

    const phoneRegex = /^[0-9]{9,11}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      setError('Số điện thoại không hợp lệ (phải gồm 9 đến 11 chữ số).');
      return;
    }

    if (isRegister && !fullName.trim()) {
      setError('Vui lòng nhập họ tên người dùng.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/auth/send-otp', {
        phone: trimmedPhone,
        is_register: isRegister
      });
      setIsOtpSent(true);
      setInfoMessage(`Mã OTP đã được gửi thành công tới số ${trimmedPhone}!`);
      // Show mock OTP to user using a browser alert box
      if (response.data.otp) {
        alert(`Mã OTP mẫu của bạn là: ${response.data.otp}`);
      }
    } catch (err: any) {
      console.error('Send OTP error', err);
      const errMsg = err.response?.data?.detail || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const trimmedPhone = phone.trim();
    const trimmedName = fullName.trim();
    const trimmedOtp = otp.trim();

    if (!trimmedPhone || !trimmedOtp) {
      setError('Vui lòng điền đầy đủ thông tin xác thực.');
      return;
    }

    if (trimmedOtp.length !== 6) {
      setError('Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        // Verify OTP Register
        const res = await axios.post('/api/auth/verify-otp-register', {
          phone: trimmedPhone,
          full_name: trimmedName,
          otp: trimmedOtp
        });
        onLoginSuccess(res.data.token, res.data.full_name, res.data.phone);
        handleCloseModal();
      } else {
        // Verify OTP Login
        const res = await axios.post('/api/auth/verify-otp-login', {
          phone: trimmedPhone,
          otp: trimmedOtp
        });
        onLoginSuccess(res.data.token, res.data.full_name, res.data.phone);
        handleCloseModal();
      }
    } catch (err: any) {
      console.error('Verify OTP error', err);
      const errMsg = err.response?.data?.detail || 'Mã OTP không chính xác hoặc đã hết hạn.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => {
    // Reset states on close
    setPhone('');
    setFullName('');
    setOtp('');
    setIsOtpSent(false);
    setMockOtpHint('');
    setError('');
    setInfoMessage('');
    onClose();
  };

  return (
    <div className="modal-overlay auth-modal-overlay">
      <div className="auth-card modal-content" style={{ position: 'relative' }}>
        <button 
          className="modal-close-btn" 
          onClick={handleCloseModal} 
          disabled={isLoading}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className="auth-logo-container">
            <img src="/logo.png" alt="Logo" className="auth-logo-img" />
          </div>
          <p className="auth-subtitle">Sử dụng mã OTP qua SMS để đăng nhập an toàn</p>
        </div>

        <form onSubmit={handleSubmitVerify} className="auth-form">
          <h2 className="auth-form-title">{isRegister ? 'Đăng ký tài khoản OTP' : 'Đăng nhập bằng OTP'}</h2>
          
          {error && <div className="auth-error">{error}</div>}
          {infoMessage && <div className="auth-success" style={{ color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: '500' }}>{infoMessage}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Số điện thoại</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="tel"
                id="phone"
                className="form-input"
                placeholder="Nhập số điện thoại (ví dụ: 0912345678)..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading || isOtpSent}
                style={{ flex: 1 }}
                required
              />
              {!isOtpSent && (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  style={{ padding: '0 16px', whiteSpace: 'nowrap', fontSize: '12px', borderRadius: 'var(--radius-md)' }}
                >
                  {isLoading ? 'Đang gửi...' : 'Gửi mã OTP'}
                </button>
              )}
            </div>
          </div>

          {isRegister && (
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Họ tên người dùng</label>
              <input
                type="text"
                id="fullName"
                className="form-input"
                placeholder="Nhập họ tên của bạn..."
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading || isOtpSent}
                required
              />
            </div>
          )}

          {isOtpSent && (
            <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
              <label className="form-label" htmlFor="otp">Nhập mã OTP (6 chữ số)</label>
              <input
                type="text"
                id="otp"
                className="form-input"
                placeholder=""
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={isLoading}
                style={{ fontSize: '18px', textAlign: 'center', letterSpacing: '6px', fontWeight: '700' }}
                required
              />
            </div>
          )}

          {isOtpSent && (
            <button type="submit" className="btn btn-primary btn-auth" disabled={isLoading}>
              {isLoading ? 'Đang xác minh...' : (isRegister ? 'Xác nhận & Đăng ký' : 'Xác nhận & Đăng nhập')}
            </button>
          )}
        </form>

        <div className="auth-footer">
          <span>{isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}</span>
          <button 
            type="button" 
            className="auth-link-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setInfoMessage('');
              setPhone('');
              setFullName('');
              setOtp('');
              setIsOtpSent(false);
              setMockOtpHint('');
            }}
            disabled={isLoading}
          >
            {isRegister ? 'Đăng nhập bằng mã OTP' : 'Đăng ký tài khoản mới'}
          </button>
        </div>
      </div>
    </div>
  );
};
