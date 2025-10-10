import { auth, firestore } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Archive, Check, ChevronDown, ChevronLeft, ChevronRight, Edit3, FileText, Image as ImageIcon, Menu, MoreHorizontal, Paperclip, Plus, Send, Settings, Share2, Square, Trash2, Wand2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarkdownRenderer from '../components/Markdown';
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
import { groqChatCompletion, streamChatCompletion } from '../lib/groqClient';
import type { CatalogEntry } from '../lib/modelCatalog';
import { buildCatalog, getProviderName } from '../lib/modelCatalog';
import { openRouterStreamCompletion } from '../lib/openRouterClient';
import { PDFService } from '../lib/pdfService';
import { theme } from '../theme';

interface AttachedImage {
  dataUrl: string;
  file: File;
}

interface AttachedPDF {
  file: File;
  name: string;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [chatsExpanded, setChatsExpanded] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
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
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const lastUpdateRef = useRef<number>(0);

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

  // Load models from Firestore
  useEffect(() => {
    loadModels();
  }, []);

  // Persist reasoning level
  useEffect(() => {
    try { localStorage.setItem('reasoningLevel', reasoningLevel); } catch {}
  }, [reasoningLevel]);

  // Load chat history on mount
  useEffect(() => {
    refreshChatHistory();
  }, []);

  // Avoid locking html/body overflow here to prevent layout shrink on some browsers

  // Note: avoid locking body overflow to prevent Safari top-stuck glitches.

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const loadModels = async () => {
    try {
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

    const userText = input.trim();
    const localImages = [...attachedImages];
    const localPDFs = [...attachedPDFs];
    const hasImages = localImages.length > 0;
    const hasPDFs = localPDFs.length > 0;

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
        } catch {}
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
      const apiMessagesForApi = [...updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content,
      })), {
        role: 'user' as const,
        content: apiUserContent, // Use API content with OCR text
      }];
      
      const apiMessages = sysMsg ? [sysMsg, ...apiMessagesForApi] : apiMessagesForApi;

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
  const inferencePref = rawPref === 'openrouter' || rawPref === 'cerebras' || rawPref === 'groq' ? rawPref : 'groq';

      if (inferencePref === 'groq') {
        // Stream via Groq (Note: Groq doesn't support reasoning parameter)
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
      try { clearInterval(flushTimer as any); } catch {}
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
    setStreamingText('');
    inputRef.current?.focus();
  };

  const loadChat = (chatId: string) => {
    const chat = getChat(chatId);
    if (chat) {
      setMessages(chat.messages || []);
      setCurrentChatId(chatId);
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

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setSending(false);
      setStreamingText('');
    }
  };

  // Filter chats
  const archivedChats = chatHistory.filter((c) => c.archived);
  const activeChats = chatHistory.filter((c) => !c.archived);

  const selectedModelObj = models.find((m) => m.id === selectedModel) || models[0];
  const selectedEntryForReason = models.find((m) => m.id === selectedModel);
  const isReasoningSelected = !!(selectedEntryForReason?.hasReasoning || selectedEntryForReason?.type === 'reason');
  const isVisionModelSelected = !!(selectedEntryForReason?.supportsVision || selectedEntryForReason?.type === 'vision');
  const [showReasoningMenu, setShowReasoningMenu] = useState(false);
  const setReasoning = (lvl: 'low'|'medium'|'high') => { setReasoningLevel(lvl); setShowReasoningMenu(false); };

  // Sidebar hover/menu state
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [menuOpenChatId, setMenuOpenChatId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeChatMenu = () => setMenuOpenChatId(null);

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

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100dvh',
      minHeight: '100svh',
      maxWidth: '100vw',
      background: `linear-gradient(180deg, ${theme.gradients.background.join(', ')})`,
      color: theme.colors.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      overscrollBehavior: 'none',
    }}>
      {/* Outside clicks handled via document listener */}
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '0',
        minWidth: sidebarOpen ? '280px' : '0',
        background: 'rgba(18,20,25,0.9)',
        borderRight: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        height: '100%',
        minHeight: 0,
        backdropFilter: 'blur(10px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none'
      }}>
        {/* Sidebar Header: Brand + Collapse */}
        <div style={{ padding: '12px', borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/logo.png" alt="SwitchAi" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 6 }} />
            <div style={{ fontWeight: 800, fontSize: 14, color: '#e5e7eb' }}>SwitchAi</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} title="Collapse sidebar" style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`, color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {/* New Chat list item */}
          <div
            onClick={handleNewChat}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = 'rgba(255,255,255,0.06)';
              el.style.border = `1px solid ${theme.colors.border}`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.background = 'transparent';
              el.style.border = '1px solid transparent';
            }}
            style={{
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: '1px solid transparent', color: '#e5e7eb'
            }}
          >
            <Plus size={16} />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>New Chat</span>
            <ChevronRight size={16} />
          </div>
          {activeChats.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div onClick={() => setChatsExpanded(!chatsExpanded)} style={{
                padding: '8px 12px', color: theme.colors.textMuted,
                fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {chatsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Chats ({activeChats.length})</span>
              </div>
              {chatsExpanded && activeChats.map((chat) => (
                <div
                  key={chat.id}
                  onMouseEnter={() => setHoveredChatId(chat.id)}
                  onMouseLeave={() => { if (hoveredChatId === chat.id) setHoveredChatId(null); }}
                  onClick={() => loadChat(chat.id)}
                  style={{
                    position: 'relative',
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '6px',
                    background: currentChatId === chat.id
                      ? 'rgba(255, 255, 255, 0.08)'
                      : (hoveredChatId === chat.id ? 'rgba(255,255,255,0.06)' : 'transparent'),
                    border: currentChatId === chat.id ? `1px solid ${theme.colors.border}` : '1px solid transparent',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.title}
                    </div>
                    {chat.lastMessage && (
                      <div style={{ color: theme.colors.textMuted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {chat.lastMessage}
                      </div>
                    )}
                  </div>
                  {hoveredChatId === chat.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenChatId(chat.id); }}
                      title="More"
                      style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`,
                        color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}

                  {menuOpenChatId === chat.id && (
                    <>
                      <div ref={menuRef} style={{ position: 'absolute', right: 8, top: 40, zIndex: 1001, background: 'rgba(26,28,34,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={(e)=>e.stopPropagation()} onMouseDown={(e)=>e.stopPropagation()}>
                        <div onClick={() => { closeChatMenu(); handleShareChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.06)'; }}
                          onMouseLeave={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='transparent'; }}>
                          <Share2 size={14} /> <span>Share</span>
                        </div>
                        <div onClick={() => { closeChatMenu(); handleRenameChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.06)'; }}
                          onMouseLeave={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='transparent'; }}>
                          <Edit3 size={14} /> <span>Rename</span>
                        </div>
                        <div onClick={() => { closeChatMenu(); handleToggleArchive(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='rgba(255,255,255,0.06)'; }}
                          onMouseLeave={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='transparent'; }}>
                          <Archive size={14} /> <span>{chat.archived ? 'Unarchive' : 'Archive'}</span>
                        </div>
                        <div onClick={() => { closeChatMenu(); handleDeleteChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#fca5a5', cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:8 }}
                          onMouseEnter={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='rgba(239,68,68,0.12)'; }}
                          onMouseLeave={(e)=>{ (e.currentTarget as HTMLDivElement).style.background='transparent'; }}>
                          <Trash2 size={14} /> <span>Delete</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {archivedChats.length > 0 && (
            <div>
              <div onClick={() => setArchiveExpanded(!archiveExpanded)} style={{
                padding: '8px 12px', color: theme.colors.textMuted, fontSize: '12px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {archiveExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Archived ({archivedChats.length})</span>
              </div>
              {archiveExpanded && archivedChats.map((chat) => (
                <div
                  key={chat.id}
                  onMouseEnter={() => setHoveredChatId(chat.id)}
                  onMouseLeave={() => { if (hoveredChatId === chat.id) setHoveredChatId(null); }}
                  onClick={() => loadChat(chat.id)}
                  style={{
                    position: 'relative',
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', marginBottom: '6px', opacity: 0.92,
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: hoveredChatId === chat.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex:1 }}>{chat.title}</div>
                  {hoveredChatId === chat.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenChatId(chat.id); }}
                      title="More"
                      style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`, color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  )}
                  {menuOpenChatId === chat.id && (
                    <>
                      <div ref={menuRef} style={{ position: 'absolute', right: 8, top: 40, zIndex: 1001, background: 'rgba(26,28,34,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} onClick={(e)=>e.stopPropagation()}>
                        <div onClick={() => { closeChatMenu(); handleShareChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap' }}>Share</div>
                        <div onClick={() => { closeChatMenu(); handleRenameChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap' }}>Rename</div>
                        <div onClick={() => { closeChatMenu(); handleToggleArchive(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#e5e7eb', cursor:'pointer', whiteSpace:'nowrap' }}>{chat.archived ? 'Unarchive' : 'Archive'}</div>
                        <div onClick={() => { closeChatMenu(); handleDeleteChat(chat.id); }} style={{ padding: '8px 10px', borderRadius: 8, color:'#fca5a5', cursor:'pointer', whiteSpace:'nowrap' }}>Delete</div>
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
          <div onClick={() => navigate('/settings')} style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `1px solid ${theme.colors.border}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' }}>
              {user?.photoURL && !avatarError ? (
                <img
                  src={user.photoURL}
                  alt={user?.displayName || user?.email || 'User'}
                  onError={() => setAvatarError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                  {(user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.displayName || 'User'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || 'Not signed in'}
              </div>
            </div>
            <Settings size={18} color={theme.colors.textMuted} />
          </div>
        </div>
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
        {/* Header */}
        <div style={{ 
          height: '60px', 
          borderBottom: `1px solid ${theme.colors.border}`, 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 20px', 
          gap: '12px',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)',
          flex: '0 0 auto',
        }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{
              width: '36px', height: '36px', 
              background: 'rgba(255, 255, 255, 0.06)', 
              border: 'none',
              borderRadius: '8px', 
              color: theme.colors.text, 
              fontSize: '18px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}><Menu size={18} /></button>
          )}
          
          {/* Logo and Brand */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px' 
          }}>
            <div style={{
              fontSize: '18px', 
              fontWeight: '700',
              color: theme.colors.text,
            }}>
              SwitchAi
            </div>
          </div>
          
          {/* Chat-level actions moved to sidebar item menus */}
        </div>

        {/* Messages Area */}
        <div ref={messagesContainerRef} onScroll={handleScroll} style={{ 
          flex: '1 1 0%',
          minHeight: 0, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          padding: '20px', 
          paddingBottom: '220px', // make room for floating input
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          overscrollBehavior: 'contain', // isolate scroll here
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.length === 0 && !streamingText ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', 
              alignItems: 'center', justifyContent: 'center', gap: '20px',
            }}>
              {/* Logo */}
              <div style={{
                width: '120px',
                height: '120px',
                background: '#ffffff',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
                marginBottom: '10px',
              }}>
                <img 
                  src="/logo.png" 
                  alt="SwitchAi Logo" 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    objectFit: 'contain',
                  }} 
                />
              </div>
              
              {/* Brand Name */}
              <div style={{
                fontSize: '42px', 
                fontWeight: '800',
                color: theme.colors.text,
              }}>
                SwitchAi
              </div>
              
              {/* Tagline */}
              <div style={{ 
                fontSize: '16px', 
                color: theme.colors.textMuted,
                fontWeight: '500',
              }}>
                AI-Powered Intelligence
              </div>
              
              {/* Prompt */}
              <div style={{ 
                fontSize: '20px', 
                color: '#e5e7eb', 
                marginTop: '20px',
                fontWeight: '600',
              }}>
                What can I help with?
              </div>

              {/* Suggestions */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, justifyContent: 'center' }}>
                {[
                  'Summarize this article',
                  'Draft a professional email',
                  'Explain this code snippet',
                  'Brainstorm app ideas',
                ].map(s => (
                  <button key={s} onClick={() => setInput(prev => (prev ? prev + '\n' : '') + s)}
                    style={{
                      padding: '10px 12px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)', border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text, cursor: 'pointer', fontSize: 13, fontWeight: 600
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  >{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '900px', width: '100%', margin: '0 auto',
                    gap: 10,
                    animation: 'sa-fade-in .18s ease',
                  }}
                >
                  <div style={msg.role === 'user' ? {
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '24px 24px 24px 24px',
                    padding: '0px 16px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                    maxWidth: '80%'
                  } : {
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    maxWidth: '100%',
                    color: theme.colors.text
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
                </div>
              ))}
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
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: 999, background: '#10b981',
                          animation: 'sa-pulse 1.2s infinite ease-in-out', animationDelay: `${delay}s`,
                        }} />
                      ))}
                    </div>
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
              boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
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
          bottom: 0,
          padding: '16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          background: 'transparent',
          pointerEvents: 'none', // allow messages to scroll beneath, inner card will enable interactions
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', pointerEvents: 'auto' }}>
            <div style={{ 
              background: 'rgba(26, 28, 34, 0.85)',
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '18px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
              backdropFilter: 'blur(12px)',
              padding: '10px',
            }}>
              {/* Attachments preview area */}
              {(attachedImages.length > 0 || attachedPDFs.length > 0) && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  padding: '8px', 
                  marginBottom: '8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}>
                  {attachedImages.map((img, index) => (
                    <div key={index} style={{ 
                      position: 'relative',
                      width: '80px',
                      height: '80px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '2px solid rgba(99, 102, 241, 0.3)',
                      background: 'rgba(0, 0, 0, 0.3)',
                    }}>
                      <img 
                        src={img.dataUrl} 
                        alt={`Attachment ${index + 1}`}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                      />
                      <button
                        onClick={() => clearAttachment('image', index)}
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.9)',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          padding: 0,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {attachedPDFs.map((pdf, index) => (
                    <div key={`pdf-${index}`} style={{ 
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '2px solid rgba(59, 130, 246, 0.3)',
                      minWidth: '200px',
                      maxWidth: '280px',
                    }}>
                      <FileText size={24} color="#60a5fa" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: '#f3f4f6',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {pdf.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          PDF Document
                        </div>
                      </div>
                      <button
                        onClick={() => clearAttachment('pdf', index)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(239, 68, 68, 0.9)',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea first (borderless, same as card bg) */}
              <div style={{ borderRadius: '12px', marginBottom: '10px' }}>
                <textarea 
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const ta = e.currentTarget;
                    ta.style.height = 'auto';
                    ta.style.height = Math.min(160, Math.max(52, ta.scrollHeight)) + 'px';
                  }} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask Anything..." disabled={sending}
                  style={{
                    width: '100%', minHeight: '52px', maxHeight: '160px', padding: '12px 14px',
                    background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', fontFamily: 'inherit', resize: 'none', outline: 'none',
                  }}
                />
              </div>

              {/* Controls row: paperclip, model, reasoning, send/stop */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Attachment button with menu */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="file"
                    id="image-picker"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImagePick}
                  />
                  <input
                    type="file"
                    id="pdf-picker"
                    accept=".pdf,application/pdf"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handlePDFPick}
                  />
                  <button 
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    title="Attach files" 
                    style={{
                      width: '40px', 
                      height: '40px', 
                      background: (attachedImages.length > 0 || attachedPDFs.length > 0) ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.06)', 
                      border: (attachedImages.length > 0 || attachedPDFs.length > 0) ? '1px solid rgba(99, 102, 241, 0.5)' : `1px solid ${theme.colors.border}`,
                      borderRadius: '10px', 
                      color: (attachedImages.length > 0 || attachedPDFs.length > 0) ? '#818cf8' : '#fff', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <Paperclip size={18} />
                    {(attachedImages.length > 0 || attachedPDFs.length > 0) && (
                      <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: '#6366f1',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {attachedImages.length + attachedPDFs.length}
                      </div>
                    )}
                  </button>

                  {/* Attachment menu */}
                  {showAttachMenu && (
                    <>
                      <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                        onClick={() => setShowAttachMenu(false)} 
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '48px',
                        left: 0,
                        minWidth: '200px',
                        background: 'rgba(17, 24, 39, 0.98)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                        zIndex: 999,
                      }}>
                        <button
                          onClick={() => {
                            document.getElementById('image-picker')?.click();
                            setShowAttachMenu(false);
                          }}
                          disabled={attachedImages.length >= 5}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: 'transparent',
                            border: 'none',
                            color: attachedImages.length >= 5 ? 'rgba(255, 255, 255, 0.3)' : '#fff',
                            textAlign: 'left',
                            cursor: attachedImages.length >= 5 ? 'not-allowed' : 'pointer',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (attachedImages.length < 5) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <ImageIcon size={18} />
                          <div>
                            <div>Add Images</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                              {attachedImages.length}/5 attached
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            document.getElementById('pdf-picker')?.click();
                            setShowAttachMenu(false);
                          }}
                          disabled={attachedPDFs.length >= 5}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: 'transparent',
                            border: 'none',
                            color: attachedPDFs.length >= 5 ? 'rgba(255, 255, 255, 0.3)' : '#fff',
                            textAlign: 'left',
                            cursor: attachedPDFs.length >= 5 ? 'not-allowed' : 'pointer',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '14px',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (attachedPDFs.length < 5) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <FileText size={18} />
                          <div>
                            <div>Add PDFs</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                              {attachedPDFs.length}/5 attached
                            </div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button onClick={() => setShowModelPicker(!showModelPicker)} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.06)', border: `1px solid ${theme.colors.border}`,
                    borderRadius: '12px', color: '#fff', fontSize: '14px', cursor: 'pointer', maxWidth: '260px',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedModelObj?.label || 'Select Model'}
                    </span>
                    <ChevronDown size={12} />
                  </button>

                  {showModelPicker && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowModelPicker(false)} />
                      <div style={{
                        position: 'absolute', bottom: '48px', left: 0, minWidth: '340px', maxWidth: '400px', maxHeight: '440px', overflowY: 'auto',
                        background: 'rgba(17, 24, 39, 0.98)', backdropFilter: 'blur(12px)',
                        border: `1px solid rgba(255, 255, 255, 0.12)`,
                        borderRadius: '16px', padding: '12px', 
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)', 
                        zIndex: 1000,
                      }}>
                        <div style={{ padding: '12px 8px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '12px' }}>
                          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f3f4f6', marginBottom: '6px', letterSpacing: '-0.02em' }}>Choose Model</div>
                          <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.45)' }}>{models.length} models available</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {models.map((model) => {
                            // Get inference name - default to 'groq' if not specified
                            const inferenceName = model.inference || 'groq';
                            // Capitalize first letter for display
                            const inferenceDisplay = inferenceName.charAt(0).toUpperCase() + inferenceName.slice(1);
                            
                            // Color coding for different inference providers
                            const inferenceColors: Record<string, { bg: string; text: string }> = {
                              groq: { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c' },
                              mistral: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
                              cerebras: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
                              openrouter: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
                            };
                            
                            const inferenceStyle = inferenceColors[inferenceName.toLowerCase()] || inferenceColors.groq;
                            
                            return (
                              <div 
                                key={model.id} 
                                onClick={() => handleModelSelect(model.id)} 
                                style={{
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '12px', 
                                  padding: '14px 12px', 
                                  borderRadius: '12px', 
                                  cursor: 'pointer',
                                  background: selectedModel === model.id 
                                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.08) 100%)' 
                                    : 'rgba(255, 255, 255, 0.02)',
                                  border: selectedModel === model.id 
                                    ? '1.5px solid rgba(59, 130, 246, 0.4)' 
                                    : '1px solid rgba(255, 255, 255, 0.06)',
                                  transition: 'all 0.2s ease',
                                  boxShadow: selectedModel === model.id 
                                    ? '0 4px 12px rgba(59, 130, 246, 0.15)' 
                                    : 'none',
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedModel !== model.id) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedModel !== model.id) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                  }
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ 
                                    fontSize: '14px', 
                                    fontWeight: '600', 
                                    color: '#f3f4f6', 
                                    marginBottom: '8px',
                                    lineHeight: '1.3'
                                  }}>
                                    {model.label}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {/* Inference Badge - Always show */}
                                    <span style={{
                                      fontSize: '11px', 
                                      fontWeight: '600',
                                      padding: '4px 8px', 
                                      borderRadius: '8px',
                                      background: inferenceStyle.bg,
                                      color: inferenceStyle.text,
                                      border: `1px solid ${inferenceStyle.text}33`,
                                      textTransform: 'capitalize',
                                      letterSpacing: '0.02em'
                                    }}>
                                      ⚡ {inferenceDisplay}
                                    </span>
                                    
                                    {/* Type Badge */}
                                    <span style={{
                                      fontSize: '10px', 
                                      fontWeight: '500',
                                      padding: '3px 7px', 
                                      borderRadius: '6px',
                                      border: '1px solid rgba(255, 255, 255, 0.12)',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      color: 'rgba(255, 255, 255, 0.6)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em'
                                    }}>
                                      {model.type}
                                    </span>
                                    
                                    {/* Provider Badge */}
                                    <span style={{ 
                                      fontSize: '10px', 
                                      fontWeight: '500',
                                      padding: '3px 7px', 
                                      borderRadius: '6px', 
                                      background: 'rgba(148, 163, 184, 0.15)', 
                                      color: '#94a3b8',
                                      border: '1px solid rgba(148, 163, 184, 0.2)'
                                    }}>
                                      {model.provider || getProviderName(model.id)}
                                    </span>
                                    
                                    {/* Reasoning Badge */}
                                    {model.hasReasoning && (
                                      <span style={{ 
                                        fontSize: '10px', 
                                        fontWeight: '500',
                                        padding: '3px 7px', 
                                        borderRadius: '6px', 
                                        background: 'rgba(168, 85, 247, 0.15)', 
                                        color: '#a78bfa',
                                        border: '1px solid rgba(168, 85, 247, 0.25)'
                                      }}>
                                        💡 Reasoning
                                      </span>
                                    )}
                                    
                                    {/* Vision Badge */}
                                    {model.supportsVision && (
                                      <span style={{ 
                                        fontSize: '10px', 
                                        fontWeight: '500',
                                        padding: '3px 7px', 
                                        borderRadius: '6px', 
                                        background: 'rgba(34, 197, 94, 0.15)', 
                                        color: '#4ade80',
                                        border: '1px solid rgba(34, 197, 94, 0.25)'
                                      }}>
                                        👁️ Vision
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {selectedModel === model.id && (
                                  <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <Check size={12} color="#fff" strokeWidth={3} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {isReasoningSelected && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowReasoningMenu(v => !v)} title="Reasoning level"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                        background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.colors.border}`,
                        borderRadius: '999px', color: theme.colors.text, fontSize: 12, cursor: 'pointer'
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.colors.primary, display: 'inline-block' }} />
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{reasoningLevel}</span>
                      <ChevronDown size={14} />
                    </button>
                    {showReasoningMenu && (
                      <div style={{ position: 'absolute', bottom: '44px', left: 0, background: 'rgba(26,28,34,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 10, padding: 6, minWidth: 160, zIndex: 1000 }}>
                        {(['low','medium','high'] as const).map(lvl => (
                          <div key={lvl} onClick={() => setReasoning(lvl)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: reasoningLevel===lvl? 'rgba(255,255,255,0.06)':'transparent' }}>
                            <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                            {reasoningLevel===lvl && <Check size={14} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  {sending ? (
                    <button onClick={handleStopGeneration} style={{
                      width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      border: 'none', borderRadius: '12px', color: '#fff', fontSize: '16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700',
                    }}><Square size={18} /></button>
                  ) : (
                    <button onClick={handleSend} disabled={!input.trim()} style={{
                      width: '44px', height: '44px',
                      background: input.trim() ? theme.colors.primary : 'rgba(255, 255, 255, 0.12)',
                      border: 'none', borderRadius: '12px', color: '#000', fontSize: '22px',
                      cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: input.trim() ? 1 : 0.5,
                    }}><Send size={18} /></button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Chat Modal */}
      {renameOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
          <div onClick={closeRenameModal} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(520px, 92vw)' }}>
            <div style={{ background: 'rgba(20,22,28,0.98)', border: `1px solid ${theme.colors.border}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800, color: '#e5e7eb' }}>Rename Chat</div>
                <button onClick={closeRenameModal} title="Close" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 12, color: theme.colors.textMuted, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase' }}>Title</label>
                <input
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (renameTitle || '').trim()) saveRename(); }}
                  placeholder="Enter a chat title"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.04)', color: '#e5e7eb', outline: 'none' }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                  <button onClick={generateTitleWithAI} disabled={renameBusy} title="Generate with AI" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, background: 'rgba(255,255,255,0.06)', color: '#e5e7eb', cursor: renameBusy ? 'not-allowed' : 'pointer', opacity: renameBusy ? 0.6 : 1 }}>
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
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
}
