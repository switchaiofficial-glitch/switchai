import { Cpu, Download, HardDrive } from 'lucide-react';
import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function LocalModelPage() {
    return (
        <SettingsLayout title="Local Models" subtitle="Run AI models locally on your device">
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
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Cpu size={20} color="#a855f7" />
                </div>
                <div>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Run Models Locally</div>
                    <div style={{ color: '#888888', fontSize: 13, lineHeight: 1.6 }}>
                        Download and run AI models directly on your device for maximum privacy and offline access. No internet connection required.
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
                <HardDrive size={48} style={{ margin: '0 auto 16px', color: '#666666' }} />
                <div style={{ color: '#ffffff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Coming Soon</div>
                <div style={{ color: '#888888', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
                    Local model support is currently in development. Soon you'll be able to download and run models like Llama, Mistral, and more directly on your device.
                </div>
            </div>

            {/* Features Preview */}
            <div className="animate-fade-in-up" style={{ marginTop: 24, animationDelay: '200ms' }}>
                <div style={{ color: '#ffffff', fontSize: 16, fontWeight: 700, marginBottom: 16, letterSpacing: '-0.3px' }}>Planned Features</div>
                <div style={{ display: 'grid', gap: 12 }}>
                    {[
                        { icon: <Download size={18} />, title: 'Model Downloads', desc: 'Browse and download popular open-source models' },
                        { icon: <Cpu size={18} />, title: 'Hardware Acceleration', desc: 'GPU and NPU support for faster inference' },
                        { icon: <HardDrive size={18} />, title: 'Offline Mode', desc: 'Use AI without internet connection' },
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
                            <div style={{ color: '#a855f7' }}>{feature.icon}</div>
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
