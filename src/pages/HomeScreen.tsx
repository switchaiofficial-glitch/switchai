import { auth, firestore } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Lottie from 'lottie-react';
import { Archive, ArrowUp, BarChart3, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, Code, Coins, Copy, Database, Dice5, Edit3, Eye, FileText, FileText as FileTextIcon, Image as ImageIcon, Info, Lightbulb, Lightbulb as LightbulbIcon, LogOut, Mail, MoreHorizontal, Paperclip, Pencil, Plus, RefreshCw, Rocket, School, Search, Server, Settings, Share2, Smartphone, Sparkles, Square, Star, Trash2, TrendingDown, TrendingUp, Wand2, X, Zap } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/Markdown';
import { buildMemorySystemPrompt, initMemoryDocument, maybeStoreFromUserMessage } from '../lib/aiMemoryService';
import { autoSwitchModel, isAutoSwitchEnabled, setAutoSwitchEnabled, type ModelEntry } from '../lib/autoModelSwitch';
import { cerebrasStreamCompletion } from '../lib/cerebrasClient';
import type { AttachmentData, Chat, Message } from '../lib/chatStorage';
import {
  addMessage,
  createChat,
  deleteChat as deleteChatStorage,
  generateChatTitle,
  getChat,
  getChatHistory,
  toggleArchive,
  updateChat,
} from '../lib/chatStorage';
import { createDateTimeSystemMessage, isDateTimeQuery } from '../lib/dateTimeContext';
import { googleStreamCompletion } from '../lib/googleClient';
import { groqChatCompletion, streamChatCompletion } from '../lib/groqClient';
import { mistralStreamCompletion } from '../lib/mistralClient';
import type { CatalogEntry } from '../lib/modelCatalog';
import { buildCatalog, getProviderName } from '../lib/modelCatalog';
import { openRouterStreamCompletion } from '../lib/openRouterClient';
import { PDFService } from '../lib/pdfService';
import rateLimiter, { retryWithBackoff } from '../lib/requestRateLimiter';
import { formatTokens, getUserTokenData, subscribeToTokenBalance, type UserTokenData } from '../lib/tokenService';
import { maybeInjectUserNameContext } from '../lib/userNameContext';
import { theme } from '../theme';

interface AttachedImage {
  dataUrl: string;
  file: File;
}

interface AttachedPDF {
  file: File;
  name: string;
}

// Suggested prompts shown when there are no messages (pill style)
const BASE_PROMPTS = [
  {
    title: 'Make a plan',
    icon: 'lightbulb-on-outline',
    iconColor: '#F59E0B',
    text: 'Help me make a plan for',
    contextual: [
      'my weekly meal prep and grocery shopping',
      'learning a new programming language',
      'organizing a productive morning routine',
      'planning a weekend trip itinerary'
    ]
  },
  {
    title: 'Analyze images',
    icon: 'eye-outline',
    iconColor: '#60A5FA',
    text: 'Analyze this image and describe',
    contextual: [
      'the main elements and composition',
      'the colors, lighting, and mood',
      'any text or important details visible',
      'the style and artistic techniques used'
    ]
  },
  {
    title: 'Summarize',
    icon: 'file-document-outline',
    iconColor: '#10B981',
    text: 'Summarize',
    contextual: [
      'my lease agreement into key points',
      'notes from a meeting I attended',
      'chapter 1 of a book I\'m reading',
      'a research paper into main findings'
    ]
  },
  {
    title: 'Brainstorm',
    icon: 'lightbulb-outline',
    iconColor: '#FACC15',
    text: 'Brainstorm ideas for',
    contextual: [
      'a creative birthday party theme',
      'increasing productivity at work',
      'a fun weekend project to try',
      'healthy dinner recipes this week'
    ]
  },
  {
    title: 'Analyze data',
    icon: 'chart-box-outline',
    iconColor: '#38BDF8',
    text: 'Analyze the following data and highlight patterns',
    contextual: [
      'from my monthly expenses spreadsheet',
      'in my fitness tracking app',
      'from website traffic analytics',
      'from customer feedback surveys'
    ]
  },
  {
    title: 'Help me write',
    icon: 'pencil-outline',
    iconColor: '#3B82F6',
    text: 'Help me write',
    contextual: [
      'a professional email to my team',
      'a compelling social media post',
      'an engaging product description',
      'a thoughtful thank you message'
    ]
  },
  {
    title: 'Get advice',
    icon: 'school-outline',
    iconColor: '#8B5CF6',
    text: 'Give me advice about',
    contextual: [
      'choosing the right career path',
      'improving my communication skills',
      'managing work-life balance better',
      'making a difficult personal decision'
    ]
  },
  {
    title: 'Code',
    icon: 'code-tags',
    iconColor: '#93C5FD',
    text: 'Write code to',
    contextual: [
      'create a simple to-do list app',
      'process and analyze CSV data',
      'build a responsive navigation menu',
      'implement user authentication'
    ]
  },
  {
    title: 'Surprise me',
    icon: 'dice-5-outline',
    iconColor: '#A78BFA',
    text: 'Give me a fun, random task to try.',
    contextual: []
  },
];

export default function HomeScreen() {
  const navigate = useNavigate();

  // Utility function to summarize assistant text for token efficiency
  const summarizeAssistantText = (text: string): string => {
    try {
      const t = String(text || '')
        // remove chain-of-thought blocks if present
        .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
        // strip code fences but keep short hints
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]{1,80})`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (!t) return '';
      // Keep first 1–2 sentences up to ~240 chars (avoid lookbehind for RN compatibility)
      const sentences = t.match(/[^.!?]+[.!?]?/g) || [t];
      let out = sentences.slice(0, 2).join(' ').trim();
      if (out.length > 240) out = out.slice(0, 240).trim();
      // Ensure brevity indicator
      return out;
    } catch { return ''; }
  };

  // Compress assistant messages in history: keep user messages verbatim; keep only the most recent assistant fully
  const compressAssistantHistory = (msgs: Message[]): Message[] => {
    try {
      if (!Array.isArray(msgs) || msgs.length === 0) return msgs || [];
      // Find the index of the last assistant message before the last user (or overall if no trailing user)
      let lastAssistantIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i]?.role === 'assistant') { lastAssistantIdx = i; break; }
      }
      return msgs.map((m, idx) => {
        if (m?.role !== 'assistant') return m; // Keep users/system as-is
        if (idx === lastAssistantIdx) return m; // Keep the latest assistant as-is
        const content = summarizeAssistantText(m?.content as string);
        return { ...m, content: content || '[summary of previous reply]' };
      });
    } catch { return msgs || []; }
  };

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(40); // Track input height for pill/rectangular mode
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [favoriteModels, setFavoriteModels] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('favoriteModels') || '[]'); } catch { return []; }
  });
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches) ? false : true);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarBgColor, setAvatarBgColor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modelPickerPos, setModelPickerPos] = useState({ top: 0, left: 0 });
  const [reasoningLevel, setReasoningLevel] = useState<'low' | 'medium' | 'high'>(() => {
    const saved = localStorage.getItem('reasoningLevel');
    return (saved === 'low' || saved === 'medium' || saved === 'high') ? saved : 'medium';
  });
  // Rename modal state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameChatId, setRenameChatId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  // Image and PDF attachment state
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [attachedPDFs, setAttachedPDFs] = useState<AttachedPDF[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Lottie animations state
  const [appAnimation, setAppAnimation] = useState<any>(null);
  const [dotsAnimation, setDotsAnimation] = useState<any>(null);

  // Prompt suggestion state
  const [showContextualPrompts, setShowContextualPrompts] = useState(false);
  const [selectedPromptType, setSelectedPromptType] = useState<any>(null);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-switch state
  const [autoSwitch, setAutoSwitch] = useState<boolean>(() => isAutoSwitchEnabled());

  // Mobile app QR modal state
  const [showMobileModal, setShowMobileModal] = useState(false);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedSettingsPage, setSelectedSettingsPage] = useState<string>('overview');
  const [isSettingsScrolling, setIsSettingsScrolling] = useState(false);
  const settingsScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Personality modal state
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [personalityPickerPos, setPersonalityPickerPos] = useState({ top: 0, left: 0 });
  const personalityButtonRef = useRef<HTMLButtonElement>(null);

  // Settings data state
  const [tokenData, setTokenData] = useState<UserTokenData | null>(null);
  const [useForTraining, setUseForTraining] = useState(() => {
    try {
      return localStorage.getItem('useDataForTraining') === '1';
    } catch {
      return false;
    }
  });

  // Welcome messages with random selection
  const welcomeMessages = [
    `What's on the agenda today?`,
    `Good to see you, {name}`,
    `What are you working on?`,
    `Where should we begin?`,
    `Hey, {name}.. Ready to dive in?`,
    `What should we create today?`,
    `Looking for some ideas?`,
  ];

  const [randomWelcomeMessage, setRandomWelcomeMessage] = useState<string>('');

  // Initialize random welcome message on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    const selectedMessage = welcomeMessages[randomIndex];
    const userName = user?.displayName?.split(' ')[0] || 'there';
    const finalMessage = selectedMessage.replace('{name}', userName);
    setRandomWelcomeMessage(finalMessage);
  }, [user?.displayName]);

  // Personalization settings state (additional ones not already defined)
  const [streamingEnabled, setStreamingEnabled] = useState(() => {
    try {
      return localStorage.getItem('streamingEnabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [aiMemoryEnabled, setAiMemoryEnabled] = useState(() => {
    try {
      return localStorage.getItem('aiMemoryEnabled') === 'true';
    } catch {
      return false;
    }
  });

  const [chatHistorySearchEnabled, setChatHistorySearchEnabled] = useState(() => {
    try {
      return localStorage.getItem('chatHistorySearchEnabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [personality, setPersonality] = useState(() => {
    try {
      return localStorage.getItem('aiPersonality') || 'default';
    } catch {
      return 'default';
    }
  });

  const [customInstruction, setCustomInstruction] = useState(() => {
    try {
      return localStorage.getItem('customInstruction') || '';
    } catch {
      return '';
    }
  });

  const [nickname, setNickname] = useState(() => {
    try {
      return localStorage.getItem('userNickname') || '';
    } catch {
      return '';
    }
  });

  const [occupation, setOccupation] = useState(() => {
    try {
      return localStorage.getItem('userOccupation') || '';
    } catch {
      return '';
    }
  });

  const [moreAboutYou, setMoreAboutYou] = useState(() => {
    try {
      return localStorage.getItem('userMoreAboutYou') || '';
    } catch {
      return '';
    }
  });

  // Model preferences state
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('selectedModels');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsSortBy, setModelsSortBy] = useState<'provider' | 'inference' | 'type'>('provider');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerButtonRef = useRef<HTMLButtonElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const lastUpdateRef = useRef<number>(0);

  // Mobile detection and responsive sidebar behavior
  const [isMobile, setIsMobile] = useState<boolean>(() => (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches));
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: any) => {
      setIsMobile(!!e.matches);
      if (e.matches) {
        // Auto-close sidebar when entering mobile viewport
        setSidebarOpen(false);
      }
    };
    // Initialize
    handler({ matches: mq.matches });
    try {
      mq.addEventListener('change', handler);
    } catch {
      // Safari fallback
      // @ts-ignore
      mq.addListener(handler);
    }
    return () => {
      try {
        mq.removeEventListener('change', handler);
      } catch {
        // @ts-ignore
        mq.removeListener(handler);
      }
    };
  }, []);

  // Inject keyframes and utility styles once (for typing dots, subtle animations)
  useEffect(() => {
    const id = 'switchai-global-styles';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = `
      @keyframes sa-pulse { 0%, 80%, 100% { transform: scale(0.9); opacity: .6 } 40% { transform: scale(1); opacity: 1 } }
      @keyframes sa-fade-in { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes sa-pop { from { transform: scale(.98); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      .sa-card { box-shadow: 0 16px 40px rgba(0,0,0,0.45); backdrop-filter: blur(12px); }
    `;
    document.head.appendChild(style);
  }, []);

  // Load user auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Generate initials from display name
  const initials = React.useMemo(() => {
    const displayName = user?.displayName || 'U';
    const parts = displayName.trim().split(' ').filter(Boolean);

    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0][0].toUpperCase();

    // First letter of first name + first letter of last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user?.displayName]);

  // Load or generate avatar background color
  useEffect(() => {
    const loadAvatarColor = async () => {
      if (!user?.uid) return;

      try {
        const storageKey = `avatar_color_${user.uid}`;
        const storedColor = localStorage.getItem(storageKey);

        if (storedColor) {
          setAvatarBgColor(storedColor);
        } else {
          // Generate a random color from a nice palette
          const palette = [
            '#8b5cf6', // purple
            '#f59e0b', // amber
            '#10b981', // emerald
            '#3b82f6', // blue
            '#ef4444', // red
            '#14b8a6', // teal
            '#ec4899', // pink
            '#f97316', // orange
            '#06b6d4', // cyan
            '#a855f7', // violet
          ];
          const randomColor = palette[Math.floor(Math.random() * palette.length)];
          localStorage.setItem(storageKey, randomColor);
          setAvatarBgColor(randomColor);
        }
      } catch (error) {
        console.error('Error loading avatar color:', error);
      }
    };

    loadAvatarColor();
  }, [user?.uid]);

  // Load models from Firestore
  useEffect(() => {
    loadModels();
  }, []);

  // Initialize AI Memory
  useEffect(() => {
    initMemoryDocument().catch(console.error);
  }, []);

  // Persist reasoning level
  useEffect(() => {
    try { localStorage.setItem('reasoningLevel', reasoningLevel); } catch { }
  }, [reasoningLevel]);

  // Load chat history on mount
  useEffect(() => {
    refreshChatHistory();

    // Restore last active chat if available
    try {
      const lastChatId = localStorage.getItem('lastActiveChatId');
      if (lastChatId) {
        const chat = getChat(lastChatId);
        if (chat) {
          setMessages(chat.messages || []);
          setCurrentChatId(lastChatId);
          if (chat.model) {
            setSelectedModel(chat.model);
          }
        } else {
          // Chat not found (maybe deleted), clear storage
          localStorage.removeItem('lastActiveChatId');
        }
      }
    } catch (e) {
      console.error('Failed to restore last chat:', e);
    }
  }, []);

  // Load Lottie animations
  useEffect(() => {
    const loadAnimations = async () => {
      try {
        const appResponse = await fetch('/animations/app.json');
        const appData = await appResponse.json();
        setAppAnimation(appData);

        const dotsResponse = await fetch('/animations/dots.json');
        const dotsData = await dotsResponse.json();
        setDotsAnimation(dotsData);
      } catch (error) {
        console.warn('Failed to load Lottie animations:', error);
      }
    };
    loadAnimations();
  }, []);

  // Load token data when settings modal opens
  useEffect(() => {
    if (showSettingsModal && selectedSettingsPage === 'tokens') {
      getUserTokenData().then(setTokenData).catch(console.error);

      const uid = auth.currentUser?.uid;
      if (uid) {
        const unsubscribe = subscribeToTokenBalance(uid, (balance) => {
          setTokenData(prev => prev ? { ...prev, balance } : null);
        });
        return () => unsubscribe();
      }
    }
  }, [showSettingsModal, selectedSettingsPage]);

  // Handle Escape key for personality modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPersonalityModal) {
        setShowPersonalityModal(false);
      }
    };
    if (showPersonalityModal) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [showPersonalityModal]);

  // Save training preference
  useEffect(() => {
    localStorage.setItem('useDataForTraining', useForTraining ? '1' : '0');
  }, [useForTraining]);

  // Save personalization settings
  useEffect(() => {
    localStorage.setItem('reasoningLevel', reasoningLevel);
  }, [reasoningLevel]);

  useEffect(() => {
    localStorage.setItem('streamingEnabled', streamingEnabled.toString());
  }, [streamingEnabled]);

  useEffect(() => {
    localStorage.setItem('aiMemoryEnabled', aiMemoryEnabled.toString());
  }, [aiMemoryEnabled]);

  useEffect(() => {
    localStorage.setItem('chatHistorySearchEnabled', chatHistorySearchEnabled.toString());
  }, [chatHistorySearchEnabled]);

  useEffect(() => {
    localStorage.setItem('aiPersonality', personality);
  }, [personality]);

  useEffect(() => {
    localStorage.setItem('customInstruction', customInstruction);
  }, [customInstruction]);

  useEffect(() => {
    localStorage.setItem('userNickname', nickname);
  }, [nickname]);

  useEffect(() => {
    localStorage.setItem('userOccupation', occupation);
  }, [occupation]);

  useEffect(() => {
    localStorage.setItem('userMoreAboutYou', moreAboutYou);
  }, [moreAboutYou]);

  // Handle Escape key to close model picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModelPicker) {
        setShowModelPicker(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModelPicker]);

  // Update model picker position when it opens
  useEffect(() => {
    if (showModelPicker && modelPickerButtonRef.current) {
      const rect = modelPickerButtonRef.current.getBoundingClientRect();
      setModelPickerPos({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  }, [showModelPicker]);

  // Clear contextual prompts when input changes significantly
  useEffect(() => {
    if (showContextualPrompts && selectedPromptType && input !== selectedPromptType.text) {
      setShowContextualPrompts(false);
      setSelectedPromptType(null);
    }
  }, [input, showContextualPrompts, selectedPromptType]);

  // Save selected models
  useEffect(() => {
    localStorage.setItem('selectedModels', JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Refocus input when mode changes (pill <-> rectangular) and move cursor to end
  // Track previous mode to detect actual mode changes
  const isPillMode = !input.includes('\n') && inputHeight <= 75;
  const prevPillModeRef = useRef(isPillMode);

  useEffect(() => {
    // Only refocus if mode actually changed AND there's input text
    if (prevPillModeRef.current !== isPillMode && input.length > 0) {
      const timer = setTimeout(() => {
        const ta = inputRef.current;
        if (ta) {
          ta.focus();
          // Move cursor to end of text
          const len = ta.value.length;
          ta.setSelectionRange(len, len);
        }
      }, 10);
      prevPillModeRef.current = isPillMode;
      return () => clearTimeout(timer);
    }
    prevPillModeRef.current = isPillMode;
  }, [isPillMode, input.length]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      const modelsRef = collection(firestore, 'models');
      const snapshot = await getDocs(modelsRef);
      const modelData = snapshot.docs.map(doc => ({
        model: doc.data().model,
        modelID: doc.data().modelID,
        type: doc.data().type,
        inference: doc.data().inference,
        reasoningLevel: doc.data().reasoningLevel,
        hasReasoning: doc.data().hasReasoning,
      }));

      const catalog = buildCatalog(modelData);
      setModels(catalog);

      // Set default model
      if (catalog.length > 0 && !selectedModel) {
        const savedModel = localStorage.getItem('selectedModel');
        const defaultModel = savedModel || catalog[0].id;
        setSelectedModel(defaultModel);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      // Fallback models
      setModels([
        { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', type: 'text' },
        { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', type: 'text' },
      ]);
      if (!selectedModel) {
        setSelectedModel('llama-3.3-70b-versatile');
      }
    }
  };

  const handleCopyMessage = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { /* no-op */ }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if a model supports vision
  const isVisionModel = (modelId: string): boolean => {
    const found = models.find((m) => m.id === modelId);
    return (found?.type || '') === 'vision' || (found?.supportsVision === true);
  };

  // Heuristic to detect vision-capable models by id (in case catalog typing is missing)
  const isLikelyVisionModel = (id: string): boolean => {
    const s = String(id || '').toLowerCase();
    return (
      s.includes('vision') ||
      s.includes('llava') ||
      s.includes('pixtral') ||
      s.includes('gpt-4o') ||
      s.includes('gpt-4-turbo') ||
      s.includes('gemini-1.5') ||
      s.includes('gemini-2.0') ||
      s.includes('claude-3') ||
      s.includes('qwen-vl') ||
      s.includes('qwen2-vl')
    );
  };

  // Handle image file selection
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const available = Math.max(0, 5 - attachedImages.length);
    const toAdd = files.slice(0, available);

    toAdd.forEach((file) => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachedImages((prev) => [...prev, { dataUrl, file }]);
      };
      reader.readAsDataURL(file);
    });

    if (files.length > toAdd.length) {
      alert(`Added ${toAdd.length} images (max 5 total)`);
    }

    setShowAttachMenu(false);
  };

  // Handle PDF file selection
  const handlePDFPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const available = Math.max(0, 5 - attachedPDFs.length);
    const toAdd = files.slice(0, available);

    const validPDFs: AttachedPDF[] = [];
    for (const file of toAdd) {
      const validation = PDFService.validatePDFFile(file);
      if (validation.valid) {
        validPDFs.push({ file, name: file.name });
      } else {
        alert(`${file.name}: ${validation.error || 'Invalid PDF file'}`);
      }
    }

    if (validPDFs.length > 0) {
      setAttachedPDFs((prev) => [...prev, ...validPDFs]);
    }

    if (files.length > toAdd.length) {
      alert(`Added ${toAdd.length} PDFs (max 5 total)`);
    }

    setShowAttachMenu(false);
  };

  // Clear attachments
  const clearAttachment = (type: 'image' | 'pdf', index?: number) => {
    if (index === undefined) {
      setAttachedImages([]);
      setAttachedPDFs([]);
    } else {
      if (type === 'image') {
        setAttachedImages((prev) => prev.filter((_, i) => i !== index));
      } else {
        setAttachedPDFs((prev) => prev.filter((_, i) => i !== index));
      }
    }
  };

  // Generate a concise chat title using AI (Groq)
  const generateAiTitle = async (text: string): Promise<string> => {
    if (!text) return 'New Chat';
    try {
      const { content } = await groqChatCompletion({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You generate short, clear, and specific chat titles (3-6 words). Return only the title, no punctuation around it.' },
          { role: 'user', content: `Create a concise title for this chat based on the user\'s first message.\nMessage: ${text}` },
        ],
      });
      const title = (content || '').trim().replace(/^"|"$/g, '').split('\n')[0].slice(0, 60);
      return title || generateChatTitle(text);
    } catch (e) {
      return generateChatTitle(text);
    }
  };

  const refreshChatHistory = () => {
    const history = getChatHistory();
    setChatHistory(history);
  };

  const scrollToBottom = () => {
    // Prefer scrolling container to bottom for reliability
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Show scroll-to-bottom button if user scrolled up
  const [showScrollDown, setShowScrollDown] = useState(false);
  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const threshold = 120; // px from bottom
    const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < threshold;
    setShowScrollDown(!atBottom);
  };
  const handleSend = async () => {
    if ((!input.trim() && !attachedImages.length && !attachedPDFs.length) || sending) return;

    // Check rate limit
    const rateLimitCheck = await rateLimiter.checkLimit('chat');
    if (!rateLimitCheck.allowed) {
      alert(`Rate limit exceeded. Please wait ${rateLimitCheck.retryAfter} seconds.`);
      return;
    }

    const userText = input.trim();
    const localImages = [...attachedImages];
    const localPDFs = [...attachedPDFs];
    const hasImages = localImages.length > 0;
    const hasPDFs = localPDFs.length > 0;

    // Auto-switch model if enabled
    try {
      const modelEntries: ModelEntry[] = models.map(m => ({
        id: m.id,
        label: m.label || m.id,
        type: m.type || 'text',
        hasReasoning: m.hasReasoning,
        inference: m.inference as any,
        supportsVision: m.supportsVision,
      }));

      const switchedModel = autoSwitchModel(
        userText,
        modelEntries,
        hasImages,
        messages.length,
        selectedModel
      );

      if (switchedModel) {
        console.log(`🔄 Auto-switched to: ${switchedModel}`);
        setSelectedModel(switchedModel);
        localStorage.setItem('selectedModel', switchedModel);
      }
    } catch (error) {
      console.error('Auto-switch error:', error);
    }

    // Store user message in AI memory
    try {
      await maybeStoreFromUserMessage(userText);
    } catch (error) {
      console.error('AI memory error:', error);
    }

    // Prepare attachments data for display
    const attachmentsData: AttachmentData[] = [
      ...localImages.map(img => ({ type: 'image' as const, dataUrl: img.dataUrl })),
      ...localPDFs.map(pdf => ({ type: 'pdf' as const, name: pdf.name }))
    ];

    // User message shown to user (clean, just the text + visual attachments)
    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userText || 'Analyzing attachments...',
      timestamp: Date.now(),
      attachments: attachmentsData.length > 0 ? attachmentsData : undefined,
    };

    // Clear input and attachments immediately
    setInput('');
    setInputHeight(40);
    setAttachedImages([]);
    setAttachedPDFs([]);

    // Create new chat if needed
    let chatId = currentChatId;
    if (!chatId) {
      const firstText = userText || 'Image/File Analysis';
      const fallbackTitle = generateChatTitle(firstText);
      const newChat = createChat(fallbackTitle, selectedModel);
      chatId = newChat.id;
      setCurrentChatId(chatId);
      refreshChatHistory();

      // Non-blocking: try to improve title using AI
      (async () => {
        try {
          const aiTitle = await generateAiTitle(firstText);
          if (aiTitle && aiTitle !== fallbackTitle) {
            updateChat(chatId as string, { title: aiTitle });
            refreshChatHistory();
          }
        } catch { }
      })();
    }

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    addMessage(chatId, userMessage);

    setSending(true);
    setStreamingText('');

    // Process attachments asynchronously
    (async () => {
      const isVision = isVisionModel(selectedModel) || isLikelyVisionModel(selectedModel);

      // Build user message content for API
      let apiUserContent: any = userText;

      // Prepare context prefixes
      const prefaceParts: string[] = [];

      // Handle images for non-vision models using OCR bridge
      if (hasImages && !isVision) {
        try {
          // Use groq vision model to extract text from images
          const bridgePrompt = [
            {
              role: 'system',
              content: 'You are an OCR and transcription assistant. Your task is to TRANSCRIBE ALL TEXT FROM THE IMAGE(S) VERBATIM with original order as much as possible. Do NOT summarize, paraphrase, or omit content. Include headings, questions, options (A/B/C/D), numbers, symbols, and any visible annotations. For math or symbols, transcribe exactly as seen. If multiple images are provided, output them in order with a clear header for each image (e.g., "[Image 1]", "[Image 2]"). If layout is important (like a question paper), preserve line breaks and bullet points. If some text is unclear, mark it as [illegible] without guessing.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Please extract important details from ${localImages.length > 1 ? localImages.length + ' images' : 'this image'}.` },
                ...localImages.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } }))
              ]
            }
          ];

          const { content: imageSummary } = await groqChatCompletion({
            model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
            messages: bridgePrompt,
            temperature: 0.0,
            max_tokens: 4096,
          });

          if (imageSummary) {
            prefaceParts.push(`Image OCR (verbatim):\n${imageSummary}`);
          } else {
            prefaceParts.push(localImages.length > 1 ? 'Images were attached.' : 'An image was attached.');
          }
        } catch (error) {
          console.warn('Vision bridge failed, proceeding without summary', error);
          prefaceParts.push(localImages.length > 1 ? 'Images were attached.' : 'An image was attached.');
        }
      }

      // Handle images for vision models - attach directly
      if (hasImages && isVision) {
        const imageParts = localImages.map(img => ({
          type: 'image_url',
          image_url: { url: img.dataUrl }
        }));
        const parts = [];
        if (userText) parts.push({ type: 'text', text: userText });
        parts.push(...imageParts);
        apiUserContent = parts;
      }

      // Handle PDF files using OCR server
      if (hasPDFs) {
        try {
          const pdfTexts: string[] = [];
          for (let i = 0; i < localPDFs.length; i++) {
            const pdf = localPDFs[i];
            const result = await PDFService.extractTextFromPDF(pdf.file, 1000);
            if (result.success && result.text) {
              const header = localPDFs.length > 1 ? `[PDF ${i + 1}: ${pdf.name}]` : `[PDF: ${pdf.name}]`;
              pdfTexts.push(`${header}\n${result.text}`);
            }
          }
          if (pdfTexts.length > 0) {
            prefaceParts.push(`PDF context:\n${pdfTexts.join('\n\n---\n\n')}`);
          }
        } catch (error) {
          console.warn('PDF OCR failed', error);
        }
      }

      // Build final user content with preface parts for API
      if (prefaceParts.length > 0) {
        const finalUserText = prefaceParts.join('\n\n') + (userText ? `\n\nUser message: ${userText}` : '');
        // For vision models with images, we keep the array format but prepend the text part
        if (hasImages && isVision && Array.isArray(apiUserContent)) {
          apiUserContent[0] = { type: 'text', text: finalUserText };
        } else {
          apiUserContent = finalUserText;
        }
      }

      // Update the user message content with extracted text
      const updatedUserMessage = {
        ...userMessage,
        content: userText || 'Attachments processed.',
      };
      setMessages(prev => prev.map(msg => msg.id === userMessage.id ? updatedUserMessage : msg));
      // Update in storage too
      // Note: addMessage already added it, but we need to update the content
      // For simplicity, we'll just update the in-memory messages for now

      // Now proceed with API call
      await sendToAPI(chatId, updatedMessages, apiUserContent, userText);
    })();
  };

  const sendToAPI = async (chatId: string, updatedMessages: Message[], apiUserContent: any, userText: string) => {
    // Timer used to periodically flush streaming text to the UI
    let flushTimer: ReturnType<typeof setInterval> | null = null;

    try {
      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Prepare messages for API; add a lightweight system steer for reasoning-capable models
      const selectedEntry = models.find((m) => m.id === selectedModel);
      const isReasoningModel = !!selectedEntry?.hasReasoning || selectedEntry?.type === 'reason';
      const sysMsg = isReasoningModel ? { role: 'system', content: `Reasoning effort: ${reasoningLevel}. ${reasoningLevel === 'low' ? 'Prioritize speed and brevity. Provide a concise answer without over-explaining.' : (reasoningLevel === 'high' ? 'Prioritize thoroughness and accuracy. Consider edge cases and provide a well-structured answer. Avoid exposing internal chain-of-thought; share only conclusions.' : 'Balance quality and speed.')}` } : null;

      // Build API messages using OCR-enriched content
      // Compress chat history to reduce tokens: keep user messages, summarize old assistant messages
      const compressedHistory = compressAssistantHistory(updatedMessages.slice(0, -1));
      const apiMessagesForApi = [...compressedHistory.map(m => ({
        role: m.role,
        content: m.content,
      })), {
        role: 'user' as const,
        content: apiUserContent, // Use API content with OCR text
      }];

      // Inject AI Memory context if enabled
      const systemMessages: any[] = [];
      if (sysMsg) systemMessages.push(sysMsg);

      try {
        const memoryPrompt = await buildMemorySystemPrompt();
        if (memoryPrompt) {
          systemMessages.push({ role: 'system', content: memoryPrompt });
        }
      } catch (error) {
        console.error('Memory injection error:', error);
      }

      // Inject date/time context if query is about date/time
      if (isDateTimeQuery(userText)) {
        const dateTimeMsg = createDateTimeSystemMessage();
        systemMessages.push(dateTimeMsg);
      }

      // Inject user name context if query is about their name
      const userNameMsg = maybeInjectUserNameContext(userText);
      if (userNameMsg) {
        systemMessages.push(userNameMsg);
      }

      const apiMessages = systemMessages.length > 0 ? [...systemMessages, ...apiMessagesForApi] : apiMessagesForApi;

      let fullResponse = '';
      streamBufferRef.current = '';
      lastUpdateRef.current = Date.now();

      // Throttled update function - only update UI every 50ms max
      const throttledUpdate = (text: string) => {
        streamBufferRef.current = text;
        const now = Date.now();
        if (now - lastUpdateRef.current >= 50) {
          setStreamingText(text);
          lastUpdateRef.current = now;
        }
      };

      // Safety timer to flush UI at least every 120ms
      flushTimer = setInterval(() => {
        if (streamBufferRef.current && Date.now() - lastUpdateRef.current >= 100) {
          setStreamingText(streamBufferRef.current);
          lastUpdateRef.current = Date.now();
        }
      }, 120);

      // Determine routing based on Firestore 'inference' only. Default is Groq.
      const provider = getProviderName(selectedModel); // for display only
      const rawPref = (selectedEntry?.inference || '').toString().toLowerCase();
      const inferencePref = rawPref === 'openrouter' || rawPref === 'cerebras' || rawPref === 'groq' || rawPref === 'mistral' || rawPref === 'google' ? rawPref : 'groq';

      if (inferencePref === 'groq') {
        // Stream via Groq with retry logic
        await retryWithBackoff(async () => {
          await streamChatCompletion({
            model: selectedModel,
            messages: apiMessages,
            onDelta: (delta) => {
              fullResponse += delta;
              throttledUpdate(fullResponse);
            },
            onDone: (text) => {
              fullResponse = text;
              setStreamingText(text);
            },
            signal: abortControllerRef.current?.signal,
          });
        }, 3, 1000);
      } else if (inferencePref === 'openrouter') {
        // Stream via OpenRouter
        await openRouterStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'cerebras') {
        // Stream via Cerebras API directly
        await cerebrasStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'mistral') {
        // Stream via Mistral API directly
        await mistralStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'google') {
        // Stream via Google Gemini API (via proxy)
        await googleStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else {
        // Fallback: Groq streaming (Note: Groq doesn't support reasoning parameter)
        await streamChatCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        model: selectedModel,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      addMessage(chatId, assistantMessage);
      setStreamingText('');

      // Update chat title using AI if it's still default
      const chat = getChat(chatId);
      if (chat && (chat.title === 'New Chat' || !chat.title)) {
        try {
          const aiTitle = await generateAiTitle(userText || 'Image/File Analysis');
          const finalTitle = aiTitle || generateChatTitle(userText || 'Image/File Analysis');
          updateChat(chatId, { title: finalTitle });
          refreshChatHistory();
        } catch {
          const fallback = generateChatTitle(userText);
          updateChat(chatId, { title: fallback });
          refreshChatHistory();
        }
      }

    } catch (error: any) {
      console.error('Send error:', error);
      if (error.name !== 'AbortError') {
        // Show error message
        const errorMessage: Message = {
          id: `msg_${Date.now()}_error`,
          role: 'assistant',
          content: `Error: ${error.message || 'Failed to get response'}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
      setStreamingText('');
    } finally {
      try { clearInterval(flushTimer as any); } catch { }
      setSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    localStorage.removeItem('lastActiveChatId'); // Clear persisted chat
    setStreamingText('');
    inputRef.current?.focus();
  };

  const loadChat = (chatId: string) => {
    const chat = getChat(chatId);
    if (chat) {
      setMessages(chat.messages || []);
      setCurrentChatId(chatId);
      localStorage.setItem('lastActiveChatId', chatId); // Persist active chat
      if (chat.model) {
        setSelectedModel(chat.model);
      }
      setStreamingText('');
    }
  };

  const handleDeleteChat = (chatId: string) => {
    if (confirm('Delete this chat?')) {
      deleteChatStorage(chatId);
      refreshChatHistory();
      if (currentChatId === chatId) {
        handleNewChat();
      }
    }
  };

  const handleToggleArchive = (chatId: string) => {
    toggleArchive(chatId);
    refreshChatHistory();
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('selectedModel', modelId);
    setShowModelPicker(false);
  };

  const toggleFavoriteModel = (modelId: string) => {
    setFavoriteModels((prev) => {
      const set = new Set(prev);
      if (set.has(modelId)) {
        set.delete(modelId);
      } else {
        set.add(modelId);
      }
      const next = Array.from(set);
      try { localStorage.setItem('favoriteModels', JSON.stringify(next)); } catch { }
      return next;
    });
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setSending(false);
      setStreamingText('');
    }
  };

  // Filter chats
  const archivedChats = chatHistory.filter((c) => c.archived && (searchQuery === '' || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))));
  const activeChats = chatHistory.filter((c) => !c.archived && (searchQuery === '' || c.title.toLowerCase().includes(searchQuery.toLowerCase()) || (c.lastMessage && c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))));

  const selectedModelObj = models.find((m) => m.id === selectedModel) || models[0];
  const selectedEntryForReason = models.find((m) => m.id === selectedModel);
  const isReasoningSelected = !!(selectedEntryForReason?.hasReasoning || selectedEntryForReason?.type === 'reason');
  const isVisionModelSelected = !!(selectedEntryForReason?.supportsVision || selectedEntryForReason?.type === 'vision');
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const setReasoning = (lvl: 'low' | 'medium' | 'high') => { setReasoningLevel(lvl); setShowReasoningMenu(false); };

  // Sidebar hover/menu state
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeChatMenu = () => setMenuOpenChatId(null);

  // Message hover state for action buttons
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Close open chat menu on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpenChatId(null); };
    if (menuOpenChatId) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [menuOpenChatId]);

  // Close menu when clicking anywhere outside the menu
  useEffect(() => {
    if (!menuOpenChatId) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (menuRef.current && t && !menuRef.current.contains(t)) {
        setMenuOpenChatId(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpenChatId]);

  const handleRenameChat = (chatId: string) => {
    const chat = getChat(chatId);
    setRenameChatId(chatId);
    setRenameTitle(chat?.title || '');
    setRenameOpen(true);
  };

  const closeRenameModal = () => {
    setRenameOpen(false);
    setRenameChatId(null);
    setRenameTitle('');
    setRenameBusy(false);
  };

  const saveRename = () => {
    if (!renameChatId) return;
    const title = renameTitle.trim();
    if (!title) return;
    updateChat(renameChatId, { title });
    refreshChatHistory();
    closeRenameModal();
  };

  const generateTitleWithAI = async () => {
    if (!renameChatId || renameBusy) return;
    try {
      setRenameBusy(true);
      const chat = getChat(renameChatId);
      const msgs = chat?.messages || [];
      const firstUserMsg = msgs.find(m => m.role === 'user');
      const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
      const seed = firstUserMsg?.content || lastUserMsg?.content || '';
      const ai = await generateAiTitle(typeof seed === 'string' ? seed : '');
      setRenameTitle(ai || generateChatTitle(typeof seed === 'string' ? seed : ''));
    } catch (e) {
      // fallback: keep current title
    } finally {
      setRenameBusy(false);
    }
  };

  const handleShareChat = async (chatId: string) => {
    const chat = getChat(chatId);
    if (!chat) return;
    const lines = (chat.messages || []).map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content || ''}`);
    const text = `Chat: ${chat.title}\n\n${lines.join('\n')}`;
    try { await navigator.clipboard.writeText(text); alert('Chat copied to clipboard'); } catch { alert('Failed to copy'); }
  };

  // Render message content with our comprehensive Markdown component
  const renderMessageContent = (content: string | any[]) => {
    if (typeof content === 'string') {
      return <MarkdownRenderer content={content} />;
    }
    return null;
  };

  // Prompt suggestion handlers
  const handleChipClick = async (prompt: any) => {
    // Special handling for "Surprise me" - send directly
    if (prompt.title === 'Surprise me') {
      setInput(prompt.text);
      await handleSend();
      return;
    }

    // For other prompts, set input text and show contextual prompts
    setInput(prompt.text);
    setSelectedPromptType(prompt);
    setShowContextualPrompts(true);
  };

  const handleContextualPromptClick = async (contextualText: string) => {
    // Combine the base prompt with the contextual text
    const fullPrompt = `${selectedPromptType?.text} ${contextualText}`.trim();

    // Clear contextual prompts and input
    setShowContextualPrompts(false);
    setSelectedPromptType(null);
    setInput('');

    // Send the combined message
    setInput(fullPrompt);
    await handleSend();
  };

  const clearContextualPrompts = () => {
    setShowContextualPrompts(false);
    setSelectedPromptType(null);
    setInput('');
    setInputHeight(40);
  };

  // Edit user message
  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || message.role !== 'user') return;

    // Set input to message content
    const content = typeof message.content === 'string' ? message.content : '';
    setInput(content);

    // Remove all messages from this point forward
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      const newMessages = messages.slice(0, messageIndex);
      setMessages(newMessages);

      // Update chat storage
      if (currentChatId) {
        const chat = getChat(currentChatId);
        if (chat) {
          updateChat(currentChatId, { messages: newMessages });
        }
      }
    }

    // Focus input
    inputRef.current?.focus();
  };

  // Regenerate assistant response
  const handleRegenerateResponse = async (messageId: string) => {
    if (sending) return; // Prevent if already sending

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Find the user message that prompted this response
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) return;

    const userMessage = messages[userMessageIndex];

    // Remove the assistant message and everything after it (keep user message)
    const newMessages = messages.slice(0, messageIndex);
    setMessages(newMessages);

    // Update chat storage
    if (currentChatId) {
      const chat = getChat(currentChatId);
      if (chat) {
        updateChat(currentChatId, { messages: newMessages });
      }
    }

    // Directly trigger streaming with existing messages (don't add duplicate user message)
    setSending(true);
    setStreamingText('');

    const selectedEntry = models.find((m) => m.id === selectedModel);
    if (!selectedEntry) {
      setSending(false);
      return;
    }

    try {
      // Stream response directly without adding a new user message
      await streamResponse(newMessages, selectedEntry);
    } catch (error) {
      console.error('Regenerate failed:', error);
      setSending(false);
    }
  };

  // Helper function to send message with specific content
  const sendMessageWithContent = async (content: string, attachments: AttachmentData[] = []) => {
    if (!content.trim() && attachments.length === 0) return;
    if (!selectedModel) return;

    const selectedEntry = models.find((m) => m.id === selectedModel);
    if (!selectedEntry) return;

    // Build message content
    let messageContent: string | any[] = content;
    if (attachments.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: content }];
      attachments.forEach((att) => {
        if (att.type === 'image') {
          contentParts.push({
            type: 'image_url',
            image_url: { url: att.dataUrl },
          });
        } else if (att.type === 'pdf') {
          contentParts.push({
            type: 'text',
            text: `[PDF: ${att.name}]\n${att.text || ''}`,
          });
        }
      });
      messageContent = contentParts;
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    if (currentChatId) {
      await addMessage(currentChatId, userMessage);
    }

    // Clear input and attachments
    setInput('');
    setInputHeight(40);
    setAttachedImages([]);
    setAttachedPDFs([]);

    // Stream response (reuse existing streaming logic)
    await streamResponse(updatedMessages, selectedEntry);
  };

  // Extract streaming logic into separate function
  const streamResponse = async (messageHistory: Message[], selectedEntry: any) => {
    const abortControllerRef = { current: new AbortController() };
    let flushTimer: any = null;
    const streamBufferRef = { current: '' };
    const lastUpdateRef = { current: Date.now() };

    try {
      const compressedMessages = compressAssistantHistory(messageHistory);
      const apiMessagesForApi = compressedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let sysMsg = null;
      if (apiMessagesForApi.length > 0 && (apiMessagesForApi[0] as any).role === 'system') {
        sysMsg = apiMessagesForApi.shift();
      }
      const apiMessages = sysMsg ? [sysMsg, ...compressedMessages] : compressedMessages;

      let fullResponse = '';
      streamBufferRef.current = '';
      lastUpdateRef.current = Date.now();

      const throttledUpdate = (text: string) => {
        streamBufferRef.current = text;
        const now = Date.now();
        if (now - lastUpdateRef.current >= 50) {
          setStreamingText(text);
          lastUpdateRef.current = now;
        }
      };

      flushTimer = setInterval(() => {
        if (streamBufferRef.current && Date.now() - lastUpdateRef.current >= 100) {
          setStreamingText(streamBufferRef.current);
          lastUpdateRef.current = Date.now();
        }
      }, 120);

      const rawPref = (selectedEntry?.inference || '').toString().toLowerCase();
      const inferencePref = rawPref === 'openrouter' || rawPref === 'cerebras' || rawPref === 'groq' || rawPref === 'mistral' || rawPref === 'google' ? rawPref : 'groq';

      if (inferencePref === 'groq') {
        await streamChatCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'openrouter') {
        await openRouterStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'cerebras') {
        await cerebrasStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'mistral') {
        await mistralStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else if (inferencePref === 'google') {
        await googleStreamCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      } else {
        await streamChatCompletion({
          model: selectedModel,
          messages: apiMessages,
          onDelta: (delta) => {
            fullResponse += delta;
            throttledUpdate(fullResponse);
          },
          onDone: (text) => {
            fullResponse = text;
            setStreamingText(text);
          },
          signal: abortControllerRef.current.signal,
        });
      }

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now(),
        model: selectedModel,
      };

      const finalMessages = [...messageHistory, assistantMessage];
      setMessages(finalMessages);
      setStreamingText('');

      if (currentChatId) {
        await addMessage(currentChatId, assistantMessage);
      }
    } catch (error: any) {
      console.error('Streaming error:', error);
      setStreamingText('');
      if (error?.message && !error.message.includes('aborted')) {
        alert(`Error: ${error.message}`);
      }
    } finally {
      if (flushTimer) clearInterval(flushTimer);
      setSending(false);
    }
  };

  // Animation functions for smooth expand/collapse
  const expandPrompts = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowAllPrompts(true);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const collapsePrompts = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setShowAllPrompts(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Compute visible prompts (first 6, or all if expanded)
  const visiblePrompts = showAllPrompts ? BASE_PROMPTS : BASE_PROMPTS.slice(0, 6);

  // Icon mapping from app icon names to lucide-react components
  const getIconComponent = (iconName: string) => {
    const iconMap: { [key: string]: any } = {
      'lightbulb-on-outline': Lightbulb,
      'eye-outline': Eye,
      'file-document-outline': FileTextIcon,
      'lightbulb-outline': LightbulbIcon,
      'chart-box-outline': BarChart3,
      'pencil-outline': Pencil,
      'school-outline': School,
      'code-tags': Code,
      'dice-5-outline': Dice5,
    };
    return iconMap[iconName] || Lightbulb;
  };

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100dvh',
      minHeight: '100svh',
      maxWidth: '100vw',
      background: theme.colors.background,
      color: theme.colors.text,
      fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      overscrollBehavior: 'none',
      position: 'relative',
    }}>
      {/* Clean background without decorative geometry */}

      {/* Sidebar */}
      <div style={{
        // Overlay full screen on mobile, fixed position
        position: isMobile ? 'fixed' as const : 'relative' as const,
        left: isMobile ? 0 : undefined,
        top: isMobile ? 0 : undefined,
        width: isMobile ? (sidebarOpen ? '100vw' : '0') : (sidebarOpen ? '260px' : '60px'),
        minWidth: isMobile ? '0' : (sidebarOpen ? '260px' : '60px'),
        background: sidebarOpen ? theme.colors.surface : 'rgb(33, 33, 33)',
        borderRight: sidebarOpen ? 'none' : '1px solid rgb(44, 44, 44)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        height: isMobile ? '100dvh' : '100%',
        minHeight: 0,
        zIndex: isMobile ? 1000 : 'auto',
        pointerEvents: isMobile ? (sidebarOpen ? 'auto' : 'none') : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}>
        {/* Collapsed Sidebar (Icon-only) - Desktop Only */}
        {!sidebarOpen && !isMobile && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '12px 0',
            alignItems: 'center',
            gap: '8px',
          }}
            onMouseEnter={(e) => {
              const container = e.currentTarget;
              const svg = container.querySelector('svg[data-rtl-flip]');
              const lottieDiv = container.querySelector('div[data-lottie]');
              if (svg) (svg as any).style.opacity = '1';
              if (lottieDiv) (lottieDiv as HTMLElement).style.opacity = '0';
            }}
            onMouseLeave={(e) => {
              const container = e.currentTarget;
              const svg = container.querySelector('svg[data-rtl-flip]');
              const lottieDiv = container.querySelector('div[data-lottie]');
              if (svg) (svg as any).style.opacity = '0';
              if (lottieDiv) (lottieDiv as HTMLElement).style.opacity = '1';
            }}
          >
            {/* Expand Sidebar Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              title="Expand sidebar"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'transparent',
                border: 'none',
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {appAnimation && (
                <div
                  data-lottie="true"
                  style={{
                    position: 'absolute',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 1,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none',
                  }}>
                  <Lottie
                    animationData={appAnimation}
                    loop={true}
                    autoplay={true}
                    style={{ width: 32, height: 32 }}
                  />
                </div>
              )}
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                data-rtl-flip=""
                className="icon max-md:hidden"
                style={{
                  transition: 'opacity 0.2s ease',
                  opacity: 0,
                }}
              >
                <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
              </svg>
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              title="New chat"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'transparent',
                border: 'none',
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon" aria-hidden="true"><path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path></svg>
            </button>

            {/* Search Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              title="Search"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'transparent',
                border: 'none',
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon" aria-hidden="true"><path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path></svg>
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* User Profile Button at Bottom */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title={user?.displayName || 'User'}
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: avatarBgColor || '#1f2937',
                border: `1px solid ${theme.colors.border}`,
                color: '#e5e7eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '400',
                transition: 'all 0.15s ease',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {avatarBgColor ? <span>{initials}</span> : null}
            </button>
          </div>
        )}

        {/* Expanded Sidebar - Full Width */}
        {sidebarOpen && (
          <>
            {/* Sidebar Header - Logo and Collapse */}
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Logo */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {appAnimation && (
                  <Lottie
                    animationData={appAnimation}
                    loop={true}
                    autoplay={true}
                    style={{ width: 32, height: 32 }}
                  />
                )}
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'transparent',
                  border: 'none',
                  color: theme.colors.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-rtl-flip="" className="icon max-md:hidden"><path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path></svg>
              </button>
            </div>

            {/* Main Actions */}
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {/* New chat */}
                <button
                  onClick={handleNewChat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '400',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon" aria-hidden="true"><path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path></svg>
                  <span>New chat</span>
                </button>

                {/* Search chats */}
                <button
                  onClick={() => {
                    // Focus search input
                    const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
                    searchInput?.focus();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: theme.colors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '400',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon" aria-hidden="true"><path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path></svg>
                  <span>Search chats</span>
                </button>
              </div>
            </div>



            {/* Chat History */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
              {activeChats.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    padding: '8px 0', color: theme.colors.textMuted,
                    fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    Chats ({activeChats.length})
                  </div>
                  {activeChats.map((chat) => (
                    <div
                      key={chat.id}
                      onMouseEnter={() => setHoveredChatId(chat.id)}
                      onMouseLeave={() => { if (hoveredChatId === chat.id) setHoveredChatId(null); }}
                      onClick={() => loadChat(chat.id)}
                      style={{
                        position: 'relative',
                        padding: '4px 12px', borderRadius: '12px', cursor: 'pointer', marginBottom: '2px',
                        background: (currentChatId === chat.id || hoveredChatId === chat.id)
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'transparent',
                        border: currentChatId === chat.id ? `1px solid ${theme.colors.borderLight}` : '1px solid transparent',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: theme.colors.text, fontSize: '14px', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.title}
                        </div>

                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenChatId(chat.id); }}
                        title="More"
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: 'transparent', border: 'none',
                          color: theme.colors.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: hoveredChatId === chat.id ? 1 : 0,
                          pointerEvents: hoveredChatId === chat.id ? 'auto' : 'none',
                        }}
                      >
                        <MoreHorizontal size={20} />
                      </button>

                      {menuOpenChatId === chat.id && (
                        <>
                          <div ref={menuRef} style={{ position: 'absolute', right: 8, top: 40, zIndex: 1001, background: theme.colors.surfaceAlt, border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                            <div onClick={() => { closeChatMenu(); handleShareChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: theme.colors.text, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                              <Share2 size={14} /> <span>Share</span>
                            </div>
                            <div onClick={() => { closeChatMenu(); handleRenameChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: theme.colors.text, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                              <Edit3 size={14} /> <span>Rename</span>
                            </div>
                            <div onClick={() => { closeChatMenu(); handleToggleArchive(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: theme.colors.text, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.06)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                              <Archive size={14} /> <span>{chat.archived ? 'Unarchive' : 'Archive'}</span>
                            </div>
                            <div onClick={() => { closeChatMenu(); handleDeleteChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: theme.colors.error, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(239,68,68,0.12)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                              <Trash2 size={14} /> <span>Delete</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {archivedChats.length > 0 && archiveExpanded && (
                <div>
                  <div style={{ padding: '8px 0', borderTop: `1px solid ${theme.colors.border}`, marginTop: '12px' }}>
                    <div style={{ color: theme.colors.textMuted, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Archived
                    </div>
                  </div>
                  {archivedChats.map((chat) => (
                    <div
                      key={chat.id}
                      onMouseEnter={() => setHoveredChatId(chat.id)}
                      onMouseLeave={() => { if (hoveredChatId === chat.id) setHoveredChatId(null); }}
                      onClick={() => loadChat(chat.id)}
                      style={{
                        position: 'relative',
                        padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px', opacity: 0.92,
                        display: 'flex', alignItems: 'center', gap: '10px',
                        background: hoveredChatId === chat.id ? 'rgb(48, 48, 48)' : 'transparent',
                      }}
                    >
                      <div style={{ color: theme.colors.text, fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{chat.title}</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenChatId(chat.id); }}
                        title="More"
                        style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hoveredChatId === chat.id ? 1 : 0, pointerEvents: hoveredChatId === chat.id ? 'auto' : 'none' }}
                      >
                        <MoreHorizontal size={20} />
                      </button>
                      {menuOpenChatId === chat.id && (
                        <>
                          <div ref={menuRef} style={{ position: 'absolute', right: 8, top: 40, zIndex: 1001, background: 'rgba(26,28,34,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
                            <div onClick={() => { closeChatMenu(); handleShareChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap' }}>Share</div>
                            <div onClick={() => { closeChatMenu(); handleRenameChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap' }}>Rename</div>
                            <div onClick={() => { closeChatMenu(); handleToggleArchive(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: '#e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap' }}>{chat.archived ? 'Unarchive' : 'Archive'}</div>
                            <div onClick={() => { closeChatMenu(); handleDeleteChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color: '#fca5a5', cursor: 'pointer', whiteSpace: 'nowrap' }}>Delete</div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Account Section */}
            <div style={{ padding: '14px', borderTop: `1px solid ${theme.colors.border}` }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '12px',
              }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `1px solid ${theme.colors.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: avatarBgColor || '#1f2937' }}>
                  {avatarBgColor ? (
                    <span style={{ fontSize: '16px', fontWeight: 400, color: '#e5e7eb' }}>
                      {initials}
                    </span>
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.displayName || 'User'}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email || 'Not signed in'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMobileModal(true);
                    }}
                    title="Download Mobile App"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: theme.colors.textMuted,
                      transition: 'color 0.2s',
                      borderRadius: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.primary;
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <Smartphone size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSettingsModal(true);
                    }}
                    title="Settings"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: theme.colors.textMuted,
                      transition: 'color 0.2s',
                      borderRadius: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = theme.colors.primary;
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.colors.textMuted;
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    <Settings size={18} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden', // prevent children from pushing height
        height: '100%',
        position: 'relative',
      }}>
        {/* Top Header Bar with Model Selector and Sidebar Toggle */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: '4px',
          background: 'linear-gradient(180deg, rgba(33, 33, 33, 0.95) 0%, rgba(33, 33, 33, 0.7) 70%, transparent 100%)',
          backdropFilter: 'blur(8px)',
        }}>
          {/* Model Selector */}
          <div style={{ position: 'relative' }}>
            <button ref={modelPickerButtonRef} onClick={() => setShowModelPicker(!showModelPicker)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
              background: 'transparent', border: 'none',
              borderRadius: '14px', color: '#fff', fontSize: '18px', fontWeight: '400', cursor: 'pointer',
              transition: 'background 0.2s ease',
              maxWidth: '280px',
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgb(66, 66, 66)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedModelObj?.label || 'Select Model'}
              </span>
              <ChevronDown size={16} style={{ color: 'rgb(174, 174, 174)' }} />
            </button>

            {showModelPicker && ReactDOM.createPortal(
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowModelPicker(false)} />
                <div style={{ position: 'fixed', top: `${modelPickerPos.top}px`, left: `${modelPickerPos.left}px`, minWidth: '340px', maxWidth: '420px', maxHeight: '520px', overflowY: 'auto', background: 'rgb(53, 53, 53)', border: 'none', borderRadius: '20px', padding: '0', zIndex: 1500, boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)', scrollbarWidth: 'none' }} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const favoritesSet = new Set(favoriteModels);

                    const Card = ({ model }: { model: CatalogEntry }) => {
                      const inferenceName = model.inference || 'groq';
                      const inferenceDisplay = inferenceName.charAt(0).toUpperCase() + inferenceName.slice(1);
                      const inferenceColors: Record<string, { bg: string; text: string }> = {
                        groq: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c' },
                        mistral: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
                        cerebras: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
                        openrouter: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
                        google: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80' },
                      };
                      const inferenceStyle = inferenceColors[inferenceName.toLowerCase()] || inferenceColors.groq;
                      const isFav = favoritesSet.has(model.id);
                      return (
                        <div
                          onClick={() => handleModelSelect(model.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 8px', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: 'none', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(74, 74, 74)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '400', color: theme.colors.text, marginBottom: '4px', lineHeight: '1.3' }}>{model.label}</div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', color: theme.colors.textSecondary }}>
                              <span>{(model.inference || 'groq').charAt(0).toUpperCase() + (model.inference || 'groq').slice(1)}</span>
                              <span>•</span>
                              <span>{model.provider || getProviderName(model.id)}</span>
                              <span>•</span>
                              <span>{model.type}</span>
                            </div>
                          </div>
                          {selectedModel === model.id && (
                            <Check size={18} color="#fff" strokeWidth={3} style={{ flexShrink: 0 }} />
                          )}
                        </div>
                      );
                    };

                    const Section = ({ title, items }: { title: string; items: CatalogEntry[] }) => (
                      items.length === 0 ? null : (
                        <div style={{ marginBottom: 0 }}>
                          <div style={{ position: 'sticky', top: 0, fontSize: 12, fontWeight: 700, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0', padding: '8px 14px', background: 'rgb(53, 53, 53)', zIndex: 10 }}>{title}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 8px' }}>
                            {items.map(m => <Card key={m.id} model={m} />)}
                          </div>
                        </div>
                      )
                    );

                    const byProvider = (provider: string) => models.filter(m => (m.provider || getProviderName(m.id)).toLowerCase() === provider.toLowerCase());

                    // Get unique providers from all models
                    const uniqueProviders = Array.from(new Set(models.map(m => (m.provider || getProviderName(m.id)).toLowerCase()))).sort();

                    const groqModels = byProvider('groq').sort((a, b) => a.label.localeCompare(b.label));
                    const cerebraModels = byProvider('cerebras').sort((a, b) => a.label.localeCompare(b.label));
                    const mistralModels = byProvider('mistral').sort((a, b) => a.label.localeCompare(b.label));
                    const googleModels = byProvider('google').sort((a, b) => a.label.localeCompare(b.label));
                    const openrouterModels = byProvider('openrouter').sort((a, b) => a.label.localeCompare(b.label));

                    return (
                      <>
                        {uniqueProviders.map(provider => {
                          const providerCapitalized = provider.charAt(0).toUpperCase() + provider.slice(1);
                          const providerModels = byProvider(provider).sort((a, b) => a.label.localeCompare(b.label));
                          return <Section key={provider} title={providerCapitalized} items={providerModels} />;
                        })}
                      </>
                    );
                  })()}
                </div>
              </>,
              document.body
            )}
          </div >
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} onScroll={handleScroll} style={{
          flex: '1 1 0%',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px',
          paddingTop: '80px', // make room for top header
          paddingBottom: messages.length === 0 ? '280px' : '140px', // extra space when welcome showing
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          overscrollBehavior: 'contain', // isolate scroll here
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.length === 0 && !streamingText ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              flex: 1,
              minHeight: 0,
              paddingBottom: '280px',
              padding: '40px 20px',
              pointerEvents: 'none',
            }}>
              {/* Simple greeting text like ChatGPT */}
              <div style={{
                fontSize: '32px',
                fontWeight: '300',
                color: theme.colors.text,
                textAlign: 'center',
                marginBottom: '0px',
                letterSpacing: '-0.02em',
                fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}>
                {randomWelcomeMessage || 'How can I help you today?'}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, msgIndex) => {
                const isLastAssistantMessage = msg.role === 'assistant' && msgIndex === messages.length - 1;
                const showActions = msg.role === 'user' ? hoveredMessageId === msg.id : isLastAssistantMessage;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '900px', width: '100%', margin: '0 auto',
                      gap: 6,
                      animation: 'sa-fade-in .18s ease',
                      position: 'relative',
                      paddingBottom: '36px', // Add space for absolutely positioned buttons
                    }}
                    onMouseEnter={() => msg.role === 'user' && setHoveredMessageId(msg.id)}
                    onMouseLeave={() => msg.role === 'user' && setHoveredMessageId(null)}
                  >
                    <div style={msg.role === 'user' ? {
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: 20,
                      padding: '8px 16px',
                      maxWidth: '80%',
                      position: 'relative',
                    } : {
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      width: '100%',
                      maxWidth: '100%',
                      color: theme.colors.text,
                      position: 'relative',
                    }}>
                      {/* Show attachments if present */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          padding: '12px 0',
                          paddingTop: msg.role === 'user' ? '12px' : '0',
                        }}>
                          {msg.attachments.map((att, idx) => (
                            att.type === 'image' ? (
                              <div key={idx} style={{
                                position: 'relative',
                                width: '120px',
                                height: '120px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '2px solid rgba(99, 102, 241, 0.3)',
                                background: 'rgba(0, 0, 0, 0.3)',
                                cursor: 'pointer',
                              }}
                                onClick={() => window.open(att.dataUrl, '_blank')}
                              >
                                <img
                                  src={att.dataUrl}
                                  alt={`Attachment ${idx + 1}`}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </div>
                            ) : (
                              <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '2px solid rgba(59, 130, 246, 0.3)',
                                minWidth: '180px',
                                maxWidth: '250px',
                              }}>
                                <FileText size={20} color="#60a5fa" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#f3f4f6',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {att.name || 'Document.pdf'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                    PDF Document
                                  </div>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      {renderMessageContent(msg.content)}
                    </div>

                    {/* Action buttons */}
                    {showActions && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-8px',
                        right: msg.role === 'user' ? '0' : 'auto',
                        left: msg.role === 'user' ? 'auto' : '0',
                        display: 'flex',
                        gap: '4px',
                      }}>
                        {msg.role === 'user' ? (
                          <>
                            {/* Copy button for user messages - icon only */}
                            <button
                              onClick={() => handleCopyMessage(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))}
                              title="Copy message"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            >
                              <Copy size={14} />
                            </button>
                            {/* Edit button for user messages - icon only */}
                            <button
                              onClick={() => handleEditMessage(msg.id)}
                              title="Edit message"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            >
                              <Edit3 size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Copy button for assistant messages - icon only */}
                            <button
                              onClick={() => handleCopyMessage(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))}
                              title="Copy message"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            >
                              <Copy size={14} />
                            </button>
                            {/* Regenerate button for assistant messages - icon only */}
                            <button
                              onClick={() => handleRegenerateResponse(msg.id)}
                              title="Regenerate response"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                            >
                              <RefreshCw size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '900px', width: '100%', margin: '0 auto', gap: 10 }}>
                  <div style={{ background: 'transparent', border: 'none', padding: 0, maxWidth: '100%', color: theme.colors.text }}>
                    {renderMessageContent(streamingText)}
                  </div>
                </div>
              )}
              {sending && !streamingText && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: '900px', width: '100%', margin: '0 auto', gap: 10 }}>
                  <div style={{ padding: '12px 0' }}>
                    {dotsAnimation ? (
                      <Lottie
                        animationData={dotsAnimation}
                        loop={true}
                        autoplay={true}
                        style={{ width: 90, height: 90 }}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <div key={i} style={{
                            width: 8, height: 8, borderRadius: 999, background: '#10b981',
                            animation: 'sa-pulse 1.2s infinite ease-in-out', animationDelay: `${delay}s`,
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollDown && (
          <div style={{ position: 'absolute', right: 20, bottom: 110, zIndex: 5 }}>
            <button onClick={scrollToBottom} title="Scroll to latest" style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              border: `1px solid ${theme.colors.border}`,
              background: 'rgba(255,255,255,0.08)',
              color: theme.colors.text,
              cursor: 'pointer',
              // Remove heavy shadow for minimalism
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ChevronDown size={18} />
            </button>
          </div>
        )}

        {/* Footer - Floating Input */}
        <div style={{
          position: 'absolute',
          left: 0, right: 0,
          // When no messages: position centered, just above input
          // When messages exist: anchor at bottom
          ...(messages.length === 0 ? {
            top: '50%',
            bottom: 'auto',
            transform: 'translateY(-50%)',
          } : {
            top: 'auto',
            bottom: 0,
            transform: 'translateY(0)',
          }),
          padding: '16px',
          paddingBottom: messages.length === 0 ? '16px' : 'calc(16px + env(safe-area-inset-bottom, 0px))',
          background: 'transparent',
          pointerEvents: 'none', // allow messages to scroll beneath, inner card will enable interactions
          transition: 'top 0.3s ease, bottom 0.3s ease, transform 0.3s ease',
        }}>

          <div style={{ maxWidth: '920px', margin: '0 auto', pointerEvents: 'auto' }}>
            {(() => {
              // Use the isPillMode computed at component level
              // Pill mode: horizontal layout (plus, auto, input, send)
              // Rectangular mode: grid layout with controls below
              if (isPillMode) {
                return (
                  <div style={{
                    background: 'rgb(48, 48, 48)',
                    border: '1px solid #444444',
                    borderRadius: '45px',
                    padding: '6px 12px',
                    boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    {/* Attachment button */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input type="file" id="image-picker" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImagePick} />
                      <input type="file" id="pdf-picker" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handlePDFPick} />
                      <button
                        onClick={() => setShowAttachMenu(!showAttachMenu)}
                        title="Attach files"
                        style={{
                          width: '40px',
                          height: '42px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '50%',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                        onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.textSecondary}
                      >
                        <Plus size={28} />
                      </button>
                      {/* Attachment menu */}
                      {showAttachMenu && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowAttachMenu(false)} />
                          <div style={{
                            position: 'absolute', bottom: '55px', left: 0, minWidth: '220px',
                            background: 'rgb(58, 58, 58)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
                            padding: '10px', zIndex: 1500, boxShadow: '0 12px 48px rgba(0,0,0,0.6)'
                          }}>
                            <button onClick={() => { document.getElementById('image-picker')?.click(); setShowAttachMenu(false); }}
                              style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', color: theme.colors.text, textAlign: 'left', cursor: 'pointer', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', fontWeight: 500 }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(74, 74, 74)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <ImageIcon size={20} /> Add Images
                            </button>
                            <button onClick={() => { document.getElementById('pdf-picker')?.click(); setShowAttachMenu(false); }}
                              style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', color: theme.colors.text, textAlign: 'left', cursor: 'pointer', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', fontWeight: 500 }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgb(74, 74, 74)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <FileText size={20} /> Add PDFs
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Auto-switch toggle */}
                    <button
                      onClick={() => {
                        const newValue = !autoSwitch;
                        setAutoSwitch(newValue);
                        setAutoSwitchEnabled(newValue);
                      }}
                      title={autoSwitch ? "Auto-switch: ON" : "Auto-switch: OFF"}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '36px',
                        background: 'transparent', border: 'none', borderRadius: '18px',
                        color: autoSwitch ? '#10b981' : theme.colors.textSecondary,
                        fontSize: 14, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={22} fill={autoSwitch ? '#10b981' : 'none'} />
                      <span>Auto</span>
                    </button>

                    {/* Textarea - grows to fill space */}
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setInput(newValue);
                        // In pill mode, check if we need to switch to rectangular
                        // Only switch if there's a newline or text is very long
                        if (newValue.includes('\n')) {
                          setInputHeight(50); // Force switch to rectangular
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask anything"
                      disabled={sending}
                      rows={1}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '36px',
                        minHeight: '36px',
                        maxHeight: '36px',
                        padding: '0 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'ui-sans-serif, sans-serif',
                        resize: 'none',
                        outline: 'none',
                        lineHeight: '36px',
                        overflow: 'hidden',
                      }}
                    />

                    {/* Send button */}
                    {sending ? (
                      <button onClick={handleStopGeneration} style={{
                        width: '36px', height: '36px', borderRadius: '50%', background: theme.colors.text, border: 'none',
                        color: theme.colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        flexShrink: 0,
                      }}>
                        <Square size={14} fill="currentColor" />
                      </button>
                    ) : (
                      <button onClick={handleSend} disabled={!input.trim()} style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: input.trim() ? '#fff' : 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: input.trim() ? '#000' : 'rgba(255,255,255,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}>
                        <ArrowUp size={16} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              }

              // Rectangular mode - multiline input
              return (
                <div style={{
                  background: 'rgb(48, 48, 48)',
                  border: '1px solid #444444',
                  borderRadius: '16px',
                  padding: '12px',
                  boxShadow: '0 0 10px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  {/* Attachments preview area */}
                  {(attachedImages.length > 0 || attachedPDFs.length > 0) && (
                    <div style={{
                      display: 'flex',
                      gap: '10px',
                      overflowX: 'auto',
                      paddingBottom: '8px',
                    }}>
                      {attachedImages.map((img, index) => (
                        <div key={index} style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
                          <img src={img.dataUrl} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${theme.colors.border}` }} />
                          <button
                            onClick={() => clearAttachment('image', index)}
                            style={{
                              position: 'absolute', top: -6, right: -6, width: '20px', height: '20px', borderRadius: '50%',
                              background: 'rgba(0,0,0,0.8)', border: `1px solid ${theme.colors.border}`, color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {attachedPDFs.map((pdf, index) => (
                        <div key={index} style={{
                          position: 'relative', width: '160px', height: '60px', flexShrink: 0,
                          background: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.colors.border}`, borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                            <FileText size={16} color={theme.colors.textSecondary} />
                            <div style={{ fontSize: '12px', color: theme.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {pdf.name}
                            </div>
                          </div>
                          <button
                            onClick={() => clearAttachment('pdf', index)}
                            style={{
                              position: 'absolute', top: -6, right: -6, width: '20px', height: '20px', borderRadius: '50%',
                              background: 'rgba(255,255,255,0.14)',
                              border: `1px solid ${theme.colors.border}`,
                              color: theme.colors.text,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 0,
                            }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setInput(newValue);
                      const ta = e.currentTarget;
                      ta.style.height = 'auto';
                      const scrollH = ta.scrollHeight;
                      const newHeight = Math.min(160, Math.max(38, scrollH));
                      ta.style.height = newHeight + 'px';

                      // Switch back to pill mode if there are no newlines
                      // The pill textarea will handle overflow with text-overflow
                      if (!newValue.includes('\n')) {
                        setInputHeight(40); // Reset to pill mode
                      } else {
                        setInputHeight(newHeight);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask anything"
                    disabled={sending}
                    style={{
                      width: '100%',
                      minHeight: '38px',
                      maxHeight: '160px',
                      padding: '8px 0',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '16px',
                      fontFamily: 'ui-sans-serif, sans-serif',
                      resize: 'none',
                      outline: 'none',
                      lineHeight: '1.5',
                    }}
                  />

                  {/* Bottom Controls Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Left Controls: Attachment & Auto */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Attachment button with menu */}
                      <div style={{ position: 'relative' }}>
                        <input type="file" id="image-picker-rect" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImagePick} />
                        <input type="file" id="pdf-picker-rect" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handlePDFPick} />
                        <button
                          onClick={() => setShowAttachMenu(!showAttachMenu)}
                          title="Attach files"
                          style={{
                            width: '38px',
                            height: '38px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '50%',
                            color: theme.colors.textSecondary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = theme.colors.text}
                          onMouseLeave={(e) => e.currentTarget.style.color = theme.colors.textSecondary}
                        >
                          <Plus size={24} />
                        </button>
                        {/* Attachment menu */}
                        {showAttachMenu && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setShowAttachMenu(false)} />
                            <div style={{
                              position: 'absolute', bottom: '48px', left: 0, minWidth: '200px',
                              background: '#2a2a2a', border: `1px solid ${theme.colors.border}`, borderRadius: '12px',
                              padding: '8px', zIndex: 1500, boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                            }}>
                              <button onClick={() => { document.getElementById('image-picker-rect')?.click(); setShowAttachMenu(false); }}
                                style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: theme.colors.text, textAlign: 'left', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <ImageIcon size={18} /> Add Images
                              </button>
                              <button onClick={() => { document.getElementById('pdf-picker-rect')?.click(); setShowAttachMenu(false); }}
                                style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: theme.colors.text, textAlign: 'left', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <FileText size={18} /> Add PDFs
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Auto-switch toggle */}
                      <button
                        onClick={() => {
                          const newValue = !autoSwitch;
                          setAutoSwitch(newValue);
                          setAutoSwitchEnabled(newValue);
                        }}
                        title={autoSwitch ? "Auto-switch: ON" : "Auto-switch: OFF"}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: '38px',
                          background: 'transparent', border: 'none', borderRadius: '19px',
                          color: autoSwitch ? '#10b981' : theme.colors.textSecondary,
                          fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease'
                        }}
                      >
                        <Zap size={16} fill={autoSwitch ? '#10b981' : 'none'} />
                        <span>Auto</span>
                      </button>
                    </div>

                    {/* Right Controls: Reasoning & Send */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {isReasoningSelected && (
                        <button onClick={() => setShowReasoningMenu(v => !v)} title="Reasoning level"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: '38px',
                            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '19px',
                            color: theme.colors.textSecondary, fontSize: 12, cursor: 'pointer'
                          }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: theme.colors.primary, display: 'inline-block' }} />
                          <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{reasoningLevel}</span>
                        </button>
                      )}

                      {sending ? (
                        <button onClick={handleStopGeneration} style={{
                          width: '38px', height: '38px', borderRadius: '50%', background: theme.colors.text, border: 'none',
                          color: theme.colors.background, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                        }}>
                          <Square size={14} fill="currentColor" />
                        </button>
                      ) : (
                        <button onClick={handleSend} disabled={!input.trim()} style={{
                          width: '38px', height: '38px', borderRadius: '50%',
                          background: input.trim() ? '#fff' : 'rgba(255,255,255,0.1)',
                          border: 'none',
                          color: input.trim() ? '#000' : 'rgba(255,255,255,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s ease'
                        }}>
                          <ArrowUp size={18} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Rename Chat Modal */}
      {
        renameOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
            <div onClick={closeRenameModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 92vw)' }}>
              <div style={{ background: 'rgba(20,22,28,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800, color: theme.colors.text }}>Rename Chat</div>
                  <button onClick={closeRenameModal} title="Close" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.06)', color: theme.colors.text, cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ fontSize: 12, color: theme.colors.textMuted, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Title</label>
                  <input
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (renameTitle || '').trim()) saveRename(); }}
                    placeholder="Enter a chat title"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.04)', color: theme.colors.text, outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                    <button onClick={generateTitleWithAI} disabled={renameBusy} title="Generate with AI" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.06)', color: theme.colors.text, cursor: renameBusy ? 'not-allowed' : 'pointer', opacity: renameBusy ? 0.6 : 1 }}>
                      <Wand2 size={16} />
                      <span>{renameBusy ? 'Generating…' : 'Generate with AI'}</span>
                    </button>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                      <button onClick={closeRenameModal} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, background: 'transparent', color: theme.colors.text, cursor: 'pointer' }}>Cancel</button>
                      <button onClick={saveRename} disabled={!renameTitle.trim()} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: renameTitle.trim() ? theme.colors.primary : 'rgba(255,255,255,0.1)', color: renameTitle.trim() ? '#000' : '#999', cursor: renameTitle.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0); border-radius: 4px; transition: background 0.3s ease; }
        div:hover::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.3); }
        scrollbar-color: transparent transparent;
        * { scrollbar-color: transparent transparent; }
        *:hover { scrollbar-color: rgba(255, 255, 255, 0.3) transparent; }
      `}</style>

      {/* Mobile App QR Modal */}
      {
        showMobileModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowMobileModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`,
                borderRadius: 24,
                padding: 32,
                maxWidth: 400,
                width: '90%',
                border: `1px solid ${theme.colors.border}`,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                position: 'relative',
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowMobileModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: theme.colors.text,
                }}
              >
                <X size={18} />
              </button>

              {/* Title */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: theme.colors.text, marginBottom: 8 }}>
                  Download Mobile App
                </h2>
                <p style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                  Scan the QR code to download from Play Store
                </p>
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  background: 'white',
                  borderRadius: 16,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {/* QR Code with App Logo in Center */}
                <div
                  style={{
                    position: 'relative',
                    width: 256,
                    height: 256,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QRCodeSVG
                    value="https://play.google.com/store/apps/details?id=com.vivekgowdas.SwitchAi"
                    size={256}
                    level="H"
                    includeMargin={false}
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                  />
                  {/* App Logo in Center */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 64,
                      height: 64,
                      background: 'white',
                      borderRadius: 12,
                      padding: 4,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <img
                      src="/app.png"
                      alt="SwitchAi"
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 8,
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Play Store Button */}
              <a
                href="https://play.google.com/store/apps/details?id=com.vivekgowdas.SwitchAi"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)';
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.6 3 21.09 3 20.5Z" fill="currentColor" />
                  <path d="M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12Z" fill="currentColor" />
                  <path d="M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81Z" fill="currentColor" />
                  <path d="M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z" fill="currentColor" />
                </svg>
                <span>Get it on Play Store</span>
              </a>
            </div>
          </div>
        )
      }

      {/* Settings Modal */}
      {
        showSettingsModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(3px)',
              animation: 'sa-fade-in 0.2s ease',
            }}
            onClick={() => {
              setShowSettingsModal(false);
              setShowPersonalityModal(false);
              setSelectedSettingsPage('overview');
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                width: isMobile ? '92vw' : '665px',
                height: isMobile ? '80vh' : '595px',
                maxWidth: '95vw',
                background: 'rgba(10, 10, 10, 0.98)',
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                overflow: 'hidden',
                animation: 'sa-pop 0.3s ease',
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              {/* Geometric decorative elements */}
              <div style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: 90,
                border: '1px solid rgba(255, 255, 255, 0.04)',
                top: '-10%',
                right: '-10%',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {/* Close Button - Top Left */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setShowPersonalityModal(false);
                  setSelectedSettingsPage('overview');
                }}
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgb(103, 103, 103)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={16} />
              </button>

              {/* Right Close Button - Top Right (Remove this old one) */}

              {/* Left Sidebar - 28% */}
              <div style={{
                width: isMobile ? '100%' : '28%',
                background: 'rgb(30, 30, 30)',
                borderRight: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                zIndex: 1,
              }}>
                {/* Sidebar Navigation - No Header */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '60px 12px 12px 12px',
                }}>
                  {/* Navigation Items */}
                  {[
                    { id: 'overview', icon: <Settings size={16} />, label: 'Overview' },
                    { id: 'personalization', icon: <Brain size={16} />, label: 'Personalization' },
                    { id: 'data-controls', icon: <Database size={16} />, label: 'Data Controls' },
                    { id: 'tokens', icon: <Rocket size={16} />, label: 'Tokens' },
                    { id: 'dedicated-inference', icon: <Rocket size={16} />, label: 'Dedicated Inference' },
                    { id: 'status', icon: <Server size={16} />, label: 'Server Status' },
                    { id: 'about', icon: <Info size={16} />, label: 'About' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedSettingsPage(item.id)}
                      style={{
                        width: '100%',
                        background: selectedSettingsPage === item.id ? 'rgb(54, 54, 54)' : 'transparent',
                        border: 'none',
                        borderRadius: 10,
                        padding: '10px 12px',
                        marginBottom: 0,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSettingsPage !== item.id) {
                          e.currentTarget.style.background = 'rgb(54, 54, 54)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSettingsPage !== item.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{
                        color: '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{
                          color: '#cbd5e1',
                          fontWeight: 400,
                          fontSize: 13,
                        }}>
                          {item.label}
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* Logout Button */}
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to sign out of your account?')) {
                        try {
                          await auth.signOut();
                          setShowSettingsModal(false);
                          setShowPersonalityModal(false);
                          navigate('/login');
                        } catch (error) {
                          console.error('Sign out error:', error);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(244, 63, 94, 0.1)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginTop: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)';
                    }}
                  >
                    <div style={{
                      color: '#fecdd3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <LogOut size={16} />
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{
                        color: '#fecdd3',
                        fontWeight: 700,
                        fontSize: 13,
                      }}>
                        Logout
                      </div>
                      <div style={{
                        color: 'rgba(254, 205, 211, 0.8)',
                        fontSize: 10,
                        marginTop: 2,
                      }}>
                        End session
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Right Content Area - 72% */}
              {!isMobile && (
                <div style={{
                  width: '72%',
                  background: 'rgb(33, 33, 33)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {/* Content Header */}
                  <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'transparent',
                  }}>
                    <h3 style={{
                      color: '#e5e7eb',
                      fontSize: 18,
                      fontWeight: 400,
                      margin: 0,
                      letterSpacing: '0.3px',
                    }}>
                      {selectedSettingsPage === 'overview' && 'Overview'}
                      {selectedSettingsPage === 'personalization' && 'Personalization'}
                      {selectedSettingsPage === 'models' && 'Model Preferences'}
                      {selectedSettingsPage === 'data-controls' && 'Data Controls'}
                      {selectedSettingsPage === 'tokens' && 'Tokens & Rewards'}
                      {selectedSettingsPage === 'dedicated-inference' && 'Dedicated Inference'}
                      {selectedSettingsPage === 'status' && 'Server Status'}
                      {selectedSettingsPage === 'about' && 'About'}
                    </h3>
                  </div>

                  {/* Content Body */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0',
                  }}
                    onScroll={() => {
                      setShowPersonalityModal(false);
                      setIsSettingsScrolling(true);
                      if (settingsScrollTimeoutRef.current) {
                        clearTimeout(settingsScrollTimeoutRef.current);
                      }
                      settingsScrollTimeoutRef.current = setTimeout(() => {
                        setIsSettingsScrolling(false);
                      }, 1500);
                    }}>
                    {selectedSettingsPage === 'overview' && (
                      <div>
                        <div style={{
                          background: 'transparent',
                          borderRadius: 14,
                          padding: 20,
                          border: 'none',
                          marginBottom: 0,
                          marginLeft: '8px',
                          marginRight: '8px',
                          borderBottom: '1px solid rgb(44, 44, 44)',
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 12,
                          }}>
                            <Mail size={20} color="#cbd5e1" />
                            <div>
                              <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>Email</div>
                              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                                {user?.email || 'Not signed in'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          color: '#94a3b8',
                          fontSize: 13,
                          textAlign: 'center',
                          marginTop: 40,
                          marginLeft: '8px',
                          marginRight: '8px',
                          paddingBottom: '24px',
                          borderBottom: '1px solid rgb(44, 44, 44)',
                        }}>
                          Select a setting from the sidebar to view details
                        </div>
                      </div>
                    )}

                    {selectedSettingsPage !== 'overview' && (
                      <div style={{
                        height: '100%',
                        overflow: 'auto',
                        padding: '20px 0',
                      }}>
                        {/* Personalization Page */}
                        {selectedSettingsPage === 'personalization' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: '8px', paddingRight: '8px' }}>
                            {/* Model Preferences */}
                            <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgb(44, 44, 44)' }}>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Models & Voice</div>
                              <button
                                onClick={() => {
                                  setSelectedSettingsPage('models');
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <Brain size={18} color="#cbd5e1" />
                                <div style={{ flex: 1, textAlign: 'left' }}>
                                  <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>Model Preferences</div>
                                  <div style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>Choose your preferred AI models</div>
                                </div>
                                <ChevronRight size={16} color="#64748b" />
                              </button>
                            </div>

                            {/* Reasoning Effort */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Reasoning Effort</div>
                              <div style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                padding: 14,
                              }}>
                                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
                                  Set the effort level for reasoning models (like o1, QwQ, etc.)
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  {(['low', 'medium', 'high'] as const).map((level) => (
                                    <button
                                      key={level}
                                      onClick={() => setReasoningLevel(level)}
                                      style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: reasoningLevel === level ? 'rgba(59, 130, 246, 0.8)' : 'transparent',
                                        border: `1px solid ${reasoningLevel === level ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.12)'}`,
                                        borderRadius: 8,
                                        color: reasoningLevel === level ? '#ffffff' : '#94a3b8',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                      }}
                                    >
                                      {level.charAt(0).toUpperCase() + level.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Settings Toggles */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Settings</div>
                              <div style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                              }}>
                                {/* Stream Responses */}
                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                }}>
                                  <div>
                                    <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>Stream Responses</div>
                                    <div style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>Enable live token streaming</div>
                                  </div>
                                  <div
                                    onClick={() => setStreamingEnabled(!streamingEnabled)}
                                    style={{
                                      appearance: 'none',
                                      width: 44,
                                      height: 24,
                                      borderRadius: 12,
                                      backgroundColor: streamingEnabled ? '#3b82f6' : '#374151',
                                      border: 'none',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      transition: 'background 0.3s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        backgroundColor: streamingEnabled ? '#ffffff' : '#9ca3af',
                                        transition: 'margin-left 0.3s ease',
                                        marginLeft: streamingEnabled ? '22px' : '0px',
                                      }}
                                    />
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* AI Memory */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>SwitchAI ∞ NeuraAI</div>
                              <div style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                overflow: 'hidden',
                              }}>
                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Database size={18} color="#cbd5e1" />
                                    <div>
                                      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>Enable AI Memory</div>
                                      <div style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>Remember preferences and facts</div>
                                    </div>
                                  </div>
                                  <div
                                    onClick={() => setAiMemoryEnabled(!aiMemoryEnabled)}
                                    style={{
                                      width: 44,
                                      height: 24,
                                      borderRadius: 12,
                                      backgroundColor: aiMemoryEnabled ? '#3b82f6' : '#374151',
                                      border: 'none',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      transition: 'background 0.3s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        backgroundColor: aiMemoryEnabled ? '#ffffff' : '#9ca3af',
                                        transition: 'margin-left 0.3s ease',
                                        marginLeft: aiMemoryEnabled ? '22px' : '0px',
                                      }}
                                    />
                                  </div>
                                </label>

                                <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)', marginLeft: 42 }} />

                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Database size={18} color="#cbd5e1" />
                                    <div>
                                      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>Search Chat History</div>
                                      <div style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>Provide better contextual responses</div>
                                    </div>
                                  </div>
                                  <div
                                    onClick={() => setChatHistorySearchEnabled(!chatHistorySearchEnabled)}
                                    style={{
                                      width: 44,
                                      height: 24,
                                      borderRadius: 12,
                                      backgroundColor: chatHistorySearchEnabled ? '#3b82f6' : '#374151',
                                      border: 'none',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      transition: 'background 0.3s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        backgroundColor: chatHistorySearchEnabled ? '#ffffff' : '#9ca3af',
                                        transition: 'margin-left 0.3s ease',
                                        marginLeft: chatHistorySearchEnabled ? '22px' : '0px',
                                      }}
                                    />
                                  </div>
                                </label>

                                <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)', marginLeft: 42 }} />

                                <label style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '12px 14px',
                                  cursor: 'pointer',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Search size={18} color="#cbd5e1" />
                                    <div>
                                      <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 13 }}>Search Chat History</div>
                                      <div style={{ color: '#888888', fontSize: 11, marginTop: 2 }}>Provide better contextual responses</div>
                                    </div>
                                  </div>
                                  <div
                                    onClick={() => setChatHistorySearchEnabled(!chatHistorySearchEnabled)}
                                    style={{
                                      width: 44,
                                      height: 24,
                                      borderRadius: 12,
                                      backgroundColor: chatHistorySearchEnabled ? '#3b82f6' : '#374151',
                                      border: 'none',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      transition: 'background 0.3s ease',
                                      display: 'flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        backgroundColor: chatHistorySearchEnabled ? '#ffffff' : '#9ca3af',
                                        transition: 'margin-left 0.3s ease',
                                        marginLeft: chatHistorySearchEnabled ? '22px' : '0px',
                                      }}
                                    />
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* AI Personality */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', justifyContent: 'space-between', width: '100%' }} onClick={() => { if (showPersonalityModal) setShowPersonalityModal(false); }}>
                              <div style={{ flex: 1, marginBottom: 0 }}>
                                <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Base style and tone</div>
                                <div style={{ color: '#888888', fontSize: 12 }}>Set the style and tone of how ChatGPT responds to you. This doesn't impact ChatGPT's capabilities.</div>
                              </div>
                              <button
                                ref={personalityButtonRef}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPersonalityModal(!showPersonalityModal);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-start',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: 10,
                                  padding: '12px 16px',
                                  color: '#e5e7eb',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  transition: 'background 0.2s ease, border 0.2s ease',
                                  gap: 0,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgb(66, 66, 66)';
                                  e.currentTarget.style.border = '1px solid rgb(78, 78, 78)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.border = 'none';
                                }}
                                onMouseDown={(e) => {
                                  e.currentTarget.style.outline = 'none';
                                }}
                              >
                                <span style={{ textAlign: 'left' }}>
                                  {['default', 'professional', 'friendly', 'candid', 'quirky', 'efficient', 'nerdy', 'cynical'].find(p => p === personality) ? personality.charAt(0).toUpperCase() + personality.slice(1) : 'Default'}
                                </span>
                                <ChevronDown size={16} style={{ flexShrink: 0, marginLeft: 4 }} />
                              </button>

                              {showPersonalityModal && (
                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, minWidth: '240px', maxWidth: '280px', maxHeight: '300px', overflowY: 'auto', background: 'rgb(53, 53, 53)', border: 'none', borderRadius: '12px', padding: '4px', zIndex: 1000, boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)', scrollbarWidth: 'none' }} onClick={(e) => e.stopPropagation()}>
                                  {[
                                    { value: 'default', label: 'Default', desc: 'Balanced style and tone' },
                                    { value: 'professional', label: 'Professional', desc: 'Polished and precise' },
                                    { value: 'friendly', label: 'Friendly', desc: 'Warm and chatty' },
                                    { value: 'candid', label: 'Candid', desc: 'Direct and encouraging' },
                                    { value: 'quirky', label: 'Quirky', desc: 'Playful and imaginative' },
                                    { value: 'efficient', label: 'Efficient', desc: 'Concise and plain' },
                                    { value: 'nerdy', label: 'Nerdy', desc: 'Exploratory and enthusiastic' },
                                    { value: 'cynical', label: 'Cynical', desc: 'Critical and sarcastic' },
                                  ].map((p) => (
                                    <div
                                      key={p.value}
                                      onClick={() => {
                                        setPersonality(p.value);
                                        localStorage.setItem('aiPersonality', p.value);
                                        setShowPersonalityModal(false);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        marginBottom: '4px',
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '8px',
                                        transition: 'background 0.15s ease',
                                        gap: 8,
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgb(74, 74, 74)'; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: personality === p.value ? 'rgb(164, 205, 251)' : '#e5e7eb' }}>{p.label}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{p.desc}</div>
                                      </div>
                                      {personality === p.value && (
                                        <Check size={16} color="rgb(164, 205, 251)" strokeWidth={3} style={{ flexShrink: 0 }} />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Custom Instructions */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Custom Instructions</div>
                              <textarea
                                value={customInstruction}
                                onChange={(e) => setCustomInstruction(e.target.value)}
                                placeholder="How would you like SwitchAI to respond? (e.g., 'Be concise', 'Explain like I'm a beginner')"
                                style={{
                                  width: '100%',
                                  background: 'rgb(47, 47, 47)',
                                  border: '1px solid rgb(78, 78, 78)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  color: '#e5e7eb',
                                  fontSize: 13,
                                  resize: 'vertical',
                                  minHeight: 80,
                                  fontFamily: 'inherit',
                                  outline: 'none',
                                }}
                              />
                            </div>

                            {/* Your Nickname */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Your Nickname</div>
                              <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="What should I call you?"
                                style={{
                                  width: '100%',
                                  background: 'rgb(47, 47, 47)',
                                  border: '1px solid rgb(78, 78, 78)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  color: '#e5e7eb',
                                  fontSize: 13,
                                  outline: 'none',
                                }}
                              />
                            </div>

                            {/* Your Occupation */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>Your Occupation</div>
                              <input
                                type="text"
                                value={occupation}
                                onChange={(e) => setOccupation(e.target.value)}
                                placeholder="What do you do?"
                                style={{
                                  width: '100%',
                                  background: 'rgb(47, 47, 47)',
                                  border: '1px solid rgb(78, 78, 78)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  color: '#e5e7eb',
                                  fontSize: 13,
                                  outline: 'none',
                                }}
                              />
                            </div>

                            {/* More About You */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 14, fontWeight: 400, marginBottom: 10 }}>More About You</div>
                              <textarea
                                value={moreAboutYou}
                                onChange={(e) => setMoreAboutYou(e.target.value)}
                                placeholder="Anything else I should know? (interests, preferences, etc.)"
                                style={{
                                  width: '100%',
                                  background: 'rgb(47, 47, 47)',
                                  border: '1px solid rgb(78, 78, 78)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  color: '#e5e7eb',
                                  fontSize: 13,
                                  resize: 'vertical',
                                  minHeight: 80,
                                  fontFamily: 'inherit',
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Model Preferences Page */}
                        {selectedSettingsPage === 'models' && (
                          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* Header with Search and Sort */}
                            <div style={{
                              display: 'flex',
                              gap: 10,
                              marginBottom: 20,
                              position: 'sticky',
                              top: 0,
                              zIndex: 10,
                              background: '#0b0f14', // Match modal background
                              paddingBottom: 10,
                              paddingTop: 5
                            }}>
                              <div style={{
                                flex: 1,
                                position: 'relative',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 12px',
                              }}>
                                <Search size={16} color="#64748b" />
                                <input
                                  type="text"
                                  placeholder="Search models..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '10px',
                                    color: '#e5e7eb',
                                    fontSize: 13,
                                    outline: 'none',
                                  }}
                                />
                              </div>

                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => {
                                    const nextSort = modelsSortBy === 'provider' ? 'inference' : modelsSortBy === 'inference' ? 'type' : 'provider';
                                    setModelsSortBy(nextSort);
                                  }}
                                  style={{
                                    height: '100%',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '0 14px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    color: '#e5e7eb',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    minWidth: 110,
                                    justifyContent: 'center',
                                  }}
                                >
                                  {modelsSortBy === 'provider' && <Server size={16} color="#3b82f6" />}
                                  {modelsSortBy === 'inference' && <Zap size={16} color="#3b82f6" />}
                                  {modelsSortBy === 'type' && <Brain size={16} color="#3b82f6" />}
                                  <span style={{ textTransform: 'capitalize' }}>{modelsSortBy}</span>
                                </button>
                              </div>
                            </div>

                            {/* Models List */}
                            <div style={{ flex: 1 }}>
                              {models.length === 0 ? (
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 40,
                                  color: '#94a3b8',
                                  gap: 12
                                }}>
                                  <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}>
                                    <RefreshCw size={20} className={modelsLoading ? "animate-spin" : ""} />
                                  </div>
                                  <div>Loading models...</div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                  {(() => {
                                    // Filter and Group Models
                                    const filtered = models.filter(m =>
                                      m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      (m.provider || '').toLowerCase().includes(searchQuery.toLowerCase())
                                    );

                                    // Grouping Logic
                                    const groups: Record<string, typeof models> = {};
                                    filtered.forEach(m => {
                                      let key = 'Other';
                                      if (modelsSortBy === 'provider') key = m.provider || 'Other';
                                      else if (modelsSortBy === 'inference') key = m.inference ? (m.inference.charAt(0).toUpperCase() + m.inference.slice(1)) : 'Other';
                                      else if (modelsSortBy === 'type') key = m.type.charAt(0).toUpperCase() + m.type.slice(1);

                                      if (!groups[key]) groups[key] = [];
                                      groups[key].push(m);
                                    });

                                    const sortedKeys = Object.keys(groups).sort();

                                    if (filtered.length === 0) {
                                      return (
                                        <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
                                          No models found matching "{searchQuery}"
                                        </div>
                                      );
                                    }

                                    return sortedKeys.map(groupKey => (
                                      <div key={groupKey}>
                                        <div style={{
                                          color: '#94a3b8',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.5px',
                                          marginBottom: 12,
                                          paddingLeft: 4
                                        }}>
                                          {groupKey}
                                        </div>
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                          gap: 12
                                        }}>
                                          {groups[groupKey].map(model => {
                                            const isSelected = selectedModels.includes(model.id);
                                            const isMaxReached = !isSelected && selectedModels.length >= 6;

                                            return (
                                              <div
                                                key={model.id}
                                                onClick={() => {
                                                  if (isMaxReached) {
                                                    alert('You can select up to 6 models.');
                                                    return;
                                                  }
                                                  const next = isSelected
                                                    ? selectedModels.filter(id => id !== model.id)
                                                    : [...selectedModels, model.id];
                                                  setSelectedModels(next);
                                                }}
                                                style={{
                                                  background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                                                  border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                  borderRadius: 12,
                                                  padding: 12,
                                                  cursor: isMaxReached ? 'not-allowed' : 'pointer',
                                                  opacity: isMaxReached ? 0.5 : 1,
                                                  transition: 'all 0.2s ease',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 12
                                                }}
                                              >
                                                {/* Provider Icon/Letter */}
                                                <div style={{
                                                  width: 36,
                                                  height: 36,
                                                  borderRadius: 10,
                                                  background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontSize: 16,
                                                  fontWeight: 700,
                                                  color: isSelected ? '#60a5fa' : '#cbd5e1'
                                                }}>
                                                  {(model.provider || model.id).charAt(0).toUpperCase()}
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                  <div style={{
                                                    color: '#e5e7eb',
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                  }}>
                                                    {model.label}
                                                  </div>
                                                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                    {/* Type Badge */}
                                                    <div style={{
                                                      fontSize: 10,
                                                      padding: '2px 6px',
                                                      borderRadius: 4,
                                                      background: model.type === 'reason' ? 'rgba(168, 85, 247, 0.2)' :
                                                        model.type === 'vision' ? 'rgba(236, 72, 153, 0.2)' :
                                                          'rgba(148, 163, 184, 0.2)',
                                                      color: model.type === 'reason' ? '#d8b4fe' :
                                                        model.type === 'vision' ? '#f9a8d4' :
                                                          '#cbd5e1',
                                                      fontWeight: 600,
                                                      textTransform: 'uppercase'
                                                    }}>
                                                      {model.type === 'reason' ? 'Reasoning' : model.type}
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Checkbox */}
                                                <div style={{
                                                  width: 20,
                                                  height: 20,
                                                  borderRadius: 6,
                                                  border: isSelected ? 'none' : '2px solid rgba(255, 255, 255, 0.2)',
                                                  background: isSelected ? '#3b82f6' : 'transparent',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}>
                                                  {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Data Controls Page */}
                        {selectedSettingsPage === 'data-controls' && (
                          <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                            {/* Privacy Section */}
                            <div style={{ marginBottom: 20, paddingBottom: '24px', borderBottom: '1px solid rgb(44, 44, 44)' }}>
                              <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 400, marginBottom: 12 }}>Privacy</div>
                              <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                padding: 16,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                }}>
                                <div>
                                  <div style={{ color: '#ffffff', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Use data for training</div>
                                  <div style={{ color: '#888888', fontSize: 12 }}>Allow anonymous usage to improve models</div>
                                </div>
                                <div
                                  onClick={() => setUseForTraining(!useForTraining)}
                                  style={{
                                    width: 44,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: useForTraining ? '#3b82f6' : '#374151',
                                    border: 'none',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    transition: 'background 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                    boxSizing: 'border-box',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      backgroundColor: useForTraining ? '#ffffff' : '#9ca3af',
                                      transition: 'margin-left 0.3s ease',
                                      marginLeft: useForTraining ? '22px' : '0px',
                                    }}
                                  />
                                </div>
                              </label>
                            </div>

                            {/* Danger Zone */}
                            <div>
                              <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 400, marginBottom: 12 }}>Danger zone</div>
                              <div style={{
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 10,
                                padding: 12,
                              }}>
                                <button onClick={() => {
                                  if (confirm('Delete all active chats? This cannot be undone.')) {
                                    try {
                                      const raw = localStorage.getItem('switchai_chats');
                                      const chats = raw ? JSON.parse(raw) : [];
                                      const toKeep = chats.filter((c: any) => !!c?.archived);
                                      localStorage.setItem('switchai_chats', JSON.stringify(toKeep));
                                      alert('Active chats cleared.');
                                    } catch (e) { console.error(e); }
                                  }
                                }} style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '12px 14px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: 8,
                                  color: '#ef4444',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  marginBottom: 8,
                                }}>
                                  <Trash2 size={16} />
                                  <div style={{ flex: 1, textAlign: 'left' }}>
                                    <div>Delete Active Chats</div>
                                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, color: '#fca5a5' }}>Archived chats kept</div>
                                  </div>
                                </button>
                                <button onClick={() => {
                                  if (confirm('Delete all archived chats? This cannot be undone.')) {
                                    try {
                                      const raw = localStorage.getItem('switchai_chats');
                                      const chats = raw ? JSON.parse(raw) : [];
                                      const toKeep = chats.filter((c: any) => !c?.archived);
                                      localStorage.setItem('switchai_chats', JSON.stringify(toKeep));
                                      alert('Archived chats cleared.');
                                    } catch (e) { console.error(e); }
                                  }
                                }} style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '12px 14px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: 8,
                                  color: '#ef4444',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}>
                                  <Archive size={16} />
                                  <div style={{ flex: 1, textAlign: 'left' }}>
                                    <div>Delete Archived Chats</div>
                                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 2, color: '#fca5a5' }}>Active chats kept</div>
                                  </div>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Tokens Page */}
                        {selectedSettingsPage === 'tokens' && (
                          <div style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                            {/* Balance Card */}
                            <div style={{
                              background: 'transparent',
                              borderRadius: 14,
                              padding: 20,
                              marginBottom: 16,
                              paddingBottom: '24px',
                              borderBottom: '1px solid rgb(44, 44, 44)',
                              border: 'none',
                              position: 'relative',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '100%',
                                background: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.1) 0%, transparent 50%)',
                                pointerEvents: 'none',
                              }} />
                              <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                  <Coins size={20} color="#10b981" />
                                  <div style={{ color: '#888888', fontSize: 12, fontWeight: 400, textTransform: 'uppercase' }}>Your Balance</div>
                                </div>
                                <div style={{
                                  fontSize: 42,
                                  fontWeight: 800,
                                  color: '#ffffff',
                                  marginBottom: 6,
                                  letterSpacing: '-1.5px',
                                }}>
                                  {formatTokens(tokenData?.balance || 0)}
                                </div>
                                <div style={{ color: '#666666', fontSize: 13 }}>tokens available</div>
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                              <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 10,
                                padding: 14,
                                border: 'none',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <TrendingUp size={16} color="#10b981" />
                                  <div style={{ color: '#888888', fontSize: 11, fontWeight: 400, textTransform: 'uppercase' }}>Earned</div>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                                  {formatTokens(tokenData?.totalEarned || 0)}
                                </div>
                              </div>

                              <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 10,
                                padding: 14,
                                border: 'none',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <TrendingDown size={16} color="#f59e0b" />
                                  <div style={{ color: '#888888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Spent</div>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>
                                  {formatTokens(tokenData?.totalSpent || 0)}
                                </div>
                              </div>

                              <div style={{
                                background: 'rgba(255,255,255,0.04)',
                                borderRadius: 10,
                                padding: 14,
                                border: 'none',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <Sparkles size={16} color="#a78bfa" />
                                  <div style={{ color: '#888888', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Referrals</div>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: '#a78bfa' }}>
                                  {tokenData?.referralCount || 0}
                                </div>
                              </div>
                            </div>

                            {/* Earn More Section */}
                            <div style={{
                              background: 'rgba(255,255,255,0.04)',
                              borderRadius: 10,
                              padding: 16,
                              border: 'none',
                            }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 12 }}>Earn More Tokens</div>
                              <div style={{
                                padding: 14,
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 8,
                                border: 'none',
                              }}>
                                <div style={{ color: '#ffffff', fontWeight: 600, marginBottom: 10, fontSize: 13 }}>How to earn:</div>
                                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, color: '#888888', fontSize: 12 }}>
                                  <li>Share your referral code with friends</li>
                                  <li>They sign up using your code</li>
                                  <li>You both get rewarded!</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Dedicated Inference Page */}
                        {selectedSettingsPage === 'dedicated-inference' && (
                          <div style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 12,
                            padding: '40px 20px',
                            textAlign: 'center',
                            marginLeft: '8px',
                            marginRight: '8px',
                            borderBottom: '1px solid rgb(44, 44, 44)',
                          }}>
                            <div style={{ color: '#888888', fontSize: 14 }}>
                              Dedicated inference settings coming soon.
                            </div>
                          </div>
                        )}

                        {/* Status Page */}
                        {selectedSettingsPage === 'status' && (
                          <div style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 12,
                            padding: '40px 20px',
                            marginLeft: '24px',
                            marginRight: '24px',
                            borderBottom: '1px solid rgb(44, 44, 44)',
                            textAlign: 'center',
                          }}>
                            <div style={{ color: '#888888', fontSize: 14 }}>
                              Server status information coming soon.
                            </div>
                          </div>
                        )}

                        {/* About Page */}
                        {selectedSettingsPage === 'about' && (
                          <div style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 12,
                            padding: 20,
                            marginLeft: '8px',
                            marginRight: '8px',
                            borderBottom: '1px solid rgb(44, 44, 44)',
                          }}>
                            <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 400, marginBottom: 16 }}>About SwitchAi</div>
                            <div style={{ color: '#888888', fontSize: 13, lineHeight: 1.6 }}>
                              <div style={{ marginBottom: 12 }}>
                                <strong style={{ color: '#ffffff' }}>Version:</strong> 1.0.0
                              </div>
                              <div style={{ marginBottom: 12 }}>
                                <strong style={{ color: '#ffffff' }}>Platform:</strong> Web Application
                              </div>
                              <div>
                                <strong style={{ color: '#ffffff' }}>Description:</strong> SwitchAi is a powerful AI chat platform that gives you access to multiple AI models in one place.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}
