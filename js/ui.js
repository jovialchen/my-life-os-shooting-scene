/**
 * UI：时间滑块、季节滑块、语言切换球、指南针
 */
import { TIME_PRESETS, SEASON_PRESETS } from './config.js';

export function currentLang() {
    return localStorage.getItem('scene-lang') || 'zh';
}

/** 语言切换后派发的事件名（cameraZones 等监听此事件重刷文案） */
export const LANG_CHANGE_EVENT = 'scene-lang-change';

/**
 * 初始化滑块和语言切换
 * @param {{ onTimeChange: (v: number) => void, onSeasonChange: (v: number) => void }} handlers
 */
export function initUI({ onTimeChange, onSeasonChange }) {
    const timeSlider   = document.getElementById('time-slider');
    const timeLabel    = document.getElementById('time-label');
    const seasonSlider = document.getElementById('season-slider');
    const seasonLabel  = document.getElementById('season-label');

    function refreshTimeLabel() {
        if (!timeSlider || !timeLabel) return;
        const preset = TIME_PRESETS[Math.round(parseFloat(timeSlider.value))];
        timeLabel.textContent = currentLang() === 'en' ? preset.nameEn : preset.name;
    }

    function refreshSeasonLabel() {
        if (!seasonSlider || !seasonLabel) return;
        const preset = SEASON_PRESETS[Math.round(parseFloat(seasonSlider.value))];
        seasonLabel.textContent = currentLang() === 'en' ? preset.nameEn : preset.name;
    }

    if (timeSlider) {
        timeSlider.addEventListener('input', () => {
            onTimeChange(parseFloat(timeSlider.value));
            refreshTimeLabel();
        });
    }

    if (seasonSlider) {
        seasonSlider.addEventListener('input', () => {
            onSeasonChange(parseFloat(seasonSlider.value));
            refreshSeasonLabel();
        });
    }

    // ── 语言切换球 ──
    const langGlobe = document.getElementById('lang-globe');
    if (langGlobe) {
        function updateGlobeOpts() {
            langGlobe.querySelectorAll('.lang-opt').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === currentLang());
            });
        }

        langGlobe.addEventListener('click', (e) => {
            const opt = e.target.closest('.lang-opt');
            if (opt) {
                const code = opt.dataset.lang;
                if (currentLang() !== code) {
                    localStorage.setItem('scene-lang', code);
                    updateGlobeOpts();
                    refreshTimeLabel();
                    refreshSeasonLabel();
                    const timeBarLabel = document.querySelector('#time-bar label');
                    if (timeBarLabel) timeBarLabel.textContent = code === 'en' ? '☀ Time' : '☀ 时间';
                    const seasonBarLabel = document.querySelector('#season-bar label');
                    if (seasonBarLabel) seasonBarLabel.textContent = code === 'en' ? '🍃 Season' : '🍃 季节';
                    window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT));
                }
                langGlobe.classList.remove('open');
                return;
            }
            langGlobe.classList.toggle('open');
        });
        document.addEventListener('click', (e) => {
            if (!langGlobe.contains(e.target)) langGlobe.classList.remove('open');
        });
        updateGlobeOpts();
    }
}

// ── 指南针 ──
let compassRing = null;

/** 每帧更新指南针旋转（跟随相机方位） */
export function updateCompass(camera, controls) {
    if (!compassRing) compassRing = document.getElementById('compass-ring');
    if (!compassRing) return;
    const camAngle = Math.atan2(
        controls.target.x - camera.position.x,
        controls.target.z - camera.position.z,
    );
    compassRing.style.transform = `rotate(${camAngle * 180 / Math.PI}deg)`;
}
