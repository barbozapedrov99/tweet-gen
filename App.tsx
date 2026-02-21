
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TweetCard } from './components/TweetCard';
import { DEFAULT_TWEET_DATA, BACKGROUND_OPTIONS } from './constants';
import { TweetData, Guideline } from './types';
import { editImageWithGemini, generateImageWithGemini } from './services/geminiService';
import { Wand2, Loader2, Upload, AlertCircle, Download, Undo, Redo, Type, Move, Edit3, Eye, Image as ImageIcon, X, Palette, Maximize, User } from 'lucide-react';
import * as htmlToImage from 'html-to-image';

const App: React.FC = () => {
  type CarouselState = {
    slides: TweetData[];
    activeSlideIndex: number;
  };

  const MAX_SLIDES = 10;

  const CONTENT_TEMPLATES = [
    {
      id: 'educacional',
      name: 'Educacional (AIDA)',
      build: (index: number, total: number) => {
        if (index === 0) return 'Gancho forte: o erro que está travando seu resultado hoje.';
        if (index === total - 1) return 'CTA: comente "QUERO" para receber o passo a passo completo.';
        return `Ponto ${index}: explique a ideia principal com exemplo curto e prático.`;
      }
    },
    {
      id: 'storytelling',
      name: 'Storytelling',
      build: (index: number, total: number) => {
        if (index === 0) return 'Tudo começou quando eu percebi um padrão que ninguém estava falando.';
        if (index === total - 1) return 'Conclusão + CTA: salve esse carrossel para revisar quando for aplicar.';
        return `Cena ${index}: descreva o conflito e a virada com objetividade.`;
      }
    },
    {
      id: 'lista',
      name: 'Lista (Top insights)',
      build: (index: number, total: number) => {
        if (index === 0) return `Top ${Math.max(total - 2, 3)} ideias para melhorar seu conteúdo hoje.`;
        if (index === total - 1) return 'Qual insight você vai aplicar primeiro? Responda nos comentários.';
        return `Insight ${index}: dica prática + um micro-exemplo de aplicação.`;
      }
    }
  ] as const;

  const CONTENT_SNIPPETS = [
    'Hook: você está cometendo esse erro sem perceber.',
    'Prova: isso aumentou meus resultados em poucos dias.',
    'Passo prático: abra agora e aplique em 2 minutos.',
    'CTA: salve esse post para usar depois.'
  ] as const;

  // State
  const [carouselState, setCarouselState] = useState<CarouselState>({
    slides: [DEFAULT_TWEET_DATA],
    activeSlideIndex: 0,
  });
  const [prompt, setPrompt] = useState('');
  const [imageGenerationPrompt, setImageGenerationPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mobile Tabs State
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  // Media Tab State (Upload vs Generate)
  const [mediaMode, setMediaMode] = useState<'upload' | 'generate'>('upload');

  // History State for Undo/Redo
  const [history, setHistory] = useState<CarouselState[]>([]);
  const [redoStack, setRedoStack] = useState<CarouselState[]>([]);
  
  // Scale State (Screen Preview)
  const [scale, setScale] = useState(0.5);

  // Dragging & Snapping State
  const [draggingItem, setDraggingItem] = useState<'header' | 'content' | 'tweetImage' | null>(null);
  const [resizingItem, setResizingItem] = useState<'header' | 'content' | 'tweetImage' | null>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null); // 'nw', 'ne', 'se', 'sw'
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  
  // Inline Editing State
  const [editingField, setEditingField] = useState<'displayName' | 'handle' | 'content' | null>(null);

  const dragStartRef = useRef<{ 
    x: number, 
    y: number, 
    initialX: number, 
    initialY: number,
    width: number,
    height: number
  } | null>(null);

  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    initialScale: number;
  } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tweetImageInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Used to track value before editing started (for text inputs)
  const preEditStateRef = useRef<TweetData | null>(null);
  const preBulkContentStateRef = useRef<CarouselState | null>(null);
  const bulkContentChangedRef = useRef(false);

  const tweetData = carouselState.slides[carouselState.activeSlideIndex];

  const cloneSlide = useCallback((slide: TweetData): TweetData => ({
    ...slide,
    headerPosition: { ...slide.headerPosition },
    contentPosition: { ...slide.contentPosition },
    tweetImagePosition: { ...slide.tweetImagePosition },
  }), []);

  const updateTweetData = useCallback((updater: (prev: TweetData) => TweetData) => {
    setCarouselState(prev => {
      const updatedSlides = [...prev.slides];
      updatedSlides[prev.activeSlideIndex] = updater(updatedSlides[prev.activeSlideIndex]);
      return { ...prev, slides: updatedSlides };
    });
  }, []);

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
  const calculateScale = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      
      // If container is hidden (e.g. mobile tab switch), these might be 0
      if (containerWidth === 0 || containerHeight === 0) return;

      const cardWidth = 1080;
      const cardHeight = 1440;
      const padding = 32; // Reduced padding for mobile

      const scaleX = (containerWidth - padding) / cardWidth;
      const scaleY = (containerHeight - padding) / cardHeight;

      const newScale = Math.min(scaleX, scaleY);
      setScale(newScale);
    }
  }, []);

  useEffect(() => {
    calculateScale();
    window.addEventListener('resize', calculateScale);
    
    const observer = new ResizeObserver(calculateScale);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', calculateScale);
      observer.disconnect();
    };
  }, [calculateScale]);

  // Recalculate scale when switching tabs on mobile
  useEffect(() => {
    if (activeTab === 'preview') {
      setTimeout(calculateScale, 10);
    }
  }, [activeTab, calculateScale]);

  // --- History Management ---

  const cloneCarouselState = useCallback((state: CarouselState): CarouselState => ({
    slides: state.slides.map(cloneSlide),
    activeSlideIndex: state.activeSlideIndex,
  }), [cloneSlide]);

  const saveToHistory = useCallback((prevState: CarouselState) => {
    setHistory(prev => [...prev, cloneCarouselState(prevState)]);
    setRedoStack([]); 
  }, [cloneCarouselState]);

  const handleUndo = useCallback(() => {
    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;
      const previousState = prevHistory[prevHistory.length - 1];
      const newHistory = prevHistory.slice(0, -1);
      
      setRedoStack(prev => [cloneCarouselState(carouselState), ...prev]); 
      setCarouselState(previousState);
      return newHistory;
    });
  }, [carouselState, cloneCarouselState]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
        if (prevRedo.length === 0) return prevRedo;
        const nextState = prevRedo[0];
        const newRedo = prevRedo.slice(1);
        
        setHistory(prev => [...prev, cloneCarouselState(carouselState)]);
        setCarouselState(nextState);
        return newRedo;
    });
  }, [carouselState, cloneCarouselState]);

  // --- Input Handlers ---

  const handleInputChange = (field: keyof TweetData, value: string) => {
    updateTweetData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputFocus = () => {
    preEditStateRef.current = { ...tweetData };
  };

  const handleInputBlur = (field: keyof TweetData) => {
    if (preEditStateRef.current && preEditStateRef.current[field] !== tweetData[field]) {
      saveToHistory({ ...carouselState, slides: carouselState.slides.map((slide, idx) => idx === carouselState.activeSlideIndex ? preEditStateRef.current! : slide) });
    }
    preEditStateRef.current = null;
  };

  const handleBulkContentFocus = () => {
    if (!preBulkContentStateRef.current) {
      preBulkContentStateRef.current = cloneCarouselState(carouselState);
      bulkContentChangedRef.current = false;
    }
  };

  const handleBulkContentChange = (slideIndex: number, value: string) => {
    setCarouselState(prev => {
      const updatedSlides = [...prev.slides];
      if (updatedSlides[slideIndex].content !== value) {
        bulkContentChangedRef.current = true;
      }
      updatedSlides[slideIndex] = { ...updatedSlides[slideIndex], content: value };
      return { ...prev, slides: updatedSlides };
    });
  };

  const handleBulkContentBlur = () => {
    if (preBulkContentStateRef.current && bulkContentChangedRef.current) {
      saveToHistory(preBulkContentStateRef.current);
    }
    preBulkContentStateRef.current = null;
    bulkContentChangedRef.current = false;
  };

  const handleApplyTemplate = (templateId: string) => {
    const selected = CONTENT_TEMPLATES.find(template => template.id === templateId);
    if (!selected) return;

    saveToHistory(carouselState);
    setCarouselState(prev => ({
      ...prev,
      slides: prev.slides.map((slide, index) => ({
        ...slide,
        content: selected.build(index, prev.slides.length),
      })),
    }));
  };

  const handleApplySnippetToActiveSlide = (snippet: string) => {
    saveToHistory(carouselState);
    updateTweetData(prev => ({
      ...prev,
      content: prev.content.trim() ? `${prev.content.trim()}

${snippet}` : snippet,
    }));
  };

  const handleCopyStyleToAllSlides = () => {
    saveToHistory(carouselState);
    const sourceSlide = carouselState.slides[carouselState.activeSlideIndex];

    setCarouselState(prev => ({
      ...prev,
      slides: prev.slides.map((slide, index) => {
        if (index === prev.activeSlideIndex) return slide;
        return {
          ...slide,
          background: sourceSlide.background,
          headerPosition: { ...sourceSlide.headerPosition },
          headerScale: sourceSlide.headerScale,
          contentPosition: { ...sourceSlide.contentPosition },
          contentScale: sourceSlide.contentScale,
          tweetImagePosition: { ...sourceSlide.tweetImagePosition },
          tweetImageScale: sourceSlide.tweetImageScale,
        };
      }),
    }));
  };

  const getValidationIssues = useCallback((state: CarouselState): string[] => {
    const issues: string[] = [];

    state.slides.forEach((slide, index) => {
      const slideLabel = `Slide ${index + 1}`;

      if (!slide.content.trim()) {
        issues.push(`${slideLabel}: texto vazio.`);
      }

      if (slide.content.length > 420) {
        issues.push(`${slideLabel}: texto muito longo (${slide.content.length} caracteres).`);
      }
    });

    return issues;
  }, []);

  const validateBeforeExport = () => {
    const issues = getValidationIssues(carouselState);
    if (issues.length > 0) {
      setError(`Revise antes de exportar: ${issues[0]}`);
      return false;
    }
    return true;
  };

  const focusNextBulkTextarea = () => {
    const activeElement = document.activeElement as HTMLElement | null;
    const currentIndex = Number(activeElement?.getAttribute('data-slide-index'));

    if (Number.isNaN(currentIndex)) return;

    const next = document.querySelector<HTMLTextAreaElement>(`textarea[data-bulk-textarea="true"][data-slide-index="${currentIndex + 1}"]`);
    next?.focus();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      saveToHistory(carouselState);
      const reader = new FileReader();
      reader.onloadend = () => {
        updateTweetData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTweetImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      saveToHistory(carouselState);
      const reader = new FileReader();
      reader.onloadend = () => {
        updateTweetData(prev => ({ 
            ...prev, 
            tweetImage: reader.result as string,
            tweetImagePosition: { x: 0, y: 0 },
            tweetImageScale: 1
        }));
      };
      reader.readAsDataURL(file);
    }
    if (tweetImageInputRef.current) tweetImageInputRef.current.value = '';
  }

  // --- Interaction Logic: Dragging & Resizing ---

  // 1. Dragging
  const initiateDrag = (clientX: number, clientY: number, element: 'header' | 'content' | 'tweetImage', target: HTMLElement) => {
    if (editingField) return; // Disable dragging while editing text
    setDraggingItem(element);
    
    const rect = target.getBoundingClientRect();
    const elementWidth = rect.width / scale;
    const elementHeight = rect.height / scale;

    let currentPos;
    if (element === 'header') currentPos = tweetData.headerPosition;
    else if (element === 'content') currentPos = tweetData.contentPosition;
    else currentPos = tweetData.tweetImagePosition;

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      initialX: currentPos.x,
      initialY: currentPos.y,
      width: elementWidth,
      height: elementHeight
    };
    
    saveToHistory(carouselState);
  };

  const handleDragStart = (e: React.MouseEvent, element: 'header' | 'content' | 'tweetImage') => {
    if (e.button !== 0) return; // Only Left Click
    e.preventDefault();
    e.stopPropagation();
    initiateDrag(e.clientX, e.clientY, element, e.currentTarget as HTMLElement);
  };

  const handleTouchStart = (e: React.TouchEvent, element: 'header' | 'content' | 'tweetImage') => {
    e.stopPropagation();
    const touch = e.touches[0];
    initiateDrag(touch.clientX, touch.clientY, element, e.currentTarget as HTMLElement);
  };

  // 2. Resizing (Visual)
  const initiateResize = (clientX: number, clientY: number, element: 'header' | 'content' | 'tweetImage', handle: string) => {
    saveToHistory(carouselState);
    setResizingItem(element);
    setActiveHandle(handle);
    
    let currentScale = 1;
    if (element === 'header') currentScale = tweetData.headerScale;
    else if (element === 'content') currentScale = tweetData.contentScale;
    else currentScale = tweetData.tweetImageScale;

    resizeStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialScale: currentScale
    };
  };

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent, element: 'header' | 'content' | 'tweetImage', handle: string) => {
     let clientX, clientY;
     if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
     } else {
       e.preventDefault(); 
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
     }
     initiateResize(clientX, clientY, element, handle);
  };


  // 3. Movement Handler (Centralized)
  const processMove = (clientX: number, clientY: number) => {
    
    // --- RESIZING LOGIC ---
    if (resizingItem && resizeStartRef.current && activeHandle) {
        const { startX, startY, initialScale } = resizeStartRef.current;
        
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;
        
        // Vector Logic: Determine if we are growing or shrinking based on corner
        let growthDelta = 0;

        if (activeHandle === 'se') {
             // Bottom Right: Moving Right (+X) or Down (+Y) grows
             growthDelta = deltaX + deltaY;
        } else if (activeHandle === 'sw') {
             // Bottom Left: Moving Left (-X) or Down (+Y) grows
             growthDelta = -deltaX + deltaY;
        } else if (activeHandle === 'ne') {
             // Top Right: Moving Right (+X) or Up (-Y) grows
             growthDelta = deltaX - deltaY;
        } else if (activeHandle === 'nw') {
             // Top Left: Moving Left (-X) or Up (-Y) grows
             growthDelta = -deltaX - deltaY;
        }
        
        // Sensitivity factor
        const sensitivity = 0.002; 
        
        let newScale = initialScale + (growthDelta * sensitivity);
        newScale = Math.max(0.2, Math.min(newScale, 3.0)); // Clamp

        if (resizingItem === 'header') {
            updateTweetData(prev => ({ ...prev, headerScale: newScale }));
        } else if (resizingItem === 'content') {
            updateTweetData(prev => ({ ...prev, contentScale: newScale }));
        } else {
            updateTweetData(prev => ({ ...prev, tweetImageScale: newScale }));
        }
        return;
    }

    // --- DRAGGING LOGIC ---
    if (!draggingItem || !dragStartRef.current) return;

    const deltaX = (clientX - dragStartRef.current.x) / scale;
    const deltaY = (clientY - dragStartRef.current.y) / scale;

    let newX = dragStartRef.current.initialX + deltaX;
    let newY = dragStartRef.current.initialY + deltaY;

    // Snapping Logic
    const SNAP_THRESHOLD = 15;
    const CARD_WIDTH = 1080;
    const CARD_PADDING_LEFT = 100;
    const activeGuidelines: Guideline[] = [];
    const visualWidth = dragStartRef.current.width; 

    if (Math.abs(newX) < SNAP_THRESHOLD) {
      newX = 0;
      activeGuidelines.push({ type: 'vertical', position: CARD_PADDING_LEFT });
    }

    const elementLeftRelativeToCard = CARD_PADDING_LEFT + newX;
    const elementCenterX = elementLeftRelativeToCard + (visualWidth / 2);
    const cardCenterX = CARD_WIDTH / 2;

    if (Math.abs(elementCenterX - cardCenterX) < SNAP_THRESHOLD) {
      newX = cardCenterX - CARD_PADDING_LEFT - (visualWidth / 2);
      activeGuidelines.push({ type: 'vertical', position: cardCenterX });
    }

    if (Math.abs(newY) < SNAP_THRESHOLD) {
      newY = 0;
    }

    setGuidelines(activeGuidelines);

    if (draggingItem === 'header') {
      updateTweetData(prev => ({ ...prev, headerPosition: { x: newX, y: newY } }));
    } else if (draggingItem === 'content') {
      updateTweetData(prev => ({ ...prev, contentPosition: { x: newX, y: newY } }));
    } else {
      updateTweetData(prev => ({ ...prev, tweetImagePosition: { x: newX, y: newY } }));
    }
  };

  const handleGlobalMove = (e: React.MouseEvent) => {
    processMove(e.clientX, e.clientY);
  };

  const handleGlobalTouchMove = (e: React.TouchEvent) => {
    if (draggingItem || resizingItem) {
        const touch = e.touches[0];
        processMove(touch.clientX, touch.clientY);
    }
  };

  const handleInteractionEnd = () => {
    setDraggingItem(null);
    setResizingItem(null);
    setActiveHandle(null);
    setGuidelines([]); 
    dragStartRef.current = null;
    resizeStartRef.current = null;
  };

  // --- Inline Editing Logic ---
  const handleDoubleClick = (element: 'displayName' | 'handle' | 'content') => {
      saveToHistory(carouselState);
      setEditingField(element);
  };

  const handleEditChange = (value: string) => {
      if (editingField) {
          updateTweetData(prev => ({ ...prev, [editingField]: value }));
      }
  };

  const handleEditBlur = () => {
      setEditingField(null);
  };

  // --- Background Logic ---
  const handleBackgroundChange = (bgStyle: string) => {
    saveToHistory(carouselState);
    updateTweetData(prev => ({ ...prev, background: bgStyle }));
  };
  
  // --- Gemini AI ---
  const handleGeminiEdit = async () => {
    if (!prompt.trim()) {
      setError("Por favor, digite um comando para a IA.");
      return;
    }
    if (!tweetData.avatarUrl.startsWith('data:')) {
         setError("Por favor, faça upload de uma imagem antes de editar.");
         return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      saveToHistory(carouselState);
      const newAvatarBase64 = await editImageWithGemini(tweetData.avatarUrl, prompt);
      updateTweetData(prev => ({ ...prev, avatarUrl: newAvatarBase64 }));
      setPrompt(''); 
    } catch (err: any) {
      setError(err.message || "Falha ao editar a imagem. Tente um comando diferente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageGeneration = async () => {
      if (!imageGenerationPrompt.trim()) {
          setError("Digite um comando para gerar a imagem.");
          return;
      }
      setIsGeneratingImage(true);
      setError(null);
      try {
          saveToHistory(carouselState);
          const newImageBase64 = await generateImageWithGemini(imageGenerationPrompt);
          updateTweetData(prev => ({
              ...prev,
              tweetImage: newImageBase64,
              tweetImagePosition: { x: 0, y: 0 },
              tweetImageScale: 1
          }));
          setImageGenerationPrompt('');
      } catch (err: any) {
          setError(err.message || "Falha ao gerar imagem.");
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const removeTweetImage = () => {
      saveToHistory(carouselState);
      updateTweetData(prev => ({ ...prev, tweetImage: null }));
  }

  const handleSelectSlide = (index: number) => {
    setCarouselState(prev => ({ ...prev, activeSlideIndex: index }));
    setEditingField(null);
  };

  const handleAddSlide = () => {
    if (carouselState.slides.length >= MAX_SLIDES) {
      setError(`Limite de ${MAX_SLIDES} slides atingido.`);
      return;
    }

    saveToHistory(carouselState);
    const baseSlide = carouselState.slides[carouselState.activeSlideIndex] ?? DEFAULT_TWEET_DATA;
    const newSlide = cloneSlide(baseSlide);
    setCarouselState(prev => ({
      slides: [...prev.slides, newSlide],
      activeSlideIndex: prev.slides.length,
    }));
    setError(null);
  };

  const handleDuplicateSlide = () => {
    if (carouselState.slides.length >= MAX_SLIDES) {
      setError(`Limite de ${MAX_SLIDES} slides atingido.`);
      return;
    }

    saveToHistory(carouselState);
    const idx = carouselState.activeSlideIndex;
    const newSlide = cloneSlide(carouselState.slides[idx]);

    setCarouselState(prev => ({
      slides: [...prev.slides.slice(0, idx + 1), newSlide, ...prev.slides.slice(idx + 1)],
      activeSlideIndex: idx + 1,
    }));
    setError(null);
  };

  const handleRemoveSlide = () => {
    if (carouselState.slides.length <= 1) {
      setError('É necessário manter pelo menos 1 slide.');
      return;
    }

    saveToHistory(carouselState);
    const idx = carouselState.activeSlideIndex;

    setCarouselState(prev => {
      const updatedSlides = prev.slides.filter((_, slideIndex) => slideIndex !== idx);
      return {
        slides: updatedSlides,
        activeSlideIndex: Math.max(0, Math.min(idx, updatedSlides.length - 1)),
      };
    });
    setError(null);
  };

  const handleMoveSlide = (direction: 'left' | 'right') => {
    const idx = carouselState.activeSlideIndex;
    const targetIndex = direction === 'left' ? idx - 1 : idx + 1;

    if (targetIndex < 0 || targetIndex >= carouselState.slides.length) return;

    saveToHistory(carouselState);
    setCarouselState(prev => {
      const updatedSlides = [...prev.slides];
      [updatedSlides[idx], updatedSlides[targetIndex]] = [updatedSlides[targetIndex], updatedSlides[idx]];
      return {
        slides: updatedSlides,
        activeSlideIndex: targetIndex,
      };
    });
  };

  const downloadCurrentPreview = async (filename: string) => {
    if (!previewRef.current) return;

    const options = {
      quality: 0.95,
      backgroundColor: '#ffffff',
      width: 1080,
      height: 1440,
      pixelRatio: 1,
      style: {
        transform: 'none',
        transformOrigin: 'top left',
        margin: '0',
      },
      filter: (node: HTMLElement) => {
        return !node.className?.includes?.('resize') && node.tagName !== 'TEXTAREA' && node.tagName !== 'INPUT' && !node.className?.includes?.('absolute');
      }
    };

    const dataUrl = await htmlToImage.toJpeg(previewRef.current, options);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const handleDownload = async () => {
    if (!validateBeforeExport()) return;

    if (previewRef.current) {
      try {
        setGuidelines([]); 
        // Ensure no active editing or dragging when saving
        setEditingField(null);
        setDraggingItem(null);
        setResizingItem(null);

        // Allow UI to update before snapshot
        await new Promise(resolve => setTimeout(resolve, 50));

        await downloadCurrentPreview(`post-tweet-${Date.now()}.jpg`);
      } catch (err) {
        console.error('Download failed', err);
        setError("Falha ao gerar o download da imagem.");
      }
    }
  };

  const handleDownloadCarousel = async () => {
    if (!validateBeforeExport()) return;
    if (!previewRef.current) return;

    const originalSlideIndex = carouselState.activeSlideIndex;

    try {
      setGuidelines([]);
      setEditingField(null);
      setDraggingItem(null);
      setResizingItem(null);
      setError(null);

      for (let i = 0; i < carouselState.slides.length; i += 1) {
        setCarouselState(prev => ({ ...prev, activeSlideIndex: i }));
        await new Promise(resolve => setTimeout(resolve, 120));
        const slideNumber = String(i + 1).padStart(2, '0');
        await downloadCurrentPreview(`carrossel-${slideNumber}.jpg`);
      }

      setCarouselState(prev => ({ ...prev, activeSlideIndex: originalSlideIndex }));
    } catch (err) {
      console.error('Carousel download failed', err);
      setError('Falha ao gerar o download do carrossel.');
      setCarouselState(prev => ({ ...prev, activeSlideIndex: originalSlideIndex }));
    }
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTypingTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (isModifier && e.key === 'z') {
        if (editingField) return; // Don't undo while typing text
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isModifier && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleDownloadCarousel();
        return;
      }

      if (isModifier && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleDownload();
        return;
      }

      if (isModifier && e.key.toLowerCase() === 'd' && !isTypingTarget) {
        e.preventDefault();
        handleDuplicateSlide();
        return;
      }

      if (isModifier && e.key === 'ArrowRight' && !isTypingTarget) {
        e.preventDefault();
        if (carouselState.activeSlideIndex < carouselState.slides.length - 1) {
          handleSelectSlide(carouselState.activeSlideIndex + 1);
        }
        return;
      }

      if (isModifier && e.key === 'ArrowLeft' && !isTypingTarget) {
        e.preventDefault();
        if (carouselState.activeSlideIndex > 0) {
          handleSelectSlide(carouselState.activeSlideIndex - 1);
        }
        return;
      }

      if (e.altKey && e.key === 'ArrowDown' && target?.getAttribute('data-bulk-textarea') === 'true') {
        e.preventDefault();
        focusNextBulkTextarea();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    carouselState.activeSlideIndex,
    carouselState.slides.length,
    editingField,
    handleDownload,
    handleDownloadCarousel,
    handleDuplicateSlide,
    handleRedo,
    handleSelectSlide,
    handleUndo,
  ]);

  return (
    <div 
      className="h-[100dvh] bg-slate-900 flex flex-col md:flex-row text-slate-900 font-sans selection:bg-blue-200 selection:text-blue-900 overflow-hidden"
      onMouseMove={handleGlobalMove}
      onMouseUp={handleInteractionEnd}
      onMouseLeave={handleInteractionEnd}
      onTouchMove={handleGlobalTouchMove}
      onTouchEnd={handleInteractionEnd}
      tabIndex={0} 
    >
      
      {/* SIDEBAR (EDITOR) - LIGHT THEME */}
      <div 
        className={`
          w-full md:w-[400px] lg:w-[450px] p-6 border-r border-gray-200 
          flex-col gap-8 overflow-y-auto h-full custom-scrollbar shrink-0 z-10 bg-white shadow-xl pb-24 md:pb-6
          ${activeTab === 'editor' ? 'flex' : 'hidden md:flex'}
        `}
      >
        
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
              Gerador de Tweets
            </h1>
            <p className="text-gray-500 text-xs mt-1 font-medium tracking-wide uppercase">
              criado por Pedro Barboza
            </p>
          </div>
          
          <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200 shadow-sm">
            <button 
              onClick={handleUndo} 
              disabled={history.length === 0}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all group relative"
              title="Desfazer"
            >
              <Undo size={18} />
            </button>
            <div className="w-px bg-gray-200 my-1"></div>
            <button 
              onClick={handleRedo} 
              disabled={redoStack.length === 0}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
              title="Refazer"
            >
              <Redo size={18} />
            </button>
          </div>
        </header>

        {/* Carousel Controls */}
        <section className="space-y-3 border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Carrossel</h2>
            <span className="text-xs text-gray-500">Slide {carouselState.activeSlideIndex + 1} de {carouselState.slides.length}</span>
          </div>

          <div className="flex gap-2">
            <button onClick={handleAddSlide} disabled={carouselState.slides.length >= MAX_SLIDES} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg">+ Novo slide</button>
            <button onClick={handleDuplicateSlide} disabled={carouselState.slides.length >= MAX_SLIDES} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg">Duplicar</button>
            <button onClick={handleRemoveSlide} disabled={carouselState.slides.length <= 1} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg">Remover</button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => handleMoveSlide('left')} disabled={carouselState.activeSlideIndex === 0} className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-xs font-semibold py-2 rounded-lg">Mover ←</button>
            <button onClick={() => handleMoveSlide('right')} disabled={carouselState.activeSlideIndex === carouselState.slides.length - 1} className="flex-1 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-xs font-semibold py-2 rounded-lg">Mover →</button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {carouselState.slides.map((_, index) => (
              <button
                key={`slide-${index}`}
                onClick={() => handleSelectSlide(index)}
                className={`h-9 rounded-md text-xs font-semibold border transition-colors ${
                  index === carouselState.activeSlideIndex
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </section>

        {/* Production Helpers */}
        <section className="space-y-3 border border-gray-200 rounded-xl p-4 bg-white">
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Acelerar Produção</h2>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Template rápido de roteiro</p>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleApplyTemplate(template.id)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Padronização visual</p>
            <button
              onClick={handleCopyStyleToAllSlides}
              className="w-full text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-lg border border-indigo-100"
            >
              Copiar estilo do slide atual para todos
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 font-medium">Banco de snippets (slide atual)</p>
            <div className="flex flex-wrap gap-2">
              {CONTENT_SNIPPETS.map((snippet, idx) => (
                <button
                  key={`snippet-${idx}`}
                  onClick={() => handleApplySnippetToActiveSlide(snippet)}
                  className="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-md border border-emerald-100"
                >
                  + {snippet.split(':')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2 leading-relaxed">
            Atalhos: Ctrl/Cmd + ←/→ trocar slide · Ctrl/Cmd + D duplicar · Ctrl/Cmd + E baixar slide · Ctrl/Cmd + Shift + E baixar carrossel · Alt + ↓ próximo textarea
          </div>
        </section>

        {/* Background Selector */}
        <section className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <Palette size={14} className="text-blue-600" />
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Estilo do Fundo</h2>
             </div>
             
             <div className="grid grid-cols-3 gap-3">
                {BACKGROUND_OPTIONS.map((bg) => (
                    <button
                        key={bg.id}
                        onClick={() => handleBackgroundChange(bg.style)}
                        className={`group relative aspect-video rounded-lg overflow-hidden transition-all shadow-sm border border-gray-100 ${tweetData.background === bg.style ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white scale-[1.02]' : 'hover:scale-[1.02] opacity-80 hover:opacity-100'}`}
                    >
                        <div className={`w-full h-full ${bg.previewClass}`}></div>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white py-1 px-2 font-medium truncate">
                            {bg.name}
                        </span>
                    </button>
                ))}
             </div>
        </section>

        {/* Layout & Sizing Controls (Simplified) */}
        <section className="space-y-4">
           <div className="flex items-center gap-2 mb-2">
             <Maximize size={14} className="text-blue-600" />
             <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Ajuste Fino (Escala)</h2>
           </div>
           
           <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-blue-600/80 mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-center justify-center font-medium">
                 <Move size={12} />
                 <span>Arraste os cantos dos elementos para redimensionar!</span>
              </div>
              
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-gray-500 font-medium">Cabeçalho</span>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={tweetData.headerScale} onChange={(e) => { updateTweetData(p => ({...p, headerScale: parseFloat(e.target.value)})); saveToHistory(carouselState); }} className="flex-1 accent-blue-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                 </div>
                 <div className="flex items-center gap-3">
                    <span className="text-xs w-16 text-gray-500 font-medium">Texto</span>
                    <input type="range" min="0.5" max="2.0" step="0.05" value={tweetData.contentScale} onChange={(e) => { updateTweetData(p => ({...p, contentScale: parseFloat(e.target.value)})); saveToHistory(carouselState); }} className="flex-1 accent-blue-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
                 </div>
              </div>
           </div>
        </section>

        {/* Basic Fields */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Type size={14} className="text-blue-600" />
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Perfil do Post</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
              <input 
                type="text" 
                value={tweetData.displayName}
                onFocus={handleInputFocus}
                onBlur={() => handleInputBlur('displayName')}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="bg-white border border-gray-200 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm placeholder-gray-400 shadow-sm"
                placeholder="Nome"
              />
              <input 
                type="text" 
                value={tweetData.handle}
                onFocus={handleInputFocus}
                onBlur={() => handleInputBlur('handle')}
                onChange={(e) => handleInputChange('handle', e.target.value)}
                className="bg-white border border-gray-200 text-gray-900 rounded-lg px-4 py-2.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm placeholder-gray-400 shadow-sm"
                placeholder="@usuario"
              />
          </div>
        </section>

        {/* Carousel Script Editor */}
        <section className="space-y-4 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Textos do Carrossel/Post</h2>
            <span className="text-xs text-gray-400">Edite todos os slides de uma vez</span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {carouselState.slides.map((slide, index) => (
              <div key={`content-editor-${index}`} className={`rounded-lg border p-3 bg-white ${index === carouselState.activeSlideIndex ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-600">Slide {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleSelectSlide(index)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Ver no preview
                  </button>
                </div>
                <textarea
                  value={slide.content}
                  data-bulk-textarea="true"
                  data-slide-index={index}
                  onFocus={handleBulkContentFocus}
                  onBlur={handleBulkContentBlur}
                  onChange={(e) => handleBulkContentChange(index, e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-md px-3 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm placeholder-gray-400 resize-none h-20"
                  placeholder={`Texto do slide ${index + 1}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Validation */}
        <section className="space-y-3 border border-amber-200 bg-amber-50/70 rounded-xl p-4">
          <h2 className="text-[11px] font-bold text-amber-700 uppercase tracking-widest">Checklist antes de exportar</h2>
          {getValidationIssues(carouselState).length === 0 ? (
            <p className="text-xs text-emerald-700">Tudo certo para exportar ✅</p>
          ) : (
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
              {getValidationIssues(carouselState).map((issue, index) => (
                <li key={`validation-${index}`}>{issue}</li>
              ))}
            </ul>
          )}
        </section>

        {/* --- MEDIA SECTION --- */}
        <section className="space-y-4 border-t border-gray-200 pt-6">
            <div className="flex items-center gap-2 mb-2">
                <ImageIcon size={14} className="text-blue-600" />
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Mídia do Tweet</h2>
            </div>

            {tweetData.tweetImage ? (
                <div className="relative group">
                    <img src={tweetData.tweetImage} alt="Tweet Media" className="w-full h-40 object-cover rounded-lg border border-gray-200 shadow-sm" />
                    <button 
                        onClick={removeTweetImage}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-lg transition-colors"
                        title="Remover Imagem"
                    >
                        <X size={16} />
                    </button>
                    <div className="text-xs text-center text-gray-500 mt-2">Imagem adicionada. Arraste para mover ou redimensionar.</div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {/* Media Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button 
                            onClick={() => setMediaMode('upload')}
                            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${mediaMode === 'upload' ? 'bg-gray-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Upload
                        </button>
                        <button 
                            onClick={() => setMediaMode('generate')}
                            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors ${mediaMode === 'generate' ? 'bg-gray-50 text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Gerar com IA
                        </button>
                    </div>

                    <div className="p-5">
                        {mediaMode === 'upload' ? (
                            <div className="text-center">
                                <button 
                                    onClick={() => tweetImageInputRef.current?.click()}
                                    className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-lg p-8 transition-all flex flex-col items-center justify-center gap-3 group"
                                >
                                    <div className="bg-gray-100 p-3 rounded-full group-hover:bg-blue-100 transition-colors">
                                        <Upload size={24} className="text-gray-500 group-hover:text-blue-600" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-600 group-hover:text-blue-700">Enviar Imagem</span>
                                </button>
                                <input 
                                    type="file" 
                                    ref={tweetImageInputRef}
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleTweetImageUpload}
                                />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <textarea 
                                    placeholder="Descreva a imagem..."
                                    value={imageGenerationPrompt}
                                    onChange={(e) => setImageGenerationPrompt(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none h-20 placeholder-gray-400 shadow-inner"
                                />
                                <button 
                                    onClick={handleImageGeneration}
                                    disabled={isGeneratingImage}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-200"
                                >
                                    {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : "Gerar"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>

        {/* --- Foto de Perfil Section (Redesigned) --- */}
        <section className="space-y-4 border-t border-gray-200 pt-6">
          <div className="flex items-center gap-2 mb-2">
             <div className="bg-blue-500/10 p-1.5 rounded-lg text-blue-600">
               <User size={14} /> 
             </div>
             <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Foto de Perfil</h2>
          </div>

          <div className="flex items-start gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
             {/* Preview */}
             <div className="relative shrink-0 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
               <img src={tweetData.avatarUrl} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md group-hover:ring-2 ring-blue-500 transition-all" alt="Avatar" />
               <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={16} className="text-white" />
               </div>
             </div>

             {/* Controls */}
             <div className="flex-1 space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Upload size={14} />
                  Trocar Foto
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

                {/* AI Edit - Compact */}
                <div className="flex gap-2">
                   <input
                      type="text"
                      placeholder="Editar com IA..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 placeholder-gray-400 shadow-sm"
                   />
                   <button onClick={handleGeminiEdit} disabled={isProcessing} className="bg-indigo-600 hover:bg-indigo-700 w-9 rounded-lg text-white flex items-center justify-center transition-colors shadow-md shadow-indigo-200">
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                   </button>
                </div>
             </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1"><AlertCircle size={12}/> {error}</p>}
        </section>
        
        {/* Desktop Download */}
        <div className="hidden md:grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 pb-2">
             <button
                onClick={handleDownload}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
             >
                <Download size={20} />
                Baixar Slide
             </button>
             <button
                onClick={handleDownloadCarousel}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
             >
                <Download size={20} />
                Baixar Carrossel
             </button>
        </div>
      </div>

      {/* PREVIEW AREA (DARK MODE) */}
      <div 
        ref={containerRef}
        className={`
            flex-1 bg-slate-950 overflow-hidden relative items-center justify-center
            ${activeTab === 'preview' ? 'flex' : 'hidden md:flex'}
            ${draggingItem ? 'cursor-grabbing' : ''}
        `}
      >
        {/* Dark Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div 
            style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
            className="transition-transform duration-75 ease-out shadow-2xl origin-center ring-1 ring-white/10"
        >
            <div ref={previewRef} className="bg-white shrink-0 relative">
               <TweetCard 
                   data={tweetData} 
                   onMouseDown={handleDragStart} 
                   onTouchStart={handleTouchStart}
                   onResizeStart={handleResizeStart} 
                   onDoubleClick={handleDoubleClick}
                   editingField={editingField}
                   onEditChange={handleEditChange}
                   onEditBlur={handleEditBlur}
                   guidelines={guidelines} 
               />
            </div>
        </div>

        <div className="md:hidden absolute bottom-24 right-6 z-50 flex flex-col gap-3">
          <button
              onClick={handleDownloadCarousel}
              className="bg-teal-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center active:scale-95"
              title="Baixar carrossel"
          >
              <Download size={24} />
          </button>
          <button
              onClick={handleDownload}
              className="bg-emerald-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center active:scale-95"
              title="Baixar slide atual"
          >
              <Download size={28} />
          </button>
        </div>
      </div>

      {/* MOBILE NAV (LIGHT) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-50 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('editor')} className={`flex flex-col items-center gap-1 p-2 w-full ${activeTab === 'editor' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Edit3 size={20} /> <span className="text-[10px] uppercase font-medium">Editar</span>
        </button>
        <div className="w-px h-8 bg-gray-200"></div>
        <button onClick={() => setActiveTab('preview')} className={`flex flex-col items-center gap-1 p-2 w-full ${activeTab === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
          <Eye size={20} /> <span className="text-[10px] uppercase font-medium">Visualizar</span>
        </button>
      </div>

    </div>
  );
};

export default App;
