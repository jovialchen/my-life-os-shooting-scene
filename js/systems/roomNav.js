/**
 * 房间直达导航面板（plan-0805 阶段 4）
 *
 * 左上角"🏠 房间"按钮展开面板，按楼层分组列出全部场景，
 * 点击直接 switchTo 直达（门动线之外的捷径，不影响门的传送逻辑）。
 * 当前场景高亮；切换中锁按钮；文案跟随 currentLang()。
 *
 * 高亮/锁定状态每 400ms 轮询 sceneManager（门传送等其他入口
 * 切场景也能正确反映），只在面板展开时轮询。
 */
import { SCENES } from '../config.js';
import { currentLang, LANG_CHANGE_EVENT } from '../ui.js';
import { getActiveScene, isTransitioning } from './sceneManager.js';

const GROUPS = [
    { id: 'outdoor', name: '室外', nameEn: 'Outdoor', match: (s) => s.id === 'outdoor' },
    { id: 'f1', name: '一楼', nameEn: 'Floor 1', match: (s) => s.id.startsWith('f1_') },
    { id: 'f2', name: '二楼', nameEn: 'Floor 2', match: (s) => s.id.startsWith('f2_') },
    { id: 'attic', name: '阁楼', nameEn: 'Attic', match: (s) => s.id.startsWith('attic_') },
];

/**
 * @param {{ onJump: (sceneId: string) => Promise<boolean> }} handlers
 */
export function initRoomNav({ onJump }) {
    const root = document.getElementById('room-nav');
    if (!root) return;

    root.innerHTML = `
        <button id="room-nav-toggle" type="button">🏠 <span id="room-nav-title"></span></button>
        <div id="room-nav-panel"></div>`;
    const toggle = root.querySelector('#room-nav-toggle');
    const panel = root.querySelector('#room-nav-panel');
    let pollTimer = null;

    function sceneName(s) {
        return currentLang() === 'en' ? s.nameEn : s.name;
    }

    function refreshState() {
        const active = getActiveScene();
        const busy = isTransitioning();
        panel.querySelectorAll('.room-nav-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.scene === active);
            btn.disabled = busy || btn.dataset.scene === active;
        });
    }

    function buildPanel() {
        root.querySelector('#room-nav-title').textContent =
            currentLang() === 'en' ? 'Rooms' : '房间';
        panel.innerHTML = '';
        for (const g of GROUPS) {
            const scenes = SCENES.filter(g.match);
            if (!scenes.length) continue;
            const group = document.createElement('div');
            group.className = 'room-nav-group';
            const header = document.createElement('div');
            header.className = 'room-nav-header';
            header.textContent = currentLang() === 'en' ? g.nameEn : g.name;
            group.appendChild(header);
            for (const s of scenes) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'room-nav-btn';
                btn.dataset.scene = s.id;
                btn.textContent = sceneName(s);
                btn.addEventListener('click', async () => {
                    if (isTransitioning()) return;
                    await onJump(s.id);
                    refreshState();
                });
                group.appendChild(btn);
            }
            panel.appendChild(group);
        }
        refreshState();
    }

    toggle.addEventListener('click', () => {
        const open = root.classList.toggle('open');
        if (open) {
            refreshState();
            pollTimer = setInterval(refreshState, 400);
        } else {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    });
    document.addEventListener('click', (e) => {
        if (!root.contains(e.target) && root.classList.contains('open')) {
            root.classList.remove('open');
            clearInterval(pollTimer);
            pollTimer = null;
        }
    });

    window.addEventListener(LANG_CHANGE_EVENT, buildPanel);
    buildPanel();
}
