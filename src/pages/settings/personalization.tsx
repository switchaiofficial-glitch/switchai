import SettingsLayout from '../../components/SettingsLayout';
import '../../styles/animations.css';

export default function PersonalizationPage() {
  return (
    <SettingsLayout title="Personalization" subtitle="Customize your experience">
      <div className="animate-fade-in-up" style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <div style={{ color: '#888888', fontSize: 14 }}>
          No personalization settings available yet.
        </div>
      </div>
    </SettingsLayout>
  );
}