import React, { useState } from 'react';
import { QuotexSession, DataSourceMode } from '../types/trading';
import { X, Key, Globe, Cpu, Wifi } from 'lucide-react';

interface QuotexBridgeHookModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: QuotexSession;
  onSaveSession: (wsUrl: string, ssid: string, accountType: 'demo' | 'real', sourceMode: DataSourceMode) => Promise<void>;
  isLoading: boolean;
}

export const QuotexBridgeHookModal: React.FC<QuotexBridgeHookModalProps> = ({
  isOpen,
  onClose,
  session,
  onSaveSession,
  isLoading,
}) => {
  const [sourceMode, setSourceMode] = useState<DataSourceMode>(session.sourceMode || 'selenium');
  const [wsUrlInput, setWsUrlInput] = useState(session.wsUrl || '');
  const [ssidInput, setSsidInput] = useState(session.ssid || '');
  const [accountType, setAccountType] = useState<'demo' | 'real'>(session.accountType);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (sourceMode === 'websocket') {
      if (!wsUrlInput.trim() || (!wsUrlInput.startsWith('wss://') && !wsUrlInput.startsWith('ws://'))) {
        setErrorMsg('Please enter a valid Quotex WebSocket URL starting with wss://');
        return;
      }
    }

    try {
      await onSaveSession(wsUrlInput.trim(), ssidInput.trim(), accountType, sourceMode);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-[#1c1c24] border border-[#282834] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282834] bg-[#131316]">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-5 h-5 text-[#7c6cef]" />
            <h3 className="text-base font-bold text-white tracking-wide">Live Data Bridge Session</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9e9eb0] hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} className="p-6 space-y-4">
          {/* Source Mode Switcher */}
          <div>
            <label className="text-xs font-medium text-[#9e9eb0] block mb-2">Live Data Source</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSourceMode('selenium')}
                className={`py-3 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sourceMode === 'selenium'
                    ? 'bg-[#7c6cef]/15 border-[#7c6cef] text-white'
                    : 'bg-[#131316] border-[#282834] text-[#9e9eb0] hover:text-white'
                }`}
              >
                <Cpu className="w-4 h-4 text-[#7c6cef]" />
                <span>Python Selenium (Port 5000)</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceMode('websocket')}
                className={`py-3 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sourceMode === 'websocket'
                    ? 'bg-[#7c6cef]/15 border-[#7c6cef] text-white'
                    : 'bg-[#131316] border-[#282834] text-[#9e9eb0] hover:text-white'
                }`}
              >
                <Globe className="w-4 h-4 text-[#7c6cef]" />
                <span>Dynamic WebSocket URL</span>
              </button>
            </div>
          </div>

          {sourceMode === 'websocket' ? (
            <>
              {/* Dynamic WebSocket URL Input (Not Hardcoded) */}
              <div>
                <label className="text-xs font-medium text-[#9e9eb0] block mb-1.5">
                  Quotex WebSocket URL (Session Only)
                </label>
                <input
                  type="text"
                  placeholder="wss://ws2.market-qx.info/socket.io/?EIO=3&transport=websocket"
                  value={wsUrlInput}
                  onChange={(e) => setWsUrlInput(e.target.value)}
                  className="w-full bg-[#131316] border border-[#282834] rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#7c6cef] transition-colors"
                />
              </div>

              {/* SSID Input */}
              <div>
                <label className="text-xs font-medium text-[#9e9eb0] block mb-1.5">
                  Quotex Session SSID (Optional for Quotes, Required for Auth)
                </label>
                <input
                  type="text"
                  placeholder="Paste your Quotex ssid cookie..."
                  value={ssidInput}
                  onChange={(e) => setSsidInput(e.target.value)}
                  className="w-full bg-[#131316] border border-[#282834] rounded-lg px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#7c6cef] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('demo')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    accountType === 'demo'
                      ? 'bg-[#7c6cef]/15 border-[#7c6cef] text-white'
                      : 'bg-[#131316] border-[#282834] text-[#9e9eb0]'
                  }`}
                >
                  Demo Account
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('real')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    accountType === 'real'
                      ? 'bg-[#7c6cef]/15 border-[#7c6cef] text-white'
                      : 'bg-[#131316] border-[#282834] text-[#9e9eb0]'
                  }`}
                >
                  Real Account
                </button>
              </div>
            </>
          ) : (
            <div className="p-4 rounded-lg bg-[#131316] border border-[#282834] text-xs text-[#9e9eb0] space-y-1.5">
              <div className="text-white font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Polling: http://localhost:5000/api/live-price
              </div>
              <p>Run <code className="text-[#7c6cef]">python quotex_reader.py</code> in terminal. The bot will read real live DOM prices every 500ms directly from your Quotex browser.</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#282834]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#9e9eb0] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-[#7c6cef] hover:bg-[#6956e5] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {sourceMode === 'websocket' ? 'Save URL & Start Session' : 'Activate Selenium Bridge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};