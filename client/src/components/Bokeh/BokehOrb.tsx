import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../i18n/useLanguage';

interface BokehOrbProps {
    onClick: () => void;
}

const BokehOrb: React.FC<BokehOrbProps> = ({ onClick }) => {
    const { t } = useLanguage();
    return (
        <div style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999 }}>
            <motion.div
                drag
                dragConstraints={{ left: -window.innerWidth + 50, right: 0, top: -window.innerHeight + 50, bottom: 0 }}
                whileHover={{ scale: 1.1, filter: 'brightness(1.2)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0, 191, 165, 0.6), rgba(142, 36, 170, 0.6))',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                animate={{
                    boxShadow: [
                        '0 0 15px rgba(0, 191, 165, 0.3)',
                        '0 0 25px rgba(142, 36, 170, 0.5)',
                        '0 0 15px rgba(0, 191, 165, 0.3)'
                    ],
                    scale: [1, 1.05, 1],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.8)',
                    filter: 'blur(2px)'
                }} />
            </motion.div>

            {/* Tooltip on Hover */}
            <div className="bokeh-tooltip" style={{
                position: 'absolute',
                right: '60px',
                top: '12px',
                background: 'rgba(0,0,0,0.8)',
                padding: '4px 8px',
                borderRadius: '6px',
                color: 'white',
                fontSize: '12px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                opacity: 0,
                transition: 'opacity 0.2s',
            }}>
                {t('bokeh.orb.tooltip')}
            </div>
            <style>{`
                div:hover > .bokeh-tooltip {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
};

export default BokehOrb;
