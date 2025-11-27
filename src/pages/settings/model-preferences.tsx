import { Brain, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function ModelPreferencePage() {
    const [autoSwitch, setAutoSwitch] = useState(() => {
        try {
            return localStorage.getItem('autoModelSwitch') !== 'false';
        } catch {
            return true;
        }
    });

    const handleToggle = (value: boolean) => {
        setAutoSwitch(value);
        localStorage.setItem('autoModelSwitch', value ? 'true' : 'false');
    };

    return (
        <SettingsLayout title="Model Preferences" subtitle="Configure AI model selection">
            {/* Auto Model Switch */}
            <div className="animate-fade-in-up" style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Sparkles size={20} color="#f59e0b" />
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#e5e7eb' }}>Auto Model Switch</div>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: 14 }}>
                            Automatically select the best model based on your query
                        </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={autoSwitch}
                            onChange={(e) => handleToggle(e.target.checked)}
                            style={{ width: 20, height: 20, cursor: 'pointer' }}
                        />
                    </label>
                </div>
            </div>

            {/* Model Info */}
            <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Available Models</div>
                <div style={{ display: 'grid', gap: 12 }}>
                    {[
                        {
                            icon: <Zap size={18} />,
                            name: 'GPT-4o',
                            desc: 'Best for complex reasoning and analysis',
                            color: '#10b981',
                        },
                        {
                            icon: <Brain size={18} />,
                            name: 'Claude 3.5 Sonnet',
                            desc: 'Excellent for creative writing and coding',
                            color: '#a78bfa',
                        },
                        {
                            icon: <Sparkles size={18} />,
                            name: 'Gemini 2.0 Flash',
                            desc: 'Fast responses for general queries',
                            color: '#3b82f6',
                        },
                    ].map((model, i) => (
                        <div key={i} style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 12,
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'all 0.2s ease',
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}>
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: `${model.color}20`,
                                border: `1px solid ${model.color}40`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: model.color,
                            }}>
                                {model.icon}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{model.name}</div>
                                <div style={{ color: '#888888', fontSize: 13 }}>{model.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Info Box */}
            <div className="animate-fade-in-up" style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 12,
                padding: 20,
                marginTop: 24,
                animationDelay: '200ms',
            }}>
                <div style={{ color: '#93c5fd', fontSize: 14, lineHeight: 1.6 }}>
                    <strong>How Auto Model Switch works:</strong>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        <li>Analyzes your query to determine the best model</li>
                        <li>Switches between models for optimal performance</li>
                        <li>Balances speed, quality, and cost</li>
                        <li>Can be disabled to manually select models</li>
                    </ul>
                </div>
            </div>
        </SettingsLayout>
    );
}
