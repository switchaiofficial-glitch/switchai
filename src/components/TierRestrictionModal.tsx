import React from 'react';
import { X, Smartphone, ExternalLink } from 'lucide-react';

interface TierRestrictionModalProps {
    isOpen: boolean;
    onClose: () => void;
    requiredTier?: 'lite' | 'pro';
}

export const TierRestrictionModal: React.FC<TierRestrictionModalProps> = ({
    isOpen,
    onClose,
    requiredTier = 'pro'
}) => {
    if (!isOpen) return null;

    const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.vivekgowdas.SwitchAi';

    const tierConfig = {
        lite: {
            title: 'Lite Plan Required',
            description: 'Upgrade to Lite to access this model',
            badge: 'LITE',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: '#3b82f6'
        },
        pro: {
            title: 'Pro Plan Required',
            description: 'Upgrade to Pro to unlock this model',
            badge: 'PRO',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: '#8b5cf6'
        }
    };

    const config = tierConfig[requiredTier];

    return (
        <div className="tier-modal-overlay" onClick={onClose}>
            <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button className="tier-modal-close" onClick={onClose} aria-label="Close">
                    <X size={18} strokeWidth={2.5} />
                </button>

                {/* Content */}
                <div className="tier-modal-content">
                    {/* Badge with Gradient */}
                    <div className="tier-modal-badge" style={{ background: config.gradient }}>
                        {config.badge}
                    </div>

                    {/* Title & Description */}
                    <div className="tier-modal-header">
                        <h2 className="tier-modal-title">{config.title}</h2>
                        <p className="tier-modal-description">{config.description}</p>
                    </div>

                    {/* Divider */}
                    <div className="tier-modal-divider" />

                    {/* Message */}
                    <div className="tier-modal-message">
                        <div className="tier-modal-message-icon" style={{ color: config.color }}>
                            <Smartphone size={20} strokeWidth={2} />
                        </div>
                        <div className="tier-modal-message-text">
                            <p>
                                Download <strong>SwitchAI</strong> to upgrade and unlock all premium models
                            </p>
                        </div>
                    </div>

                    {/* QR Code */}
                    <div className="tier-modal-qr">
                        <div className="tier-modal-qr-container">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(playStoreUrl)}`}
                                alt="Download SwitchAI"
                                className="tier-modal-qr-image"
                            />
                        </div>
                        <p className="tier-modal-qr-text">Scan with your phone</p>
                    </div>

                    {/* Action Button */}
                    <a
                        href={playStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tier-modal-btn"
                    >
                        <span>Open Play Store</span>
                        <ExternalLink size={16} strokeWidth={2.5} />
                    </a>
                </div>
            </div>
        </div>
    );
};
