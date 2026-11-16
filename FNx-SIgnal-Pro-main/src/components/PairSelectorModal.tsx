import React, { useState } from 'react';
import { X, Check, SlidersHorizontal, Search, Globe, Zap } from 'lucide-react';

interface PairSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPairs: string[];
  onSavePairs: (pairs: string[]) => void;
}

const REAL_PAIRS = [
  { id: 'EURUSD', name: 'EUR/USD', type: 'real' },
  { id: 'GBPUSD', name: 'GBP/USD', type: 'real' },
  { id: 'USDJPY', name: 'USD/JPY', type: 'real' },
  { id: 'AUDUSD', name: 'AUD/USD', type: 'real' },
  { id: 'USDCAD', name: 'USD/CAD', type: 'real' },
  { id: 'NZDUSD', name: 'NZD/USD', type: 'real' },
  { id: 'USDCHF', name: 'USD/CHF', type: 'real' },
  { id: 'EURGBP', name: 'EUR/GBP', type: 'real' },
  { id: 'EURJPY', name: 'EUR/JPY', type: 'real' },
  { id: 'GBPJPY', name: 'GBP/JPY', type: 'real' },
  { id: 'AUDJPY', name: 'AUD/JPY', type: 'real' },
  { id: 'EURAUD', name: 'EUR/AUD', type: 'real' },
  { id: 'CADJPY', name: 'CAD/JPY', type: 'real' },
  { id: 'EURCAD', name: 'EUR/CAD', type: 'real' },
  { id: 'GBPAUD', name: 'GBP/AUD', type: 'real' },
  { id: 'EURCHF', name: 'EUR/CHF', type: 'real' },
  { id: 'GBPCHF', name: 'GBP/CHF', type: 'real' },
  { id: 'CHFJPY', name: 'CHF/JPY', type: 'real' },
  { id: 'AUDCAD', name: 'AUD/CAD', type: 'real' },
  { id: 'AUDNZD', name: 'AUD/NZD', type: 'real' },
  { id: 'NZDJPY', name: 'NZD/JPY', type: 'real' },
  { id: 'CADCHF', name: 'CAD/CHF', type: 'real' },
  { id: 'EURNZD', name: 'EUR/NZD', type: 'real' },
  { id: 'GBPNZD', name: 'GBP/NZD', type: 'real' },
  { id: 'AUDCHF', name: 'AUD/CHF', type: 'real' },
];

const OTC_PAIRS = [
  { id: 'EURUSD_otc', name: 'EUR/USD (OTC)', type: 'otc' },
  { id: 'GBPUSD_otc', name: 'GBP/USD (OTC)', type: 'otc' },
  { id: 'USDJPY_otc', name: 'USD/JPY (OTC)', type: 'otc' },
  { id: 'AUDCAD_otc', name: 'AUD/CAD (OTC)', type: 'otc' },
  { id: 'NZDUSD_otc', name: 'NZD/USD (OTC)', type: 'otc' },
  { id: 'USDCAD_otc', name: 'USD/CAD (OTC)', type: 'otc' },
  { id: 'EURGBP_otc', name: 'EUR/GBP (OTC)', type: 'otc' },
  { id: 'EURJPY_otc', name: 'EUR/JPY (OTC)', type: 'otc' },
  { id: 'GBPJPY_otc', name: 'GBP/JPY (OTC)', type: 'otc' },
  { id: 'AUDUSD_otc', name: 'AUD/USD (OTC)', type: 'otc' },
  { id: 'USDCHF_otc', name: 'USD/CHF (OTC)', type: 'otc' },
  { id: 'AUDJPY_otc', name: 'AUD/JPY (OTC)', type: 'otc' },
];

export const PairSelectorModal: React.FC<PairSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedPairs,
  onSavePairs,
}) => {
  const [activeTab, setActiveTab] = useState<'real' | 'otc'>('real');
  const [currentSelection, setCurrentSelection] = useState<string[]>(selectedPairs);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const listToDisplay = activeTab === 'real' ? REAL_PAIRS : OTC_PAIRS;

  const togglePair = (id: string) => {
    if (currentSelection.includes(id)) {
      setCurrentSelection(currentSelection.filter((p) => p !== id));
    } else {
      setCurrentSelection([...currentSelection, id]);
    }
  };

  const handleSelectAllTab = () => {
    const tabIds = listToDisplay.map((p) => p.id);
    const merged = Array.from(new Set([...currentSelection, ...tabIds]));
    setCurrentSelection(merged);
  };

  const handleClearAll = () => {
    setCurrentSelection([]);
  };

  const handleApply = () => {
    onSavePairs(currentSelection);
    onClose();
  };

  const filteredPairs = listToDisplay.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-[#1c1c24] border border-[#282834] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282834] bg-[#131316]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-[#7c6cef]" />
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">Target Pairs Filter</h3>
              <p className="text-xs text-[#9e9eb0]">Select Real Forex or Quotex OTC pairs to analyze</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9e9eb0] hover:text-white hover:bg-[#1c1c24] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Page Tab Switcher (Page 1: Real Market | Page 2: Quotex OTC) */}
        <div className="px-4 pt-3 pb-2 border-b border-[#282834] bg-[#131316]/60 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('real')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'real'
                ? 'bg-[#7c6cef] text-white shadow-md'
                : 'bg-[#1c1c24] text-[#9e9eb0] hover:text-white border border-[#282834]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Page 1: Real Market ({REAL_PAIRS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('otc')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'otc'
                ? 'bg-[#7c6cef] text-white shadow-md'
                : 'bg-[#1c1c24] text-[#9e9eb0] hover:text-white border border-[#282834]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Page 2: Quotex OTC ({OTC_PAIRS.length})</span>
          </button>
        </div>

        {/* Action Controls & Search */}
        <div className="p-3.5 border-b border-[#282834] flex flex-wrap items-center justify-between gap-3 bg-[#131316]/40">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllTab}
              className="px-3 py-1.5 rounded-lg bg-[#1c1c24] border border-[#282834] hover:border-[#7c6cef] text-xs font-semibold text-white transition-all cursor-pointer"
            >
              Select All ({activeTab === 'real' ? 'Real' : 'OTC'})
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-lg bg-[#131316] border border-[#282834] hover:text-rose-400 text-xs font-semibold text-[#9e9eb0] transition-all cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#9e9eb0] absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search pair..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#131316] border border-[#282834] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#9e9eb0]/50 focus:outline-none focus:border-[#7c6cef] w-40 sm:w-48"
            />
          </div>
        </div>

        {/* Pairs Checkbox Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
          {filteredPairs.map((pair) => {
            const isSelected = currentSelection.includes(pair.id);
            return (
              <div
                key={pair.id}
                onClick={() => togglePair(pair.id)}
                className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#7c6cef]/15 border-[#7c6cef] text-white shadow-sm'
                    : 'bg-[#131316] border-[#282834] text-[#9e9eb0] hover:text-white hover:border-[#7c6cef]/40'
                }`}
              >
                <span className="font-bold text-xs">{pair.name}</span>
                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                    isSelected ? 'bg-[#7c6cef] border-[#7c6cef]' : 'border-[#282834] bg-[#1c1c24]'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#282834] flex items-center justify-between bg-[#131316]">
          <span className="text-xs font-mono text-[#9e9eb0]">
            {currentSelection.length === 0
              ? 'Default: Scanning All Pairs'
              : `Active Filter: ${currentSelection.length} Selected`}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#9e9eb0] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-[#7c6cef] hover:bg-[#6956e5] text-white text-xs font-bold shadow-md shadow-[#7c6cef]/20 transition-all cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};