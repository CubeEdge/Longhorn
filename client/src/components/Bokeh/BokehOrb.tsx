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
                    // Kine Green(#10B981)到淡紫色(Lavender #8E24AA)渐变
                    background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.35) 0%, rgba(142, 36, 170, 0.65) 100%)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 0 24px rgba(142, 36, 170, 0.5), 0 0 12px rgba(16, 185, 129, 0.3)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'visible'
                }}
                animate={{
                    boxShadow: [
                        '0 0 18px rgba(16, 185, 129, 0.4), 0 0 8px rgba(16, 185, 129, 0.2)',
                        '0 0 40px rgba(142, 36, 170, 0.8), 0 0 15px rgba(142, 36, 170, 0.4)',
                        '0 0 18px rgba(16, 185, 129, 0.4), 0 0 8px rgba(16, 185, 129, 0.2)'
                    ],
                    scale: [1, 1.03, 1],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                {/* 灵动核心 - 极致白亮中心 (对齐图2) */}
                <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 0 12px 4px #fff, 0 0 20px 8px rgba(16, 185, 129, 0.6)',
                    filter: 'blur(1px)',
                    position: 'relative',
                    zIndex: 2
                }} />

                {/* 核心外层晕染 */}
                <div style={{
                    position: 'absolute',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.8) 0%, rgba(142, 36, 170, 0.4) 100%)',
                    filter: 'blur(4px)',
                    zIndex: 1
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
