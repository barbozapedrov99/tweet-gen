import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TweetCard } from './components/TweetCard';
import { DEFAULT_TWEET_DATA } from './constants';
import { TweetData } from './types';
import { editImageWithGemini } from './services/geminiService';
import { Wand2, Loader2, Upload, AlertCircle, Download, Undo, Redo } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const App: React.FC = () => {
  // State
  const [tweetData, setTweetData] = useState<TweetData>(DEFAULT_TWEET_DATA);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History State for Undo/Redo
  const [history, setHistory] = useState<TweetData[]>([]);
  const [redoStack, setRedoStack] = useState<TweetData[]>([]);
  
  // Scale State
  const [scale, setScale] = useState(0.5);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Used to track value before editing started (for text inputs)
  const preEditStateRef = useRef<TweetData | null>(null);

  // --- Font Loading ---
  useEffect(() => {
    const loadFonts = async () => {
      try {
        const response = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        const css = await response.text();
        const style = document.createElement('style');
        style.innerHTML = css;
        document.head.appendChild(style);
      } catch (e) {
        console.error("Failed to load fonts", e);
      }
    };
    loadFonts();
  }, []);

  // --- Dynamic Scaling ---
  useEffect(() => {
    const calculateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const cardWidth = 1080;
        const cardHeight = 1440;
        const padding = 64; // Padding around the card

        const scaleX = (containerWidth - padding) / cardWidth;
        const scaleY = (containerHeight - padding) / cardHeight;

        // Use the smaller scale to ensure it fits, capping at 1.0 (actual size) or slightly larger if needed, 
        // but typically 1.0 is enough for 1080p width. 
        // Allowing > 1.0 if screen is huge (4k)
        const newScale = Math.min(scaleX, scaleY);
        
        setScale(newScale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    
    // ResizeObserver handles container size changes (e.g. if sidebar changes)
    const observer = new ResizeObserver(calculateScale);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', calculateScale);
      observer.disconnect();
    };
  }, []);

  // --- History Management ---

  const saveToHistory = useCallback((prevState: TweetData) => {
    setHistory(prev => [...prev, prevState]);
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  const handleUndo = () => {
    if (history.length === 0) return;
    
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setRedoStack(prev => [tweetData, ...prev]); // Save current to redo
    setTweetData(previousState);
    setHistory(newHistory);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[0];
    const newRedo = redoStack.slice(1);

    setHistory(prev => [...prev, tweetData]); // Save current to history
    setTweetData(nextState);
    setRedoStack(newRedo);
  };

  // --- Input Handlers ---

  const handleInputChange = (field: keyof TweetData, value: string) => {
    setTweetData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputFocus = () => {
    preEditStateRef.current = { ...tweetData };
  };

  const handleInputBlur = (field: keyof TweetData) => {
    if (preEditStateRef.current && preEditStateRef.current[field] !== tweetData[field]) {
      saveToHistory(preEditStateRef.current);
    }
    preEditStateRef.current = null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      saveToHistory(tweetData);
      const reader = new FileReader();
      reader.onloadend = () => {
        setTweetData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Gemini AI ---

  const handleGeminiEdit = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt for the AI.");
      return;
    }

    if (!tweetData.avatarUrl.startsWith('data:')) {
         setError("Please upload an image first to edit it with AI.");
         return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      saveToHistory(tweetData);
      const newAvatarBase64 = await editImageWithGemini(tweetData.avatarUrl, prompt);
      setTweetData(prev => ({ ...prev, avatarUrl: newAvatarBase64 }));
      setPrompt(''); 
    } catch (err: any) {
      setError(err.message || "Failed to edit image. Try a different prompt.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (previewRef.current) {
      try {
        const options = {
            quality: 0.95, 
            backgroundColor: '#ffffff',
            width: 1080,
            height: 1440,
            pixelRatio: 1, 
            style: {
                transform: 'none', // Critical: Ignore the on-screen scale
                transformOrigin: 'top left',
                margin: '0',
            },
            filter: (node: HTMLElement) => {
              return node.tagName !== 'LINK';
            }
        };

        const dataUrl = await htmlToImage.toJpeg(previewRef.current, options);
        
        const link = document.createElement('a');
        const ext = 'jpg';
        link.download = `tweet-post-${Date.now()}.${ext}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error('Download failed', err);
        setError("Failed to generate image download.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col md:flex-row text-slate-100 font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Left Side: Controls & AI */}
      <div className="w-full md:w-[400px] lg:w-[450px] p-6 border-r border-slate-700 flex flex-col gap-8 overflow-y-auto h-screen custom-scrollbar shrink-0 z-10 bg-slate-900">
        
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              TweetGen AI
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Create viral posts. Edit avatar with Gemini.
            </p>
          </div>
          
          <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button 
              onClick={handleUndo} 
              disabled={history.length === 0}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 rounded transition-all"
              title="Undo"
            >
              <Undo size={18} />
            </button>
            <div className="w-px bg-slate-700 my-1"></div>
            <button 
              onClick={handleRedo} 
              disabled={redoStack.length === 0}
              className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700 rounded transition-all"
              title="Redo"
            >
              <Redo size={18} />
            </button>
          </div>
        </header>

        {/* Basic Fields */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tweet Details</h2>
          
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Display Name</label>
            <input 
              type="text" 
              value={tweetData.displayName}
              onFocus={handleInputFocus}
              onBlur={() => handleInputBlur('displayName')}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Handle (@)</label>
            <input 
              type="text" 
              value={tweetData.handle}
              onFocus={handleInputFocus}
              onBlur={() => handleInputBlur('handle')}
              onChange={(e) => handleInputChange('handle', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Content</label>
            <textarea 
              value={tweetData.content}
              onFocus={handleInputFocus}
              onBlur={() => handleInputBlur('content')}
              onChange={(e) => handleInputChange('content', e.target.value)}
              rows={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
            />
          </div>
        </section>

        {/* Avatar & AI Section */}
        <section className="space-y-4 border-t border-slate-700 pt-6">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avatar Magic</h2>
          
          <div className="flex items-center gap-4">
            <img 
              src={tweetData.avatarUrl} 
              alt="Current" 
              className="w-12 h-12 rounded-full border-2 border-slate-600 object-cover"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg py-2 transition-all text-sm font-medium"
            >
              <Upload size={16} />
              Upload Photo
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-3">
             <div className="flex items-center gap-2 text-blue-400 mb-1">
                <Wand2 size={16} />
                <span className="text-xs font-bold uppercase">Gemini Nano Banana Editor</span>
             </div>
             
             <textarea 
                placeholder="E.g., 'Turn me into a cyberpunk character' or 'Add a neon crown'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-400 outline-none resize-none h-20"
             />

             {error && (
               <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 p-2 rounded">
                 <AlertCircle size={14} className="mt-0.5 shrink-0" />
                 <span>{error}</span>
               </div>
             )}

             <button 
              onClick={handleGeminiEdit}
              disabled={isProcessing}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
             >
               {isProcessing ? (
                 <>
                   <Loader2 size={16} className="animate-spin" />
                   Generating...
                 </>
               ) : (
                 "Generate Edit"
               )}
             </button>
          </div>
        </section>
        
        <div className="pt-4 border-t border-slate-700">
             <button
                onClick={handleDownload}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
             >
                <Download size={20} />
                Download Post
             </button>
        </div>

      </div>

      {/* Right Side: Preview */}
      <div 
        ref={containerRef}
        className="flex-1 bg-[#000000] overflow-hidden relative flex items-center justify-center"
      >
        
        {/* 
            SCALING CONTAINER:
            Transforms the 1080x1440 card to fit the screen.
            Uses Dynamic Scale calculated via JS.
        */}
        <div 
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'center center' 
            }}
            className="transition-transform duration-200 ease-out shadow-2xl origin-center"
        >
            <div 
                ref={previewRef}
                className="bg-white shrink-0"
            >
               <TweetCard data={tweetData} />
            </div>
        </div>
      </div>

    </div>
  );
};

export default App;
