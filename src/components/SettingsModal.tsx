import React, { useRef, useState, useEffect } from 'react';
import { Activity, AlertCircle, Archive, Brain, Check, CheckCircle, ChevronDown, ChevronRight, Clipboard, Cpu, Crown, Database, ExternalLink, Eye, EyeOff, FileText, Info, Key, LogOut, RefreshCw, Rocket, Router, Save, Search, Server, ServerOff, Settings, Trash2, X, Zap } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { User, Auth } from 'firebase/auth';
import toast from 'react-hot-toast';
import Lottie from 'lottie-react';

interface ServerStatus {
    uptime: {
        formatted: string;
        days: number;
    };
    requests: {
        total: number;
        successful: number;
        failed: number;
        successRate: string;
    };
    performance: {
        avgResponseTime: number;
        fastestRequest: number;
        slowestRequest: number;
    };
    today: {
        date: string;
        requests: number;
        errors: number;
        successful: number;
        errorRate: string;
        avgProcessingTime: number;
    };
    // AI Server Specifics
    imageBridging?: {
        total: number;
        successful: number;
        failed: number;
        today?: { total: number; successful: number; failed: number };
    };
    smartSearch?: {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        perModel: Array<{
            modelId: string;
            calls: number;
            tokensIn: number;
            tokensOut: number;
            avgTime: number
        }>;
    };
    modelErrors?: Array<{
        modelId: string;
        totalErrors: number;
        recentErrors: Array<{ error: string; timestamp: number }>;
    }>;
    modelUsage?: {
        total: Array<{
            modelId: string;
            provider: string;
            total: number;
            success: number;
            failed: number;
            successRate: string;
            avgTime: number;
            tokensUsed: number;
        }>;
        today: Array<{
            modelId: string;
            requests: number;
            errors: number;
            tokens: number;
            avgTime: number;
        }>;
    };
    // OCR Server Specifics
    fileTypes?: Record<string, number>;
    ocr?: {
        totalPagesProcessed: number;
        avgPagesPerPDF: number;
    };
    mistralOcr?: {
        totalCalls: number;
        totalPagesProcessed: number;
        fileTypes: Record<string, number>;
    };
    tesseractOcr?: {
        totalCalls: number;
        totalPagesProcessed: number;
        fileTypes: Record<string, number>;
    };
    directParsing?: {
        totalCalls: number;
        fileTypes: Record<string, number>;
    };
    filesGenerated?: {
        total: number;
        byType: Record<string, number>;
    };
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isMobile: boolean;
    user: any;
    initials: string;
    avatarBgColor: string | null;
    plan: 'free' | 'lite' | 'pro';
    selectedSettingsPage: string;
    setSelectedSettingsPage: (page: string) => void;
    streamingEnabled: boolean;
    setStreamingEnabled: (enabled: boolean) => void;
    aiMemoryEnabled: boolean;
    setAiMemoryEnabled: (enabled: boolean) => void;
    chatHistorySearchEnabled: boolean;
    setChatHistorySearchEnabled: (enabled: boolean) => void;
    personality: string;
    setPersonality: (personality: string) => void;
    customInstruction: string;
    setCustomInstruction: (instruction: string) => void;
    reasoningLevel: 'low' | 'medium' | 'high';
    setReasoningLevel: (level: 'low' | 'medium' | 'high') => void;
    nickname: string;
    setNickname: (nickname: string) => void;
    occupation: string;
    setOccupation: (occupation: string) => void;
    moreAboutYou: string;
    setMoreAboutYou: (more: string) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    models: any[];
    modelsLoading: boolean;
    modelsSortBy: 'provider' | 'inference' | 'type';
    setModelsSortBy: (sort: 'provider' | 'inference' | 'type') => void;
    selectedModels: string[];
    setSelectedModels: (models: string[]) => void;
    useForTraining: boolean;
    setUseForTraining: (use: boolean) => void;
    auth: Auth;
    appAnimation: any;
}

export default function SettingsModal({
    isOpen,
    onClose,
    isMobile,
    user,
    initials,
    avatarBgColor,
    plan,
    selectedSettingsPage,
    setSelectedSettingsPage,
    streamingEnabled,
    setStreamingEnabled,
    aiMemoryEnabled,
    setAiMemoryEnabled,
    chatHistorySearchEnabled,
    setChatHistorySearchEnabled,
    personality,
    setPersonality,
    customInstruction,
    setCustomInstruction,
    reasoningLevel,
    setReasoningLevel,
    nickname,
    setNickname,
    occupation,
    setOccupation,
    moreAboutYou,
    setMoreAboutYou,
    searchQuery,
    setSearchQuery,
    models,
    modelsLoading,
    modelsSortBy,
    setModelsSortBy,
    selectedModels,
    setSelectedModels,
    useForTraining,
    setUseForTraining,
    auth,
    appAnimation
}: SettingsModalProps) {
    const navigate = useNavigate();
    const [showPersonalityModal, setShowPersonalityModal] = useState(false);
    const [isSettingsScrolling, setIsSettingsScrolling] = useState(false);
    const settingsScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const personalityButtonRef = useRef<HTMLButtonElement>(null);

    // Status Page State
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [ocrServerStatus, setOcrServerStatus] = useState<ServerStatus | null>(null);
    const [activeStatusTab, setActiveStatusTab] = useState<'ai' | 'ocr'>('ai');

    // Inference Page State
    const [inferenceLoading, setInferenceLoading] = useState(true);
    const [inferenceSaving, setInferenceSaving] = useState(false);
    const [activeInferenceTab, setActiveInferenceTab] = useState<'groq' | 'cerebras' | 'openrouter'>('groq');

    // Groq State
    const [groqKey, setGroqKey] = useState('');
    const [groqHasKey, setGroqHasKey] = useState(false);
    const [groqEnabled, setGroqEnabled] = useState(false);
    const [showGroqKey, setShowGroqKey] = useState(false);
    const groqKeyValid = /^gsk_[A-Za-z0-9]/.test(groqKey.trim());

    // Cerebras State
    const [cerebrasKey, setCerebrasKey] = useState('');
    const [cerebrasHasKey, setCerebrasHasKey] = useState(false);
    const [cerebrasEnabled, setCerebrasEnabled] = useState(false);
    const [showCerebrasKey, setShowCerebrasKey] = useState(false);
    const cerebrasKeyValid = /^csk-[A-Za-z0-9_-]{8,}$/.test(cerebrasKey.trim());

    // OpenRouter State
    const [openRouterKey, setOpenRouterKey] = useState('');
    const [openRouterHasKey, setOpenRouterHasKey] = useState(false);
    const [openRouterEnabled, setOpenRouterEnabled] = useState(false);
    const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
    const openRouterKeyValid = /^(sk|or)-[A-Za-z0-9]/.test(openRouterKey.trim());

    useEffect(() => {
        if (selectedSettingsPage === 'inference' && user?.uid) {
            loadInferenceSettings();
        }
    }, [selectedSettingsPage, user]);

    const loadInferenceSettings = async () => {
        setInferenceLoading(true);
        try {
            if (!user?.uid) return;

            // Load Groq
            const groqRef = doc(db, 'users', user.uid, 'api', 'groq');
            getDoc(groqRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setGroqKey(data.key || '');
                    setGroqHasKey(!!data.key);
                    setGroqEnabled(!!data.enabled);
                }
            });

            // Load Cerebras
            const cerebrasRef = doc(db, 'users', user.uid, 'api', 'cerebras');
            getDoc(cerebrasRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setCerebrasKey(data.key || '');
                    setCerebrasHasKey(!!data.key);
                    setCerebrasEnabled(!!data.enabled);
                }
            });

            // Load OpenRouter
            const orRef = doc(db, 'users', user.uid, 'api', 'openrouter');
            getDoc(orRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setOpenRouterKey(data.key || '');
                    setOpenRouterHasKey(!!data.key);
                    setOpenRouterEnabled(!!data.enabled);
                }
            });

        } catch (error) {
            console.error('Error loading inference settings:', error);
            toast.error('Failed to load inference settings');
        } finally {
            setInferenceLoading(false);
        }
    };

    const handleSaveKey = async (provider: 'groq' | 'cerebras' | 'openrouter') => {
        if (!user?.uid) return;

        let key = '';
        let valid = false;

        if (provider === 'groq') {
            key = groqKey.trim();
            valid = groqKeyValid;
        } else if (provider === 'cerebras') {
            key = cerebrasKey.trim();
            valid = cerebrasKeyValid;
        } else if (provider === 'openrouter') {
            key = openRouterKey.trim();
            valid = openRouterKeyValid;
        }

        if (!key) {
            toast.error('Please enter a valid API key');
            return;
        }

        setInferenceSaving(true);
        try {
            await setDoc(doc(db, 'users', user.uid, 'api', provider), {
                key,
                enabled: true
            }, { merge: true });

            if (provider === 'groq') {
                setGroqHasKey(true);
                setGroqEnabled(true);
            } else if (provider === 'cerebras') {
                setCerebrasHasKey(true);
                setCerebrasEnabled(true);
            } else if (provider === 'openrouter') {
                setOpenRouterHasKey(true);
                setOpenRouterEnabled(true);
            }

            toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} key saved`);
        } catch (error) {
            console.error('Error saving key:', error);
            toast.error('Failed to save key');
        } finally {
            setInferenceSaving(false);
        }
    };

    const handleToggleProvider = async (provider: 'groq' | 'cerebras' | 'openrouter', enabled: boolean) => {
        if (!user?.uid) return;

        // Validation check before enabling
        if (enabled) {
            if (provider === 'groq' && !groqKey) {
                toast.error('Please add your Groq API key first');
                return;
            }
            if (provider === 'cerebras' && !cerebrasKey) {
                toast.error('Please add your Cerebras API key first');
                return;
            }
            if (provider === 'openrouter' && !openRouterKey) {
                toast.error('Please add your OpenRouter API key first');
                return;
            }
        }

        try {
            // Optimistic update
            if (provider === 'groq') setGroqEnabled(enabled);
            if (provider === 'cerebras') setCerebrasEnabled(enabled);
            if (provider === 'openrouter') setOpenRouterEnabled(enabled);

            await setDoc(doc(db, 'users', user.uid, 'api', provider), {
                enabled
            }, { merge: true });

        } catch (error) {
            // Revert on error
            if (provider === 'groq') setGroqEnabled(!enabled);
            if (provider === 'cerebras') setCerebrasEnabled(!enabled);
            if (provider === 'openrouter') setOpenRouterEnabled(!enabled);

            console.error('Error toggling provider:', error);
            toast.error('Failed to update status');
        }
    };


    useEffect(() => {
        if (selectedSettingsPage === 'status') {
            fetchServerStatus();
        }
    }, [selectedSettingsPage]);

    const fetchServerStatus = async () => {
        setStatusLoading(true);
        setStatusError(null);
        try {
            const mainResponse = await fetch('https://ai.collegebuzz.in/api/status');
            if (mainResponse.ok) {
                const mainData = await mainResponse.json();
                setServerStatus(mainData);
            } else {
                setServerStatus(null);
            }

            const ocrResponse = await fetch('https://ocr.collegebuzz.in/api/status');
            if (ocrResponse.ok) {
                const ocrData = await ocrResponse.json();
                setOcrServerStatus(ocrData);
            } else {
                setOcrServerStatus(null);
            }
        } catch (err) {
            setStatusError('Failed to connect to servers');
        } finally {
            setStatusLoading(false);
        }
    };

    const getHealthStatus = (errorRate: string) => {
        const rate = parseFloat(errorRate);
        if (isNaN(rate)) return { status: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.02)' };
        if (rate < 5) return { status: 'Operational', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
        if (rate < 30) return { status: 'Degraded', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
        if (rate < 80) return { status: 'Critical', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.1)' };
        return { status: 'Outage', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    };

    const formatNumberSafe = (value: number | undefined | null) => {
        if (value === null || value === undefined) return '-';
        try {
            return value.toLocaleString();
        } catch (_e) {
            return '-';
        }
    };

    const aiHealth = serverStatus ? getHealthStatus(serverStatus?.today?.errorRate ?? '') : { status: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.02)' };
    const ocrHealth = ocrServerStatus ? getHealthStatus(ocrServerStatus?.today?.errorRate ?? '') : { status: 'Unknown', color: '#94a3b8', bg: 'rgba(255,255,255,0.02)' };


    if (!isOpen) return null;

    return (
        <div className="settings-modal-wrapper"
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
                onClose();
                setShowPersonalityModal(false);
                setSelectedSettingsPage('overview');
            }}
        >
            <style>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
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
                        onClose();
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
                    <div className="no-scrollbar" style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '60px 12px 12px 12px',
                    }}>
                        {/* Navigation Items */}
                        {[
                            { id: 'overview', icon: <Settings size={16} />, label: 'Account' },
                            { id: 'personalization', icon: <Brain size={16} />, label: 'Personalization' },
                            { id: 'data-controls', icon: <Database size={16} />, label: 'Data Controls' },
                            { id: 'inference', icon: <Rocket size={16} />, label: 'Inference' },
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
                                {selectedSettingsPage === 'overview' && 'Account'}
                                {selectedSettingsPage === 'personalization' && 'Personalization'}
                                {selectedSettingsPage === 'models' && 'Model Preferences'}
                                {selectedSettingsPage === 'data-controls' && 'Data Controls'}
                                {selectedSettingsPage === 'inference' && 'Inference'}
                                {selectedSettingsPage === 'status' && 'Server Status'}
                                {selectedSettingsPage === 'about' && 'About'}
                            </h3>
                        </div>

                        {/* Content Body */}
                        <div className="no-scrollbar" style={{
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
                                    <div>
                                        {/* Profile Card */}
                                        <div style={{
                                            background: 'transparent',
                                            borderRadius: 16,
                                            padding: 24,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 12,
                                            marginBottom: 16,
                                            marginLeft: '8px',
                                            marginRight: '8px',
                                            border: 'none',
                                        }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: 40,
                                                    background: avatarBgColor || '#1f2937',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                                                }}>
                                                    <span style={{ color: '#ffffff', fontWeight: 500, fontSize: 32 }}>
                                                        {initials}
                                                    </span>
                                                </div>
                                                {/* Plan Badge */}
                                                {plan !== 'free' && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: -2,
                                                        right: -2,
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: 13,
                                                        background: '#ffffff',
                                                        border: '2px solid #0b0f14',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10
                                                    }}>
                                                        {plan === 'pro' && <Crown size={18} color="#3b82f6" fill="#3b82f6" />}
                                                        {plan === 'lite' && <Zap size={18} color="#FFA500" fill="#FFA500" />}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                <h2 style={{
                                                    color: '#ffffff',
                                                    fontWeight: 700,
                                                    fontSize: 20,
                                                    letterSpacing: '0.3px',
                                                    margin: 0,
                                                    textAlign: 'center',
                                                }}>
                                                    {(user?.displayName || 'User')}
                                                </h2>
                                                <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>{user?.email || 'Not signed in'}</div>
                                            </div>

                                            <div style={{
                                                marginTop: 12,
                                                padding: '6px 14px',
                                                borderRadius: 100,
                                                background: plan === 'pro'
                                                    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)'
                                                    : plan === 'lite'
                                                        ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)'
                                                        : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${plan === 'pro'
                                                    ? 'rgba(16, 185, 129, 0.3)'
                                                    : plan === 'lite'
                                                        ? 'rgba(59, 130, 246, 0.3)'
                                                        : 'rgba(255, 255, 255, 0.1)'}`,
                                                color: plan === 'pro' ? '#34d399' : plan === 'lite' ? '#60a5fa' : '#9ca3af',
                                                fontSize: 12,
                                                fontWeight: 600,
                                                letterSpacing: '0.3px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                boxShadow: plan === 'pro' || plan === 'lite' ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
                                            }}>
                                                {plan === 'pro' && <Crown size={12} strokeWidth={2.5} />}
                                                {plan === 'lite' && <Zap size={12} strokeWidth={2.5} />}
                                                <span>
                                                    {plan === 'pro' ? 'Pro Plan' : plan === 'lite' ? 'Lite Plan' : 'Free Plan'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Logout Button in Account Page */}
                                        <div style={{ padding: '0 8px' }}>
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Are you sure you want to sign out of your account?')) {
                                                        try {
                                                            await auth.signOut();
                                                            onClose();
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
                                                    borderRadius: 16,
                                                    padding: '16px',
                                                    marginTop: 12,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 16,
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
                                                    background: 'rgba(244, 63, 94, 0.2)',
                                                    padding: 10,
                                                    borderRadius: 10
                                                }}>
                                                    <LogOut size={20} />
                                                </div>
                                                <div style={{ flex: 1, textAlign: 'left' }}>
                                                    <div style={{
                                                        color: '#fecdd3',
                                                        fontWeight: 700,
                                                        fontSize: 15,
                                                    }}>
                                                        Sign Out
                                                    </div>
                                                    <div style={{
                                                        color: 'rgba(254, 205, 211, 0.8)',
                                                        fontSize: 12,
                                                        marginTop: 2,
                                                    }}>
                                                        Log out of your account
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>


                                </div>
                            )}

                            {selectedSettingsPage !== 'overview' && (
                                <div className="no-scrollbar" style={{
                                    height: '100%',
                                    overflow: 'auto',
                                    padding: '20px 12px',
                                }}>
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
                                                    <div style={{ color: '#888888', fontSize: 12 }}>Set the style and tone of how SwitchAi responds to you. This doesn't impact SwitchAi's capabilities.</div>
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
                                                    <div className="no-scrollbar" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, minWidth: '240px', maxWidth: '280px', maxHeight: '300px', overflowY: 'auto', background: 'rgb(53, 53, 53)', border: 'none', borderRadius: '12px', padding: '4px', zIndex: 1000, boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8)', scrollbarWidth: 'none' }} onClick={(e) => e.stopPropagation()}>
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

                                    {selectedSettingsPage === 'models' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                            {/* Header with Search and Sort */}
                                            <div style={{
                                                display: 'flex',
                                                gap: 10,
                                                marginBottom: 20,
                                                background: 'rgb(33, 33, 33)', // Match modal background
                                                paddingBottom: 10,
                                                paddingTop: 5
                                            }}>
                                                <button
                                                    onClick={() => setSelectedSettingsPage('personalization')}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: 10,
                                                        width: 40,
                                                        height: 40,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        color: '#e5e7eb',
                                                        transition: 'all 0.2s ease',
                                                        flexShrink: 0
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
                                                </button>
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
                                                                                            toast.error('You can select up to 6 models.');
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
                                                                toast.success('Active chats cleared.');
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
                                                                toast.success('Archived chats cleared.');
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

                                    {selectedSettingsPage === 'inference' && (
                                        <div style={{ padding: '0px 24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>

                                            {/* Tab Navigation */}
                                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                                <button
                                                    onClick={() => setActiveInferenceTab('groq')}
                                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: activeInferenceTab === 'groq' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                >
                                                    <Zap size={16} color={activeInferenceTab === 'groq' ? '#f97316' : 'rgba(255,255,255,0.4)'} />
                                                    <span style={{ color: activeInferenceTab === 'groq' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>Groq</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveInferenceTab('cerebras')}
                                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: activeInferenceTab === 'cerebras' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                >
                                                    <Cpu size={16} color={activeInferenceTab === 'cerebras' ? '#8b5cf6' : 'rgba(255,255,255,0.4)'} />
                                                    <span style={{ color: activeInferenceTab === 'cerebras' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>Cerebras</span>
                                                </button>
                                                <button
                                                    onClick={() => setActiveInferenceTab('openrouter')}
                                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: activeInferenceTab === 'openrouter' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                >
                                                    <Router size={16} color={activeInferenceTab === 'openrouter' ? '#10b981' : 'rgba(255,255,255,0.4)'} />
                                                    <span style={{ color: activeInferenceTab === 'openrouter' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>OpenRouter</span>
                                                </button>
                                            </div>

                                            {/* Content Area */}
                                            {inferenceLoading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 16 }}>
                                                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid rgba(255, 255, 255, 0.2)', borderTopColor: '#ffffff', borderRadius: '50%' }} />
                                                    <div style={{ color: '#cbd5e1', fontSize: 14 }}>Loading settings...</div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                    {/* Provider Card */}
                                                    <div style={{
                                                        background: 'rgba(255, 255, 255, 0.05)',
                                                        borderRadius: 16,
                                                        padding: 24,
                                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 24
                                                    }}>

                                                        {/* Header */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                                <div style={{
                                                                    width: 48, height: 48, borderRadius: 12,
                                                                    background: activeInferenceTab === 'groq' ? 'rgba(249, 115, 22, 0.1)' : activeInferenceTab === 'cerebras' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    {activeInferenceTab === 'groq' && <Zap size={24} color="#f97316" />}
                                                                    {activeInferenceTab === 'cerebras' && <Cpu size={24} color="#8b5cf6" />}
                                                                    {activeInferenceTab === 'openrouter' && <Router size={24} color="#10b981" />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700 }}>
                                                                        {activeInferenceTab === 'groq' ? 'Groq' : activeInferenceTab === 'cerebras' ? 'Cerebras' : 'OpenRouter'}
                                                                    </div>
                                                                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>
                                                                        {activeInferenceTab === 'groq' ? 'Fast inference engine' : activeInferenceTab === 'cerebras' ? 'Advanced AI inference' : 'Multi-model API access'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div style={{
                                                                padding: '6px 12px', borderRadius: 100,
                                                                background: (activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled) ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                                                color: (activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled) ? '#22c55e' : '#94a3b8',
                                                                fontSize: 12, fontWeight: 700
                                                            }}>
                                                                {(activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled) ? 'Active' : 'Inactive'}
                                                            </div>
                                                        </div>

                                                        {/* Toggle */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600 }}>Enable {activeInferenceTab === 'groq' ? 'Groq' : activeInferenceTab === 'cerebras' ? 'Cerebras' : 'OpenRouter'}</div>
                                                                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Use this API key for inference</div>
                                                            </div>
                                                            <div
                                                                onClick={() => handleToggleProvider(activeInferenceTab, !(activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled))}
                                                                style={{
                                                                    width: 44, height: 24, borderRadius: 12,
                                                                    backgroundColor: (activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled) ? '#3b82f6' : '#374151',
                                                                    cursor: 'pointer', position: 'relative', transition: 'background 0.3s ease'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: 20, height: 20, borderRadius: '50%',
                                                                    backgroundColor: '#fff',
                                                                    position: 'absolute', top: 2, left: (activeInferenceTab === 'groq' ? groqEnabled : activeInferenceTab === 'cerebras' ? cerebrasEnabled : openRouterEnabled) ? 22 : 2,
                                                                    transition: 'left 0.3s ease'
                                                                }} />
                                                            </div>
                                                        </div>

                                                        {/* API Key Input */}
                                                        <div>
                                                            <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                                                                {activeInferenceTab === 'groq' ? 'Groq' : activeInferenceTab === 'cerebras' ? 'Cerebras' : 'OpenRouter'} API Key
                                                            </div>
                                                            <div style={{ position: 'relative' }}>
                                                                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                                                    <Key size={16} color="#94a3b8" />
                                                                </div>
                                                                <input
                                                                    type={activeInferenceTab === 'groq' ? (showGroqKey ? 'text' : 'password') : activeInferenceTab === 'cerebras' ? (showCerebrasKey ? 'text' : 'password') : (showOpenRouterKey ? 'text' : 'password')}
                                                                    value={activeInferenceTab === 'groq' ? groqKey : activeInferenceTab === 'cerebras' ? cerebrasKey : openRouterKey}
                                                                    onChange={(e) => {
                                                                        if (activeInferenceTab === 'groq') setGroqKey(e.target.value);
                                                                        if (activeInferenceTab === 'cerebras') setCerebrasKey(e.target.value);
                                                                        if (activeInferenceTab === 'openrouter') setOpenRouterKey(e.target.value);
                                                                    }}
                                                                    placeholder={activeInferenceTab === 'groq' ? 'gsk_...' : activeInferenceTab === 'cerebras' ? 'csk_...' : 'sk-or-...'}
                                                                    style={{
                                                                        width: '100%',
                                                                        background: 'rgba(0, 0, 0, 0.3)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                        borderRadius: 12,
                                                                        padding: '12px 40px',
                                                                        color: '#e5e7eb',
                                                                        fontSize: 14,
                                                                        outline: 'none',
                                                                        fontFamily: 'monospace'
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        if (activeInferenceTab === 'groq') setShowGroqKey(!showGroqKey);
                                                                        if (activeInferenceTab === 'cerebras') setShowCerebrasKey(!showCerebrasKey);
                                                                        if (activeInferenceTab === 'openrouter') setShowOpenRouterKey(!showOpenRouterKey);
                                                                    }}
                                                                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                                                                >
                                                                    {(activeInferenceTab === 'groq' ? showGroqKey : activeInferenceTab === 'cerebras' ? showCerebrasKey : showOpenRouterKey) ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                                                                </button>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                                                {(activeInferenceTab === 'groq' ? groqKeyValid : activeInferenceTab === 'cerebras' ? cerebrasKeyValid : openRouterKeyValid) ? (
                                                                    <CheckCircle size={14} color="#34d399" />
                                                                ) : (
                                                                    <AlertCircle size={14} color="#f59e0b" />
                                                                )}
                                                                <span style={{ color: (activeInferenceTab === 'groq' ? groqKeyValid : activeInferenceTab === 'cerebras' ? cerebrasKeyValid : openRouterKeyValid) ? '#34d399' : '#f59e0b', fontSize: 12 }}>
                                                                    {(activeInferenceTab === 'groq' ? groqKey : activeInferenceTab === 'cerebras' ? cerebrasKey : openRouterKey).trim() === '' ? 'Paste your API key to get started' : (activeInferenceTab === 'groq' ? groqKeyValid : activeInferenceTab === 'cerebras' ? cerebrasKeyValid : openRouterKeyValid) ? 'Key format looks valid' : 'Key format may be invalid'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div style={{ display: 'flex', gap: 12 }}>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const text = await navigator.clipboard.readText();
                                                                        if (text) {
                                                                            if (activeInferenceTab === 'groq') setGroqKey(text);
                                                                            if (activeInferenceTab === 'cerebras') setCerebrasKey(text);
                                                                            if (activeInferenceTab === 'openrouter') setOpenRouterKey(text);
                                                                        }
                                                                        toast.success('Pasted from clipboard');
                                                                    } catch {
                                                                        toast.error('Failed to read clipboard');
                                                                    }
                                                                }}
                                                                style={{
                                                                    flex: 1, padding: '10px',
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                    borderRadius: 10,
                                                                    color: '#e5e7eb',
                                                                    fontSize: 13, fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                                                }}
                                                            >
                                                                <Clipboard size={16} /> Paste
                                                            </button>
                                                            <button
                                                                onClick={() => handleSaveKey(activeInferenceTab)}
                                                                disabled={inferenceSaving || !(activeInferenceTab === 'groq' ? groqKey : activeInferenceTab === 'cerebras' ? cerebrasKey : openRouterKey).trim()}
                                                                style={{
                                                                    flex: 1, padding: '10px',
                                                                    background: '#3b82f6',
                                                                    border: 'none',
                                                                    borderRadius: 10,
                                                                    color: '#ffffff',
                                                                    fontSize: 13, fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                                    opacity: (inferenceSaving || !(activeInferenceTab === 'groq' ? groqKey : activeInferenceTab === 'cerebras' ? cerebrasKey : openRouterKey).trim()) ? 0.7 : 1
                                                                }}
                                                            >
                                                                {inferenceSaving ? <div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /> : <Save size={16} />}
                                                                Save
                                                            </button>
                                                        </div>

                                                        {/* Helper Link */}
                                                        <a
                                                            href={activeInferenceTab === 'groq' ? "https://console.groq.com/keys" : activeInferenceTab === 'cerebras' ? "https://inference.cerebras.net" : "https://openrouter.ai/keys"}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6,
                                                                color: '#60a5fa', fontSize: 13, textDecoration: 'none',
                                                                width: 'fit-content'
                                                            }}
                                                        >
                                                            <ExternalLink size={14} />
                                                            Get {activeInferenceTab === 'groq' ? 'Groq' : activeInferenceTab === 'cerebras' ? 'Cerebras' : 'OpenRouter'} API key
                                                        </a>

                                                        <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)', marginTop: -8 }}>
                                                            Keys are encrypted and used only for your requests.
                                                        </div>

                                                    </div>

                                                    {/* Info Banner */}
                                                    <div style={{ display: 'flex', gap: 12, background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)', padding: 14, borderRadius: 16 }}>
                                                        <Info size={20} color="#60a5fa" style={{ flexShrink: 0 }} />
                                                        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: '1.4' }}>Use your own API keys to unlock faster inference and better model access across all services.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedSettingsPage === 'status' && (
                                        <div style={{ padding: '0px 24px', position: 'relative' }}>


                                            {statusLoading ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
                                                    <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid rgba(6, 182, 212, 0.3)', borderTopColor: '#06b6d4', borderRadius: '50%' }} />
                                                    <div style={{ color: '#cbd5e1', fontSize: 14 }}>Loading infrastructure metrics...</div>
                                                </div>
                                            ) : statusError ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 14 }}>
                                                    <ServerOff size={48} color="#ef4444" />
                                                    <div style={{ color: '#ef4444', fontSize: 18, fontWeight: 700 }}>Connection Failed</div>
                                                    <div style={{ color: '#cbd5e1', fontSize: 14 }}>{statusError}</div>
                                                    <button
                                                        onClick={fetchServerStatus}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)', borderRadius: 12, cursor: 'pointer', color: '#60a5fa', fontWeight: 600, fontSize: 14 }}
                                                    >
                                                        <RefreshCw size={16} />
                                                        Retry Connection
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                    {/* Tab Navigation */}
                                                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                                                        <button
                                                            onClick={() => setActiveStatusTab('ai')}
                                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: activeStatusTab === 'ai' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                        >
                                                            <Brain size={16} color={activeStatusTab === 'ai' ? '#60a5fa' : 'rgba(255,255,255,0.4)'} />
                                                            <span style={{ color: activeStatusTab === 'ai' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>AI Server</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setActiveStatusTab('ocr')}
                                                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: activeStatusTab === 'ocr' ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                                        >
                                                            <FileText size={16} color={activeStatusTab === 'ocr' ? '#8b5cf6' : 'rgba(255,255,255,0.4)'} />
                                                            <span style={{ color: activeStatusTab === 'ocr' ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 13 }}>OCR Server</span>
                                                        </button>
                                                    </div>

                                                    {/* Active Tab Content */}
                                                    {activeStatusTab === 'ai' && serverStatus && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 16 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                                    <Brain size={24} color="#60a5fa" />
                                                                    <span style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700 }}>SwitchAi Server</span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, background: aiHealth.bg }}>
                                                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: aiHealth.color }} />
                                                                    <span style={{ color: aiHealth.color, fontSize: 12, fontWeight: 700 }}>{aiHealth.status}</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ background: 'transparent', border: 'none', borderRadius: 16, padding: '0px 0px 20px 0px' }}>
                                                                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Multi-model AI processing with intelligent routing</div>

                                                                {/* Metrics Grid */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Success Rate</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{serverStatus.requests.successRate}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Total Requests</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(serverStatus.requests.total)}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Success</div>
                                                                        <div style={{ color: '#10b981', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(serverStatus.requests.successful)}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Failed</div>
                                                                        <div style={{ color: '#ef4444', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(serverStatus.requests.failed)}</div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

                                                                <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Activity</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(96, 165, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Server size={16} color="#60a5fa" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(serverStatus.today.requests)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>requests</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={16} color="#10b981" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(serverStatus.today.successful)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>success</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={16} color="#ef4444" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(serverStatus.today.errors)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>errors</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={16} color="#f59e0b" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(serverStatus.today.avgProcessingTime)}ms</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>avg time</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeStatusTab === 'ocr' && ocrServerStatus && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: 16 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                                    <FileText size={24} color="#8b5cf6" />
                                                                    <span style={{ color: '#e5e7eb', fontSize: 18, fontWeight: 700 }}>SwitchAi OCR</span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, background: ocrHealth.bg }}>
                                                                    <div style={{ width: 8, height: 8, borderRadius: 4, background: ocrHealth.color }} />
                                                                    <span style={{ color: ocrHealth.color, fontSize: 12, fontWeight: 700 }}>{ocrHealth.status}</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ background: 'transparent', border: 'none', borderRadius: 16, padding: '0px 0px 20px 0px' }}>
                                                                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Advanced optical character recognition for PDFs & images</div>

                                                                {/* Metrics Grid */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Success Rate</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{ocrServerStatus.requests.successRate}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Total Jobs</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.requests.total)}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Pages Processed</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.ocr?.totalPagesProcessed ?? 0)}</div>
                                                                    </div>
                                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12 }}>
                                                                        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>PDF Files</div>
                                                                        <div style={{ color: '#e5e7eb', fontSize: 20, fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.fileTypes?.pdf ?? 0)}</div>
                                                                    </div>
                                                                </div>

                                                                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

                                                                <div style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today's Activity</div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={16} color="#8b5cf6" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.today.requests)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>jobs</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={16} color="#10b981" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.today.successful)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>success</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={16} color="#ef4444" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.today.errors)}</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>errors</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                                                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={16} color="#f59e0b" /></div>
                                                                        <div>
                                                                            <div style={{ color: '#e5e7eb', fontWeight: 700 }}>{formatNumberSafe(ocrServerStatus.today.avgProcessingTime)}ms</div>
                                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>avg time</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Info Banner */}
                                                    <div style={{ display: 'flex', gap: 12, background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.2)', padding: 14, borderRadius: 16, marginTop: 'auto' }}>
                                                        <Info size={20} color="#60a5fa" style={{ flexShrink: 0 }} />
                                                        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: '1.4' }}>Real-time infrastructure monitoring with live service status and performance metrics.</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedSettingsPage === 'about' && (
                                        <div style={{
                                            paddingLeft: '8px',
                                            paddingRight: '8px',
                                            paddingBottom: 40
                                        }}>
                                            {/* Hero Section */}
                                            <div style={{
                                                position: 'relative',
                                                paddingTop: 8,
                                                paddingBottom: 6,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 10
                                            }}>
                                                {/* Hero Icon */}
                                                <div style={{
                                                    width: 90,
                                                    height: 90,
                                                    borderRadius: 20,
                                                    background: '#000000',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    marginBottom: 8,
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    {appAnimation && (
                                                        <Lottie
                                                            animationData={appAnimation}
                                                            loop={true}
                                                            style={{ width: 70, height: 70 }}
                                                        />
                                                    )}
                                                </div>

                                                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                    <div style={{
                                                        color: '#ffffff',
                                                        fontWeight: 600,
                                                        fontSize: 28,
                                                        letterSpacing: '1px',
                                                        textShadow: '0 1px 2px rgba(255,255,255,0.25)',
                                                        fontFamily: 'system-ui, -apple-system, sans-serif'
                                                    }}>
                                                        SwitchAi
                                                    </div>
                                                    <div style={{
                                                        color: 'rgba(255, 255, 255, 0.6)',
                                                        fontSize: 13,
                                                        letterSpacing: '0.5px',
                                                        fontWeight: 400,
                                                        marginTop: 4
                                                    }}>
                                                        Fast, private, and responsive AI
                                                    </div>
                                                </div>

                                                <div style={{
                                                    color: 'rgba(255, 255, 255, 0.7)',
                                                    fontSize: 14,
                                                    textAlign: 'center',
                                                    lineHeight: 1.6,
                                                    padding: '0 20px',
                                                    letterSpacing: '0.3px',
                                                    marginTop: 12
                                                }}>
                                                    SwitchAi gives you lightning-fast answers with privacy-first defaults and a clean, distraction-free chat UI.
                                                </div>
                                            </div>

                                            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 999, marginTop: 10, marginBottom: 16 }} />

                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 12
                                            }}>
                                                {/* Details Card */}
                                                <div style={{
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    borderRadius: 16,
                                                    padding: 20,
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    backdropFilter: 'blur(10px)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: 0
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                                                        <div style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.3px' }}>Website</div>
                                                        <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14, letterSpacing: '0.5px' }}>SwitchAi</div>
                                                    </div>
                                                    <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                                                        <div style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.3px' }}>Version</div>
                                                        <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14, letterSpacing: '0.5px' }}>2.0.0</div>
                                                    </div>
                                                </div>

                                                {/* Highlights */}
                                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                    <div style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 800, letterSpacing: '0.4px', paddingLeft: 4, paddingRight: 4 }}>
                                                        Highlights
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                                        {[
                                                            { icon: <Zap size={16} color="#000" />, label: 'Instant Responses' },
                                                            { icon: <Brain size={16} color="#000" />, label: 'Advanced AI' },
                                                            { icon: <Check size={16} color="#000" />, label: 'Secure' }, // Note: Reference uses shield-lock but lucide uses Check/Shield
                                                            { icon: <Settings size={16} color="#000" />, label: 'Customizable' }, // Reference: tune
                                                            { icon: <Rocket size={16} color="#000" />, label: 'High Performance' },
                                                        ].map((item, i) => (
                                                            <div key={i} style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                padding: '6px 10px',
                                                                background: '#ffffff',
                                                                borderRadius: 999,
                                                                boxShadow: '0 4px 6px rgba(0,0,0,0.12)'
                                                            }}>
                                                                <div style={{ color: '#000000', display: 'flex' }}>{item.icon}</div>
                                                                <div style={{
                                                                    color: '#000000',
                                                                    fontWeight: 600,
                                                                    fontSize: 11,
                                                                    letterSpacing: '0.5px',
                                                                    textShadow: '0 1px 2px rgba(0,0,0,0.25)'
                                                                }}>{item.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{
                                                        color: 'rgba(255, 255, 255, 0.5)',
                                                        fontSize: 12,
                                                        marginTop: 0, // margin handled by gap
                                                        textAlign: 'center',
                                                        letterSpacing: '0.3px'
                                                    }}>
                                                        SwitchAi pairs a refined UI with a fast, focused chat experience.
                                                    </div>
                                                </div>

                                                {/* Brand Card */}
                                                <div style={{
                                                    padding: 18,
                                                    alignItems: 'center',
                                                    margin: '16px',
                                                    borderRadius: 14,
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                    border: '1px solid rgba(255,255,255,0.12)',
                                                    textAlign: 'center'
                                                }}>
                                                    <div style={{
                                                        color: 'rgba(255, 255, 255, 0.7)',
                                                        fontSize: 14,
                                                        textAlign: 'center',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        Built for speed, privacy, and reliability.
                                                    </div>
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
    );
}
