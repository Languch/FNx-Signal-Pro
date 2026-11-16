/**
 * FNx Signal Pro - Pure Python Selenium Bridge Terminal
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SignalEvent, SignalStats, QuotexSession, VoiceLanguage, DataSourceMode, PureAnalysisResult } from './types/trading';
import { evaluatePureConfluence, buildCandlesFromTicks } from './utils/signalEngine';
import { SignalHeader } from './components/SignalHeader';
import { ActiveSignalCard } from './components/ActiveSignalCard';
import { TradeCounterBar } from './components/TradeCounterBar';
import { SignalHistoryFeed } from './components/SignalHistoryFeed';
import { TradeResultModal } from './components/TradeResultModal';
import { QuotexBridgeHookModal } from './components/QuotexBridgeHookModal';
import { TelegramBotModal } from './components/TelegramBotModal';
import { MartingaleCalculatorModal } from './components/MartingaleCalculatorModal';
import { PairSelectorModal } from './components/PairSelectorModal';
import { LandingPage } from './components/LandingPage';
import { CheckCircle, AlertCircle, Zap, LogOut } from 'lucide-react';

export default function App() {
  const [hasLicense, setHasLicense] = useState<boolean>(() => Boolean(localStorage.getItem('fnx_vip_license')));

  const [showQuotexModal, setShowQuotexModal] = useState<boolean>(false);
  const [showTelegramModal, setShowTelegramModal] = useState<boolean>(false);
  const [showMtgModal, setShowMtgModal] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);

  const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
  const [tradeForOutcomeModal, setTradeForOutcomeModal] = useState<SignalEvent | null>(null);
  const [minPayout, setMinPayout] = useState<number>(80);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>('en');

  const [session, setSession] = useState<QuotexSession>({
    isConnected: false,
    sourceMode: 'websocket',
    wsUrl: '',
    accountType: 'demo',
    ssid: '',
    maskedToken: '',
    balance: 10000.0,
    latencyMs: 0,
  });

  const [liveAsset, setLiveAsset] = useState<string>('');
  const [livePrice, setLivePrice] = useState<number | undefined>(undefined);
  const [bridgeStatus, setBridgeStatus] = useState<'live' | 'waiting' | 'disconnected'>('waiting');
  const [, setPriceHistory] = useState<{ price: number; time: number }[]>([]);
  const [pureAnalysis, setPureAnalysis] = useState<PureAnalysisResult | null>(null);

  const [activeSignal, setActiveSignal] = useState<SignalEvent | null>(null);
  const [preAlert, setPreAlert] = useState<SignalEvent | null>(null);
  const [signalsFeed, setSignalsFeed] = useState<SignalEvent[]>([]);
  const [stats, setStats] = useState<SignalStats>({
    totalSignals: 0,
    wins: 0,
    losses: 0,
    mtgWins: 0,
    accuracy: 0,
    consecutiveLosses: 0,
    antiLossCircuitStatus: 'STANDBY',
  });

  const clearedBeforeRef = useRef<number>(0);
  const lockedCandleMinuteRef = useRef<number>(-1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fnx_cleared_time');
      if (saved) clearedBeforeRef.current = parseInt(saved, 10);
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasLicense) return;
    fetch('/api/signals/live')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const filtered = (data.recentSignals || []).filter(
            (sig: SignalEvent) => sig.createdTime > clearedBeforeRef.current
          );
          setSignalsFeed(filtered);
          if (data.stats && clearedBeforeRef.current === 0) setStats(data.stats);
        }
      })
      .catch(() => {});
  }, [hasLicense]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  };

  // Web Audio API Beep Alert
  const playBeepAlert = useCallback((type: 'pre_alert' | 'CALL' | 'PUT') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'CALL') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      } else if (type === 'PUT') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      }

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, [soundEnabled]);

  const speakVoice = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [voiceEnabled]);

  // =========================================================================
  // 🐍 PYTHON SELENIUM BRIDGE POLLING (http://localhost:5000/api/live-price)
  // =========================================================================
  useEffect(() => {
    if (!hasLicense || session.sourceMode !== 'selenium') return;

    const pollSelenium = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/live-price');
        if (!res.ok) throw new Error('Offline');
        const data = await res.json();

        if (data.status === 'live' && typeof data.price === 'number' && data.price > 0) {
          setBridgeStatus('live');
          setLiveAsset(data.asset || 'QUOTEX');
          setLivePrice(data.price);

          const now = Date.now();
          setPriceHistory((prev) => {
            const updated = [...prev, { price: data.price, time: now }].slice(-1200);

            // Closed candles only (Anti-Repainting)
            const closedCandles = buildCandlesFromTicks(updated, 15);
            const result = evaluatePureConfluence(closedCandles, data.asset);
            setPureAnalysis(result);

            const minuteKey = Math.floor(now / 60000);
            const sec = Math.floor((now % 60000) / 1000);

            if ((result.direction === 'CALL' || result.direction === 'PUT') && sec <= 10 && lockedCandleMinuteRef.current !== minuteKey) {
              lockedCandleMinuteRef.current = minuteKey;

              const newSig: SignalEvent = {
                id: `sel_${now}`,
                assetId: data.asset,
                assetName: data.asset,
                marketType: data.asset.toLowerCase().includes('otc') ? 'otc' : 'real',
                direction: result.direction,
                timeframe: '1M',
                durationSeconds: 60,
                confidence: result.confidence,
                strategy: result.strategy,
                reason: result.reason,
                entryPrice: data.price,
                createdTime: now,
                entryTime: now,
                expireTime: now + 60000,
                status: 'active',
                payout: 85,
                martingaleStep: 0,
                confluenceFactors: result.confluenceFactors,
              };

              setActiveSignal(newSig);
              playBeepAlert(result.direction);
              speakVoice(`Signal. ${data.asset}, ${result.direction}`);
              showToast(`Fresh Signal: ${data.asset} ${result.direction}`, 'success');

              // Save to server DB & send to Telegram VIP
              fetch('/api/signals/register-selenium', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signal: newSig }),
              }).catch(() => {});
            }
            return updated;
          });
        } else {
          setBridgeStatus('waiting');
        }
      } catch {
        setBridgeStatus('disconnected');
      }
    };

    const timer = setInterval(pollSelenium, 1000);
    return () => clearInterval(timer);
  }, [hasLicense, session.sourceMode, playBeepAlert, speakVoice]);

  // Trade expiration watcher in Selenium Mode -> Open Manual Outcome Modal
  useEffect(() => {
    if (session.sourceMode !== 'selenium' || !activeSignal) return;
    const check = setInterval(() => {
      if (Date.now() >= activeSignal.expireTime) {
        const finished = { ...activeSignal };
        setSignalsFeed((prev) => [finished, ...prev]);
        setTradeForOutcomeModal(finished);
        setActiveSignal(null);
      }
    }, 500);
    return () => clearInterval(check);
  }, [session.sourceMode, activeSignal]);

  // Mode 2: WebSocket polling fallback
  const lastTrackedActiveRef = useRef<SignalEvent | null>(null);
  const lastAnnouncedPreAlertIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasLicense || session.sourceMode !== 'websocket') return;

    const pollBackend = async () => {
      try {
        const res = await fetch('/api/signals/live');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setBridgeStatus(data.wsConnectionStatus === 'CONNECTED' ? 'live' : 'waiting');

            if (lastTrackedActiveRef.current && !data.activeSignal) {
              setTradeForOutcomeModal(lastTrackedActiveRef.current);
            }
            lastTrackedActiveRef.current = data.activeSignal;

            setActiveSignal(data.activeSignal);
            setPreAlert(data.upcomingPreAlert);
            
            if (data.liveAsset) setLiveAsset(data.liveAsset);
            if (data.livePrice) setLivePrice(data.livePrice);
            if (data.pureAnalysis) setPureAnalysis(data.pureAnalysis);

            if (data.currentPrice) setLivePrice(data.currentPrice);

            const filteredSignals = (data.recentSignals || []).filter(
              (sig: SignalEvent) => sig.createdTime > clearedBeforeRef.current
            );
            setSignalsFeed(filteredSignals);
            
            if (data.stats && clearedBeforeRef.current === 0) setStats(data.stats);
            if (data.minPayoutThreshold) setMinPayout(data.minPayoutThreshold);

            if (data.upcomingPreAlert && data.upcomingPreAlert.id !== lastAnnouncedPreAlertIdRef.current) {
              lastAnnouncedPreAlertIdRef.current = data.upcomingPreAlert.id;
              playBeepAlert(data.upcomingPreAlert.direction);
              speakVoice(`Signal. ${data.upcomingPreAlert.assetName}, ${data.upcomingPreAlert.direction}`);
            }
          }
        }
      } catch {}
    };

    const timer = setInterval(pollBackend, 1000);
    return () => clearInterval(timer);
  }, [hasLicense, session.sourceMode, playBeepAlert, speakVoice]);

  const handleSaveSession = async (
    wsUrl: string,
    ssid: string,
    accountType: 'demo' | 'real',
    sourceMode: DataSourceMode
  ) => {
    const res = await fetch('/api/quotex/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wsUrl, ssid, accountType, sourceMode }),
    });
    const data = await res.json();
    if (data.success) {
      setSession({
        isConnected: true,
        sourceMode,
        wsUrl,
        accountType,
        ssid,
        maskedToken: ssid ? ssid.slice(0, 4) + '...' : 'live',
        balance: accountType === 'demo' ? 10000 : 1000,
        latencyMs: 20,
      });
      showToast(data.message, 'success');
    } else {
      throw new Error(data.error || 'Connection failed');
    }
  };

  const handleClearHistory = async () => {
    const now = Date.now();
    clearedBeforeRef.current = now;
    try { localStorage.setItem('fnx_cleared_time', now.toString()); } catch {}
    setSignalsFeed([]);
    showToast('History cleared!', 'info');
    fetch('/api/signals/clear-history', { method: 'POST' }).catch(() => {});
  };

  const handleSavePairFilter = async (pairs: string[]) => {
    setSelectedPairs(pairs);
    showToast(pairs.length === 0 ? 'Scanning All Pairs' : `Filtering ${pairs.length} Pairs`, 'info');
    fetch('/api/signals/pair-filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs }),
    }).catch(() => {});
  };

  const handleSubmitOutcome = async (signalId: string, outcome: 'win' | 'loss' | 'mtg_win' | 'refund' | 'avoided') => {
    setSignalsFeed((prev) => prev.map((s) => (s.id === signalId ? { ...s, status: outcome } : s)));
    try {
      const res = await fetch('/api/signals/submit-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, outcome }),
      });
      const data = await res.json();
      if (data.success && data.stats) setStats(data.stats);
      showToast(`Outcome (${outcome.toUpperCase()}) recorded!`, 'success');
    } catch {}
  };

  const handleChangeMinPayout = async (payout: number) => {
    setMinPayout(payout);
    showToast(`Min Payout set to ${payout}%`, 'info');
    fetch('/api/signals/payout-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minPayout: payout }),
    }).catch(() => {});
  };

  const handleCopySignal = (sig: SignalEvent) => {
    navigator.clipboard.writeText(`📊 FNx SIGNAL PRO 📊\nAsset: ${sig.assetName}\nAction: ${sig.direction}\nConfluence: ${sig.confidence}%`);
    showToast('Signal copied!', 'success');
  };

  if (!hasLicense) {
    return <LandingPage onUnlockApp={() => setHasLicense(true)} />;
  }

  return (
    <div className="h-screen w-screen bg-[#131316] text-white flex flex-col overflow-hidden font-sans select-none">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex-1">
          <SignalHeader
            stats={stats}
            minPayout={minPayout}
            onChangeMinPayout={handleChangeMinPayout}
            selectedPairsCount={selectedPairs.length}
            onOpenPairModal={() => setShowPairModal(true)}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
            voiceLang={voiceLang}
            onToggleVoiceLang={() => setVoiceLang(voiceLang === 'bn' ? 'en' : 'bn')}
            isQuotexConnected={bridgeStatus === 'live'}
            onOpenQuotexModal={() => setShowQuotexModal(true)}
            onOpenTelegramModal={() => setShowTelegramModal(true)}
            onOpenMtgModal={() => setShowMtgModal(true)}
          />
        </div>

        <div className="bg-[#131316]/95 border-b border-[#282834] py-3 pr-6">
          <button
            onClick={() => {
              localStorage.removeItem('fnx_vip_license');
              setHasLicense(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c1c24] border border-rose-500/30 hover:border-rose-500 text-xs font-bold text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lockout</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg shadow-2xl text-xs font-medium border border-[#282834] bg-[#1c1c24]/95 text-white backdrop-blur animate-in fade-in">
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Zap className="w-4 h-4 text-[#7c6cef] shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1200px] mx-auto p-3 sm:p-4 flex flex-col gap-2.5 min-h-0 overflow-hidden">
        <div className="shrink-0">
          <ActiveSignalCard
            activeSignal={activeSignal}
            preAlert={preAlert}
            liveAsset={liveAsset}
            livePrice={livePrice}
            bridgeStatus={bridgeStatus}
            pureAnalysis={pureAnalysis}
            selectedPairsCount={selectedPairs.length}
            onCopySignal={handleCopySignal}
          />
        </div>

        <TradeCounterBar signals={signalsFeed} />

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <SignalHistoryFeed
            signals={signalsFeed}
            onCopySignal={handleCopySignal}
            onClearHistory={handleClearHistory}
            onOverrideResult={(id, outcome) => handleSubmitOutcome(id, outcome)}
          />
        </div>
      </main>

      <PairSelectorModal
        isOpen={showPairModal}
        onClose={() => setShowPairModal(false)}
        selectedPairs={selectedPairs}
        onSavePairs={handleSavePairFilter}
      />

      <TradeResultModal
        isOpen={Boolean(tradeForOutcomeModal)}
        signal={tradeForOutcomeModal}
        onClose={() => setTradeForOutcomeModal(null)}
        onSubmitResult={handleSubmitOutcome}
      />

      <QuotexBridgeHookModal
        isOpen={showQuotexModal}
        onClose={() => setShowQuotexModal(false)}
        session={session}
        onSaveSession={handleSaveSession}
        isLoading={false}
      />

      <TelegramBotModal isOpen={showTelegramModal} onClose={() => setShowTelegramModal(false)} />
      <MartingaleCalculatorModal isOpen={showMtgModal} onClose={() => setShowMtgModal(false)} />
    </div>
  );
}