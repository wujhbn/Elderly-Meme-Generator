import React, { useState, useRef, useEffect } from 'react';
import { generateGreetingText, editImageToGhibli } from './lib/gemini';
import { Upload, Download, RefreshCw, Send, Image as ImageIcon, Sparkles, Check, ChevronDown, ArrowUpDown, Type, Key, X } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type ProcessState = 'IDLE' | 'GENERATING' | 'DONE';

const MODES = [
  { id: 'normal', label: '預設溫暖', emoji: '☕' },
  { id: 'taiwanese', label: '親切台語', emoji: '🍠' },
  { id: 'buddhist', label: '佛系保平安', emoji: '📿' },
  { id: 'temple', label: '宮廟保庇', emoji: '🙏' },
  { id: 'holiday', label: '節慶快樂', emoji: '🎉' },
  { id: 'health', label: '健康第一', emoji: '🏃' },
  { id: 'positive', label: '每日正能量', emoji: '☀️' }
];

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if(hour >= 5 && hour < 11) return '早安';
  if(hour >= 11 && hour < 17) return '午安';
  if(hour >= 17 && hour <= 23) return '晚安';
  return '夜深了，早點休息喔 🌙';
}

export default function App() {
  const [appState, setAppState] = useState<ProcessState>('IDLE');
  const [mode, setMode] = useState('normal');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay());
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [textPosition, setTextPosition] = useState<'top' | 'bottom'>('bottom');
  const [textSize, setTextSize] = useState<'large' | 'medium' | 'small'>('large');
  const [textFont, setTextFont] = useState<'BiauKai' | 'Kaiti TC' | 'Noto Serif TC'>('BiauKai');
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const FONT_MAP = {
    'BiauKai': '"標楷體", BiauKai, "Kaiti TC", "STKaiti", serif',
    'Kaiti TC': '"Kaiti TC", "STKaiti", serif',
    'Noto Serif TC': '"Noto Serif TC", serif'
  };

  // Check PWA display mode
  useEffect(() => {
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (!isPwa && isIOS) {
      setShowInstallPrompt(true);
    }
    
    // Update time of day on mount
    setTimeOfDay(getTimeOfDay());
    
    // Load saved API key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKeyInput(savedKey);
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== 'string') return;
      
      const img = new Image();
      img.onload = async () => {
        const MAX_DIM = 1024;
        let { width, height } = img;
        
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setOriginalImage(compressedBase64);
          await startGeneration(compressedBase64);
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('gemini_api_key', apiKeyInput.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
    setShowKeyDialog(false);
  };

  const startGeneration = async (base64Img: string) => {
    setAppState('GENERATING');
    try {
      setStatusMessage('✨ 正在以 AI 吉卜力魔法渲染圖片...');
      
      // Start both promises
      const imgPromise = editImageToGhibli(base64Img);
      const textPromise = generateGreetingText(timeOfDay, mode);
      
      const newImg = await imgPromise;
      setGeneratedImage(newImg);
      
      setStatusMessage('✍️ 正在為您撰寫溫暖問候語...');
      const newText = await textPromise;
      setGreetingText(newText);
      
      setAppState('DONE');
    } catch (e: any) {
      console.error(e);
      alert('生成失敗，請稍後再試。' + (e.message || ''));
      setAppState('IDLE');
    }
  };

  const regenerateText = async () => {
    setStatusMessage('✍️ 正在為您換一句問候語...');
    setAppState('GENERATING');
    try {
      const newText = await generateGreetingText(timeOfDay, mode);
      setGreetingText(newText);
    } catch(e) {
      console.error(e);
    } finally {
      setAppState('DONE');
    }
  };

  // Create combined canvas for download/share
  const createCombinedCanvas = async (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx || !generatedImage) return resolve(canvas);
      
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        // Output dimensions, max 1080 width or height for good quality, maintaining original aspect ratio
        const scale = Math.min(1080 / img.width, 1080 / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Text configuration
        let baseFontSize = Math.max(56, Math.floor(canvas.height / 12));
        if (textSize === 'medium') baseFontSize = Math.max(46, Math.floor(canvas.height / 14));
        if (textSize === 'small') baseFontSize = Math.max(36, Math.floor(canvas.height / 18));
        const fontSize = baseFontSize;
        ctx.font = `900 ${fontSize}px ${FONT_MAP[textFont]}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Implement text wrapping
        const wrapText = (text: string, maxWidth: number) => {
          const paragraphs = text.split('\n');
          const finalLines: string[] = [];
          
          for (let p = 0; p < paragraphs.length; p++) {
            let line = '';
            for (let i = 0; i < paragraphs[p].length; i++) {
              const char = paragraphs[p][i];
              const testLine = line + char;
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth && line.length > 0) {
                finalLines.push(line);
                line = char;
              } else {
                line = testLine;
              }
            }
            finalLines.push(line);
          }
          return finalLines;
        };

        const maxWidth = canvas.width * 0.9; // 90% width
        const lines = wrapText(greetingText, maxWidth);
        const lineHeight = fontSize * 1.4;
        const totalHeight = lines.length * lineHeight;
        
        // Calculate starting Y position
        let initialY = 0;
        if (textPosition === 'bottom') {
          initialY = canvas.height - Math.max(canvas.height * 0.08, 40) - totalHeight + (lineHeight / 2);
        } else {
          initialY = Math.max(canvas.height * 0.08, 60) + (lineHeight / 2);
        }
        
        lines.forEach((line, i) => {
           const x = canvas.width / 2;
           const y = initialY + i * lineHeight;
           
           // Drop shadow & First Stroke
           ctx.shadowColor = "rgba(0,0,0,0.3)";
           ctx.shadowBlur = 12;
           ctx.shadowOffsetX = 0;
           ctx.shadowOffsetY = 6;
           
           ctx.strokeStyle = "#ffffff";
           ctx.lineWidth = fontSize * 0.2; // Thicker stroke for elder style
           ctx.lineJoin = "round";
           ctx.strokeText(line, x, y);
           
           // Second stroke to ensure solid white border without shadow bleeding
           ctx.shadowColor = "transparent";
           ctx.shadowBlur = 0;
           ctx.shadowOffsetX = 0;
           ctx.shadowOffsetY = 0;
           ctx.strokeText(line, x, y);
           
           ctx.fillStyle = "#FF6B6B"; // Match the generated text color
           ctx.fillText(line, x, y);
        });

        resolve(canvas);
      };
      img.src = generatedImage;
    });
  };

  const handleSave = async () => {
    if (!generatedImage) return;
    const canvas = await createCombinedCanvas();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `暖心問候_${new Date().getTime()}.jpg`;
    a.click();
  };

  const handleShareLine = async () => {
    if (!generatedImage) return;
    try {
      const canvas = await createCombinedCanvas();
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'greeting.jpg', { type: 'image/jpeg' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
            });
          } else {
             // Fallback if sharing files is not supported (this might just be text, but we shouldn't send text if user didn't want it, maybe tell them to download instead)
             alert('您的裝置無法直接分享圖片，請先下載圖片後再傳送到 LINE。');
          }
        }
      }, 'image/jpeg', 0.9);
    } catch (e) {
      console.error(e);
      alert('分享失敗，請先下載圖片後再傳送到 LINE。');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#4A4A40] font-sans pb-16 safe-area-pt">
      {/* PWA Prompt for iOS Safari */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-2 left-2 right-2 glass-card rounded-2xl p-4 shadow-lg z-50 flex items-start space-x-3"
          >
            <div className="bg-[#5A5A40]/10 p-2 rounded-xl text-[#5A5A40]">
              <Download size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-[#2D2D2A]">加到主畫面</h3>
              <p className="text-sm opacity-80 leading-snug mt-1 text-[#5A5A40]">點擊下方分享按鈕，選擇「加入主畫面」，就能像 App 一樣每天使用喔 😊</p>
            </div>
            <button onClick={() => setShowInstallPrompt(false)} className="p-2 shrink-0 opacity-50">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKeyDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] w-full max-w-sm p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Key size={20} className="text-[#5A5A40]" />
                  API 金鑰設定
                </h2>
                <button onClick={() => setShowKeyDialog(false)} className="p-2 text-gray-400 hover:text-gray-800 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                為讓此工具可在您的個人環境運行，您可以填寫自己的 Gemini API Key。金鑰只會保存在您的瀏覽器中。
              </p>
              <input 
                type="password" 
                placeholder="AIzaSy..." 
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full border-2 border-[#E0D9D1] rounded-2xl p-4 mb-4 focus:outline-none focus:border-[#5A5A40] transition-colors"
              />
              <button 
                onClick={handleSaveApiKey}
                className="w-full bg-[#5A5A40] text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform"
              >
                儲存設定
              </button>
              <div className="mt-4 text-center">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                  取得 Gemini API Key
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-md mx-auto w-full px-5 py-6 flex flex-col space-y-6 relative">
        <header className="flex flex-col items-center justify-center pt-4 pb-2 relative">
          <button 
            onClick={() => setShowKeyDialog(true)}
            className="absolute top-2 right-0 p-2 text-[#5A5A40]/60 hover:text-[#5A5A40] transition-colors bg-white rounded-full shadow-sm border border-[#E0D9D1]"
            aria-label="設定 API 金鑰"
          >
            <Key size={20} />
          </button>
          
          <motion.div 
            initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-3 border border-[#E0D9D1]"
          >
            <span className="text-3xl">☕</span>
          </motion.div>
          <h1 className="text-3xl font-bold tracking-wider text-[#2D2D2A] serif-title">暖心長輩圖 AI</h1>
          <p className="text-[#5A5A40] text-sm mt-1">一秒將照片變成吉卜力風格動畫</p>
        </header>

        {appState === 'IDLE' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col space-y-6"
          >
            {/* Mode selection */}
            <div className="bg-white rounded-[32px] p-5 shadow-sm border border-[#E0D9D1]">
              <h2 className="font-bold text-lg mb-4 flex items-center text-[#2D2D2A]"><Sparkles size={18} className="mr-2 text-[#5A5A40]"/> 選擇祝福風格</h2>
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex items-center px-4 py-2 rounded-full text-left transition-all",
                      mode === m.id 
                        ? "bg-[#5A5A40] text-white border border-[#5A5A40] shadow-md" 
                        : "bg-[#FAF7F2] border border-[#E0D9D1] text-[#5A5A40] hover:bg-white"
                    )}
                  >
                    <span className="text-base mr-1.5">{m.emoji}</span>
                    <span className="text-sm font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex-1 flex flex-col justify-end pb-8">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-[#5A5A40] text-white rounded-[32px] py-6 px-4 shadow-[0_8px_16px_rgba(90,90,64,0.2)] flex flex-col items-center justify-center active:scale-95 transition-transform"
              >
                <div className="bg-white/20 p-4 rounded-full mb-3">
                  <ImageIcon size={32} />
                </div>
                <span className="text-xl font-bold tracking-wide">選擇照片開始製作</span>
                <span className="text-sm text-white/80 mt-1">建議使用人物或風景照片</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>
          </motion.div>
        )}

        {appState === 'GENERATING' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 space-y-6"
          >
            <div className="relative w-32 h-32">
              <motion.div 
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="absolute inset-0 rounded-full border-4 border-dashed border-[#5A5A40]/30"
              />
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-2 bg-white rounded-full shadow-lg flex items-center justify-center text-4xl"
              >
                🎨
              </motion.div>
            </div>
            <h2 className="text-xl font-bold text-[#5A5A40]">{statusMessage}</h2>
            <p className="text-sm text-gray-500">由於 AI 需要仔細作畫，這可能需要大約 5~10 秒 ⏳</p>
          </motion.div>
        )}

        {appState === 'DONE' && generatedImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col space-y-5"
          >
            {/* The Image Preview inside App UI */}
            <div className="w-full relative rounded-3xl overflow-hidden shadow-lg bg-[#F0EBE3] border border-[#E0D9D1]">
              <img src={generatedImage} alt="Generated" className="w-full h-auto block" />
              
              <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button
                  onClick={() => setTextPosition(p => p === 'top' ? 'bottom' : 'top')}
                  className="bg-white/90 backdrop-blur-sm w-12 h-12 rounded-full shadow-lg text-[#5A5A40] flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="移動文字位置"
                >
                  <ArrowUpDown size={20} />
                </button>
                <button
                  onClick={() => setTextSize(s => s === 'large' ? 'medium' : s === 'medium' ? 'small' : 'large')}
                  className="bg-white/90 backdrop-blur-sm w-12 h-12 rounded-full shadow-lg text-[#5A5A40] flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="切換文字大小"
                >
                  <Type size={20} className={cn("transition-transform", textSize === 'small' ? 'scale-75' : textSize === 'medium' ? 'scale-90' : 'scale-110')} />
                </button>
                <button
                  onClick={() => setTextFont(f => f === 'BiauKai' ? 'Kaiti TC' : f === 'Kaiti TC' ? 'Noto Serif TC' : 'BiauKai')}
                  className="bg-white/90 backdrop-blur-sm w-12 h-12 rounded-full shadow-lg text-[#5A5A40] flex items-center justify-center active:scale-95 transition-transform"
                  aria-label="切換字體"
                >
                  <span className="font-bold text-xl leading-none" style={{ fontFamily: FONT_MAP[textFont] }}>字</span>
                </button>
              </div>

              <div className={cn(
                "absolute inset-x-0 flex items-center justify-center p-6",
                textPosition === 'bottom' ? "bottom-6" : "top-14"
              )}>
                <p 
                  className="text-[#FF6B6B] elder-text-shadow text-center font-black tracking-widest leading-relaxed whitespace-pre-wrap transition-all"
                  style={{ 
                    fontSize: textSize === 'large' ? 'clamp(1.5rem, 8vw, 2.5rem)' : textSize === 'medium' ? 'clamp(1.2rem, 6vw, 2rem)' : 'clamp(1rem, 5vw, 1.5rem)',
                    lineHeight: '1.4',
                    fontFamily: FONT_MAP[textFont]
                  }}
                >
                  {greetingText}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button 
                onClick={regenerateText}
                className="py-4 bg-white border-2 border-[#E0D9D1] rounded-2xl font-bold text-[#5A5A40] active:bg-gray-50 transition-colors shadow-sm flex items-center justify-center"
              >
                <RefreshCw size={18} className="mr-2" />
                <span>換一句話</span>
              </button>
              <button 
                onClick={handleSave}
                className="py-4 bg-white border-2 border-[#E0D9D1] rounded-2xl font-bold text-[#5A5A40] active:bg-gray-50 transition-colors shadow-sm flex items-center justify-center"
              >
                <Download size={18} className="mr-2" />
                <span>儲存圖片</span>
              </button>
            </div>
            <button 
              onClick={handleShareLine}
              className="w-full py-4 flex items-center justify-center bg-[#25D366] text-white active:bg-[#20b858] rounded-2xl transition-colors shadow-lg font-bold text-xl"
            >
              <Send size={24} className="mr-2" />
              <span>LINE 分享</span>
            </button>
            
            <button 
              onClick={() => { setAppState('IDLE'); setOriginalImage(null); setGeneratedImage(null); setGreetingText(''); setStatusMessage(''); setTextPosition('bottom'); setTextSize('large'); setTextFont('BiauKai'); }}
              className="w-full py-4 mt-2 text-sm font-bold text-gray-400 active:text-[#5A5A40] flex items-center justify-center transition-colors hover:text-[#5A5A40]"
            >
              製作下一張照片
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
