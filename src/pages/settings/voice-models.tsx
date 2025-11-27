import { Mic, Volume2, Waves } from 'lucide-react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function VoiceModelPage() {
    return (
        <SettingsLayout title="Voice Models" subtitle="Configure voice input and output">
            {/* Info Card */}
            <div className="animate-fade-in-up" style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
            }}>
                <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Mic size={20} color="#3b82f6" />
                </div>
                <div>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Voice Interaction</div>
                    <div style={{ color: '#888888', fontSize: 13, lineHeight: 1.6 }}>
                        Customize voice input recognition and text-to-speech output for a natural conversation experience.
                    </div>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="animate-fade-in-up" style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '60px 20px',
                textAlign: 'center',
                animationDelay: '100ms',
            }}>
                <Waves size={48} style={{ margin: '0 auto 16px', color: '#666666' }} />
                <div style={{ color: '#ffffff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
                <div style={{ color: '#888888', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
                    Voice model configuration is currently in development. Soon you'll be able to customize voice recognition and synthesis settings.
                </div>
            </div>

            {/* Features Preview */}
            <div className="animate-fade-in-up" style={{ marginTop: 24, animationDelay: '200ms' }}>
                <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Planned Features</div>
                <div style={{ display: 'grid', gap: 12 }}>
                    {[
                        { icon: <Mic size={18} />, title: 'Speech Recognition', desc: 'Convert your voice to text with high accuracy' },
                        { icon: <Volume2 size={18} />, title: 'Text-to-Speech', desc: 'Natural-sounding AI voice responses' },
                        { icon: <Waves size={18} />, title: 'Voice Selection', desc: 'Choose from multiple voice models and accents' },
                    ].map((feature, i) => (
                        <div key={i} style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 12,
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }}>
                            <div style={{ color: '#3b82f6' }}>{feature.icon}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{feature.title}</div>
                                <div style={{ color: '#888888', fontSize: 12 }}>{feature.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SettingsLayout>
    );
}
