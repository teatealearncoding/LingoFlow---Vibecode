
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Flashcard, Difficulty, User } from './types';
import { processArticle, playPronunciation, summarizeArticle, getSuggestedMaterial } from './services/geminiService';
import { initializeCard, scheduleReview } from './services/srsService';

// --- User-Scoped Storage Keys ---
const STORAGE_KEYS = {
  SESSION: 'lingoflow_active_session',
  INPUT: (uid: string) => `lingoflow_input_${uid}`,
  SUMMARY: (uid: string) => `lingoflow_summary_${uid}`,
  SUGGESTIONS: 'lingoflow_global_suggestions',
  SUGGESTIONS_TS: 'lingoflow_suggestions_ts'
};

// --- API Helper ---
const api = {
  async request(path: string, method = 'GET', body?: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'API Error');
    }
    return res.json();
  }
};

// --- UI Components ---

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
  <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center space-y-6">
    <div className="relative">
      <div className="w-16 h-16 border-2 border-[#00F3FF]/20 rounded-full"></div>
      <div className="w-16 h-16 border-t-2 border-[#00F3FF] rounded-full animate-spin absolute top-0 left-0"></div>
    </div>
    <p className="text-[#00F3FF] font-mono tracking-[0.3em] text-xs uppercase animate-pulse">{message}</p>
  </div>
);

const Navbar: React.FC<{ user: User | null; onLogout: () => void }> = ({ user, onLogout }) => (
  <nav className="fixed top-0 left-0 w-full z-40 border-b border-white/5 bg-black/60 backdrop-blur-xl">
    <div className="max-w-5xl mx-auto px-8 h-20 flex items-center justify-between">
      <Link to="/" className="text-2xl font-black tracking-tighter text-white group">
        LINGO<span className="text-[#00F3FF] group-hover:text-[#39FF14] transition-colors duration-500">FLOW</span>
      </Link>
      <div className="flex items-center space-x-10">
        <div className="hidden md:flex space-x-10 text-[10px] font-black uppercase tracking-[0.2em]">
          <Link to="/" className="text-white/40 hover:text-white transition-colors">Process</Link>
          <Link to="/study" className="text-white/40 hover:text-white transition-colors">Study</Link>
          <Link to="/bank" className="text-white/40 hover:text-white transition-colors">Bank</Link>
        </div>
        {user && (
          <div className="flex items-center space-x-6 pl-6 border-l border-white/10">
            <span className="text-[9px] font-mono text-[#00F3FF] uppercase tracking-widest hidden sm:inline">{user.email.split('@')[0]}</span>
            <button onClick={onLogout} className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500/60 hover:text-red-500 transition-colors">Logout</button>
          </div>
        )}
      </div>
    </div>
  </nav>
);

// --- Auth Page ---

const AuthPage: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please provide both email and password.");
      return;
    }

    try {
      const path = isLogin ? '/api/auth/login' : '/api/auth/register';
      const data = await api.request(path, 'POST', { email, password });
      onLogin({ ...data.user, token: data.token });
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black">
      <div className="max-w-md w-full space-y-12">
        <div className="text-center">
          <h2 className="text-5xl font-black tracking-tighter uppercase mb-4">{isLogin ? 'Welcome Back' : 'Create Identity'}</h2>
          <p className="text-white/30 text-[10px] font-mono tracking-[0.3em] uppercase">Sync your progress across all devices</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="email" 
            placeholder="EMAIL ADDRESS" 
            required
            value={email} 
            onChange={e => { setEmail(e.target.value); setError(null); }} 
            className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl text-white focus:outline-none focus:border-[#00F3FF]/50 text-xs font-mono tracking-widest transition-all" 
          />
          <input 
            type="password" 
            placeholder="PASSWORD" 
            required
            value={password} 
            onChange={e => { setPassword(e.target.value); setError(null); }} 
            className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl text-white focus:outline-none focus:border-[#00F3FF]/50 text-xs font-mono tracking-widest transition-all" 
          />
          
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-5 bg-white text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-[#00F3FF] active:scale-[0.98] transition-all text-xs shadow-xl"
          >
            {isLogin ? 'Authorize Access' : 'Initialize Vault'}
          </button>
        </form>

        <button 
          onClick={() => { setIsLogin(!isLogin); setError(null); }} 
          className="w-full text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors"
        >
          {isLogin ? "Need a new account? Register Identity" : "Already registered? Log In to Vault"}
        </button>
      </div>
    </div>
  );
};

// --- Pages ---

const Home: React.FC<{ user: User }> = ({ user }) => {
  const [input, setInput] = useState(() => localStorage.getItem(STORAGE_KEYS.INPUT(user.id)) || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<string | null>(() => localStorage.getItem(STORAGE_KEYS.SUMMARY(user.id)));
  const [suggestions, setSuggestions] = useState<any[]>(() => {
    const cached = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INPUT(user.id), input);
  }, [input, user.id]);

  useEffect(() => {
    if (summary) localStorage.setItem(STORAGE_KEYS.SUMMARY(user.id), summary);
    else localStorage.removeItem(STORAGE_KEYS.SUMMARY(user.id));
  }, [summary, user.id]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const cachedTs = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS_TS);
      const isExpired = !cachedTs || (Date.now() - parseInt(cachedTs)) > 24 * 60 * 60 * 1000;
      if (suggestions.length > 0 && !isExpired) return;
      setIsLoadingSuggestions(true);
      try {
        const data = await getSuggestedMaterial();
        setSuggestions(data);
        localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(data));
        localStorage.setItem(STORAGE_KEYS.SUGGESTIONS_TS, Date.now().toString());
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, []);

  const handleProcess = async (directContent?: string) => {
    const targetInput = directContent || input;
    if (!targetInput.trim()) return;
    setIsProcessing(true);
    try {
      const result = await processArticle(targetInput, targetInput.startsWith('http') ? targetInput : 'Pasted Text');
      
      // Fetch existing cards from API to merge
      const existing: Flashcard[] = await api.request('/api/cards', 'GET', undefined, user.token);
      
      const newCards = result.words.map((w: any) => initializeCard(w, result.title, user.id));
      
      const merged = [...existing];
      const added: Flashcard[] = [];
      newCards.forEach((newCard: Flashcard) => {
        const exists = merged.find(c => c.word.toLowerCase() === newCard.word.toLowerCase());
        if (!exists) {
          merged.push(newCard);
          added.push(newCard);
        }
      });

      // Sync new cards to backend
      if (added.length > 0) {
        await api.request('/api/cards/sync', 'POST', { cards: added }, user.token);
      }

      setInput('');
      navigate('/bank');
    } catch (err) {
      console.error(err);
      alert("Extraction failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSummarize = async (directUrl?: string) => {
    const target = directUrl || input;
    if (!target.trim()) return;
    setIsProcessing(true);
    try {
      const text = await summarizeArticle(target);
      setSummary(text);
    } catch (err) {
      console.error(err);
      alert("Summarization failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = async (idx: number) => {
    // Remove from the full pool
    const newPool = [...suggestions];
    newPool.splice(idx, 1);
    setSuggestions(newPool);
    
    // Update cache
    localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(newPool));

    // If pool is getting low, fetch more in the background
    if (newPool.length < 2) {
      setIsLoadingSuggestions(true);
      try {
        const data = await getSuggestedMaterial();
        // Filter out any we already have
        const filtered = data.filter((item: any) => !newPool.find(s => s.url === item.url));
        const merged = [...newPool, ...filtered];
        setSuggestions(merged);
        localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(merged));
        localStorage.setItem(STORAGE_KEYS.SUGGESTIONS_TS, Date.now().toString());
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }
  };

  return (
    <div className="min-h-screen pt-36 px-6 max-w-3xl mx-auto flex flex-col items-center pb-32">
      {isProcessing && <LoadingOverlay message="Running AI Analysis..." />}
      
      {summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0a0a0a] border border-white/10 p-8 md:p-12 rounded-[2rem] max-w-2xl w-full relative shadow-2xl animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
            <button onClick={() => setSummary(null)} className="absolute top-6 right-6 p-2 text-white/40 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-[#39FF14] text-[10px] font-black uppercase tracking-[0.3em] mb-6">Article Insights</h3>
            <div className="flex-grow overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10">
              <div className="text-white/80 space-y-4 text-lg font-light leading-relaxed whitespace-pre-line">{summary}</div>
            </div>
            <div className="flex gap-4 mt-8">
               <button onClick={() => setSummary(null)} className="flex-1 py-4 bg-[#39FF14]/10 border border-[#39FF14]/20 text-[#39FF14] font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-[#39FF14]/20 transition-all">Keep Reading</button>
               <button onClick={() => setSummary(null)} className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-white/10 transition-all">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center space-y-6 mb-16">
        <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9] uppercase">Master the <span className="text-white/20">Advanced</span><br/><span className="text-[#00F3FF]">English Flow.</span></h1>
        <p className="text-white/40 font-light text-lg max-w-lg mx-auto leading-relaxed">Persistently store and master high-level vocabulary from premium sources.</p>
      </div>

      <div className="w-full space-y-6 mb-20">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00F3FF] to-[#39FF14] rounded-3xl blur opacity-10 group-focus-within:opacity-25 transition duration-1000"></div>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Paste URL or text content here..." 
            className="relative w-full h-24 bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 text-white focus:outline-none focus:border-[#00F3FF]/50 transition-all resize-none text-xl font-light" 
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <button onClick={() => handleProcess()} disabled={!input.trim()} className="flex-1 py-5 bg-white text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-[#00F3FF] transition-all disabled:opacity-30 text-xs shadow-[0_20px_40px_rgba(255,255,255,0.05)]">Generate Flashcards</button>
          <button onClick={() => handleSummarize()} disabled={!input.trim()} className="md:w-1/3 py-5 bg-black border border-white/10 text-[#39FF14] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-[#39FF14]/10 transition-all disabled:opacity-30 text-xs">Summarize</button>
        </div>
      </div>

      <div className="w-full space-y-10">
        <div className="flex items-center space-x-4">
          <div className="h-px flex-grow bg-white/10"></div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Suggested Material</h2>
          <div className="h-px flex-grow bg-white/10"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoadingSuggestions && suggestions.length === 0 ? (
            [0, 1].map((i) => (
              <div key={i} className="h-48 bg-white/5 border border-white/5 rounded-3xl animate-pulse"></div>
            ))
          ) : (
            suggestions.slice(0, 2).map((item, idx) => (
              <div key={idx} className="bg-[#0a0a0a] border border-white/5 p-8 rounded-3xl hover:border-[#39FF14]/30 transition-all group flex flex-col justify-between shadow-lg">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-[9px] font-black text-[#39FF14] uppercase tracking-widest">{item.source}</p>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-[#00F3FF] transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </div>
                  <h4 className="text-xl font-bold tracking-tight text-white mb-3 group-hover:text-[#39FF14] transition-colors line-clamp-2">
                    <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                  </h4>
                  <p className="text-white/40 text-sm leading-relaxed mb-6 line-clamp-3 font-light">{item.summary}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleProcess(item.url)} className="flex-grow py-4 bg-white/5 hover:bg-[#39FF14] hover:text-black border border-white/10 text-white font-black uppercase tracking-[0.2em] text-[9px] rounded-xl transition-all">Flashcards</button>
                  <button onClick={() => handleSummarize(item.url)} className="flex-grow py-4 bg-black border border-white/10 text-[#39FF14] font-black uppercase tracking-[0.2em] text-[9px] rounded-xl hover:bg-[#39FF14]/10 transition-all">Summarize</button>
                  <button onClick={() => handleDismiss(idx)} className="px-4 py-4 bg-black border border-white/10 text-red-500/60 hover:text-red-500 font-black uppercase tracking-[0.2em] text-[9px] rounded-xl hover:bg-red-500/10 transition-all">Dismiss</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const Bank: React.FC<{ user: User }> = ({ user }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const data = await api.request('/api/cards', 'GET', undefined, user.token);
        setCards(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCards();
  }, [user.id, user.token]);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `lingoflow_vault_${user.id}.json`);
    dlAnchor.click();
  };

  return (
    <div className="min-h-screen pt-36 px-8 max-w-5xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <h2 className="text-5xl font-black tracking-tighter uppercase">Vault</h2>
          <p className="text-[#00F3FF] text-xs font-mono mt-3 uppercase tracking-[0.2em] font-bold">{cards.length} Terms in Secure Storage</p>
        </div>
        <button onClick={handleExport} className="text-[10px] font-black uppercase tracking-[0.2em] text-[#39FF14] border border-[#39FF14]/20 px-4 py-2 rounded-lg">Backup Vault</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div key={card.id} className="bg-[#0a0a0a] border border-white/5 p-8 rounded-3xl hover:border-[#00F3FF]/30 transition-all duration-500">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black bg-white/10 text-white/60 px-2 py-0.5 rounded tracking-widest uppercase">{card.difficulty}</span>
                <h4 className="text-2xl font-bold text-white group-hover:text-[#00F3FF] transition-colors">{card.word}</h4>
                <p className="text-white/30 text-xs font-mono">{card.pronunciation}</p>
              </div>
              <button onClick={() => playPronunciation(card.word)} className="p-3 bg-white/5 hover:bg-[#00F3FF]/20 rounded-full text-[#00F3FF] transition-all"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg></button>
            </div>
            <p className="text-white/80 font-semibold mb-4 text-lg border-l-2 border-[#00F3FF] pl-4">{card.vietnameseMeaning}</p>
            <p className="text-white/30 text-sm italic font-light">"{card.context}"</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const Study: React.FC<{ user: User }> = ({ user }) => {
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const all = await api.request('/api/cards', 'GET', undefined, user.token);
        setAllCards(all);
        setDueCards(all.filter((c: Flashcard) => c.due <= Date.now()).sort(() => Math.random() - 0.5));
      } catch (err) {
        console.error(err);
      }
    };
    fetchCards();
  }, [user.id, user.token]);

  const handleRate = async (rating: Difficulty) => {
    const card = dueCards[currentIndex];
    const updated = scheduleReview(card, rating);
    
    try {
      // Sync updated card to backend
      await api.request('/api/cards/sync', 'POST', { cards: [updated] }, user.token);
      
      // Update local state
      setAllCards(prev => prev.map(c => c.id === card.id ? updated : c));
      
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
    } catch (err) {
      console.error(err);
      alert("Failed to sync progress.");
    }
  };

  const getDueTodayCount = () => {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return allCards.filter(c => c.due <= endOfDay.getTime()).length;
  };

  // Dashboard View (Màn hình đề xuất ôn tập)
  if (!isStarted) {
    const dueToday = getDueTodayCount();
    const dueNow = dueCards.length;

    return (
      <div className="min-h-screen pt-36 px-6 max-w-xl mx-auto flex flex-col items-center justify-center pb-32">
        <div className="w-full space-y-12 text-center">
          <div className="space-y-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#00F3FF]">Daily Review Forecast</h2>
            <h1 className="text-5xl font-black tracking-tighter uppercase">Your Study <span className="text-white/20">Flow</span></h1>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0a0a0a] border border-white/5 p-10 rounded-[2rem] space-y-2">
              <p className="text-5xl font-black text-[#00F3FF] tracking-tighter">{dueNow}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Due Now</p>
            </div>
            <div className="bg-[#0a0a0a] border border-white/5 p-10 rounded-[2rem] space-y-2">
              <p className="text-5xl font-black text-[#39FF14] tracking-tighter">{dueToday}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Due Today</p>
            </div>
          </div>

          <div className="pt-6">
            {dueNow > 0 ? (
              <button 
                onClick={() => setIsStarted(true)} 
                className="w-full py-6 bg-white text-black font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-[#00F3FF] transition-all text-xs shadow-2xl"
              >
                Start Learning Flow
              </button>
            ) : (
              <div className="space-y-6">
                <p className="text-white/40 text-sm font-light">Your vault is currently synchronized. All pending cards are mastered for this moment.</p>
                <Link to="/" className="inline-block px-12 py-5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Process New Article</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (dueCards.length === 0 || currentIndex >= dueCards.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center space-y-8">
        <h2 className="text-5xl font-black uppercase">Session Mastered</h2>
        <p className="text-white/30 max-w-sm">History synced. Come back for the next flow cycle.</p>
        <Link to="/" className="px-16 py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-[10px]">Back Home</Link>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];

  return (
    <div className="min-h-screen pt-32 px-6 max-w-xl mx-auto flex flex-col items-center pb-20">
      <div className="w-full flex justify-between items-center mb-10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
        <span>Stack: {currentIndex + 1} / {dueCards.length}</span>
        <span className="text-[#00F3FF]">Stage {currentCard.reps}</span>
      </div>
      <div onClick={() => !isFlipped && setIsFlipped(true)} className={`w-full aspect-[4/5] relative transition-all duration-700 cursor-pointer ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
        <div className="absolute inset-0 bg-[#0a0a0a] border-2 border-white/5 rounded-[2.5rem] p-12 flex flex-col items-center justify-center [backface-visibility:hidden] shadow-2xl">
          <h3 className="text-5xl font-black text-white text-center">{currentCard.word}</h3>
          <p className="mt-4 text-[#00F3FF] font-mono text-sm tracking-widest">{currentCard.pronunciation}</p>
        </div>
        <div className="absolute inset-0 bg-[#00F3FF] text-black rounded-[2.5rem] p-12 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-xl">
          <div className="w-full space-y-10">
            <h4 className="text-3xl font-black">{currentCard.vietnameseMeaning}</h4>
            <div className="bg-black/5 p-6 rounded-2xl"><p className="text-lg italic font-medium">"{currentCard.context}"</p></div>
          </div>
        </div>
      </div>
      <div className={`w-full grid grid-cols-4 gap-4 mt-16 transition-all duration-700 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20 pointer-events-none'}`}>
        {[Difficulty.AGAIN, Difficulty.HARD, Difficulty.GOOD, Difficulty.EASY].map((val) => (
          <button key={val} onClick={() => handleRate(val)} className="py-6 border border-white/10 bg-white/5 rounded-2xl text-[10px] font-black uppercase active:scale-95 transition-all hover:bg-white/10">
            {Difficulty[val]}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- App Root ---

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
  };

  return (
    <Router>
      <div className="bg-black min-h-screen text-white selection:bg-[#00F3FF] selection:text-black">
        <Navbar user={user} onLogout={handleLogout} />
        <main>
          <Routes>
            <Route path="/auth" element={<AuthPage onLogin={handleLogin} />} />
            <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/auth" />} />
            <Route path="/study" element={user ? <Study user={user} /> : <Navigate to="/auth" />} />
            <Route path="/bank" element={user ? <Bank user={user} /> : <Navigate to="/auth" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
