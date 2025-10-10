// Chat storage using localStorage with optional Firestore sync

export interface AttachmentData {
  type: 'image' | 'pdf';
  dataUrl?: string; // For images
  name?: string; // For PDFs
  file?: File; // Original file reference
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | any[];
  timestamp: number;
  model?: string;
  usage?: any;
  attachments?: AttachmentData[]; // Visual attachments to display
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  lastMessage?: string;
  archived?: boolean;
  model?: string;
}

const STORAGE_KEY = 'switchai_chats';

// Load all chats from localStorage
export function loadChats(): Chat[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const chats = JSON.parse(data);
    return Array.isArray(chats) ? chats : [];
  } catch (error) {
    console.error('Failed to load chats:', error);
    return [];
  }
}

// Save all chats to localStorage
export function saveChats(chats: Chat[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (error) {
    console.error('Failed to save chats:', error);
  }
}

// Get a specific chat by ID
export function getChat(chatId: string): Chat | null {
  const chats = loadChats();
  return chats.find(c => c.id === chatId) || null;
}

// Create a new chat
export function createChat(title: string = 'New Chat', model?: string): Chat {
  const chat: Chat = {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    messages: [],
    timestamp: Date.now(),
    model,
  };
  
  const chats = loadChats();
  chats.unshift(chat); // Add to beginning
  saveChats(chats);
  
  return chat;
}

// Update a chat
export function updateChat(chatId: string, updates: Partial<Chat>): void {
  const chats = loadChats();
  const index = chats.findIndex(c => c.id === chatId);
  
  if (index !== -1) {
    chats[index] = { ...chats[index], ...updates };
    saveChats(chats);
  }
}

// Delete a chat
export function deleteChat(chatId: string): void {
  const chats = loadChats();
  const filtered = chats.filter(c => c.id !== chatId);
  saveChats(filtered);
}

// Add a message to a chat
export function addMessage(chatId: string, message: Message): void {
  const chats = loadChats();
  const index = chats.findIndex(c => c.id === chatId);
  
  if (index !== -1) {
    chats[index].messages.push(message);
    chats[index].timestamp = Date.now();
    
    // Update last message preview
    if (message.role === 'user') {
      const content = typeof message.content === 'string' 
        ? message.content 
        : message.content.find((p: any) => p.type === 'text')?.text || '';
      chats[index].lastMessage = content.slice(0, 100);
    }
    
    saveChats(chats);
  }
}

// Update messages for a chat
export function updateMessages(chatId: string, messages: Message[]): void {
  const chats = loadChats();
  const index = chats.findIndex(c => c.id === chatId);
  
  if (index !== -1) {
    chats[index].messages = messages;
    chats[index].timestamp = Date.now();
    saveChats(chats);
  }
}

// Archive/unarchive a chat
export function toggleArchive(chatId: string): void {
  const chats = loadChats();
  const index = chats.findIndex(c => c.id === chatId);
  
  if (index !== -1) {
    chats[index].archived = !chats[index].archived;
    saveChats(chats);
  }
}

// Generate chat title from first user message
export function generateChatTitle(message: string): string {
  const cleaned = message.trim().slice(0, 50);
  return cleaned || 'New Chat';
}

// Get chat history sorted by timestamp
export function getChatHistory(): Chat[] {
  const chats = loadChats();
  return chats.sort((a, b) => b.timestamp - a.timestamp);
}
