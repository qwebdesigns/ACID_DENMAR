// ==UserScript==
// @name         ACID CW PERKS
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  CWP ACID perks with OOP, Settings and Ticket Tracker
// @author       Denmar
// @license      MIT
// @match        *://chatwoot.echelon.su/*
// @match        *://echelon.su/api/dashboard/*
// @updateURL    https://openuserjs.org/meta/Denmar/ACID_CW_PERKS.meta.js
// @downloadURL  https://openuserjs.org/install/Denmar/ACID_CW_PERKS.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        window.onurlchange
// ==/UserScript==

(function () {
    'use strict';

    class AcidPerks {
        constructor() {
            this.defaultSettings = {
                timeConverter: true,
                ticketTracker: true,
                customValue: 'Текст'
            };
            this.settings = this.loadSettings();
            this.intervals = {};
            this.observers = {};
        }

        // --- ИНИЦИАЛИЗАЦИЯ ---
        init() {
            this.injectStyles();
            this.setupObservers();
            this.startIntervalTasks();
            this.runOnLoadTasks();
        }

        loadSettings() {
            const saved = localStorage.getItem('acidSettings');
            return saved ? JSON.parse(saved) : this.defaultSettings;
        }

        saveSettings(newSettings) {
            this.settings = newSettings;
            localStorage.setItem('acidSettings', JSON.stringify(this.settings));
        }

        injectStyles() {
            const style = document.createElement('style');
            style.textContent = `
                .bg-prog {
                    position: absolute; top: 0; left: 0; bottom: 0; z-index: 0; pointer-events: none;
                }
                .bot-prog {
                    position: absolute; bottom: 0.5vh; left: 1vw; height: 0.4vh; border-radius: 0.2vw; z-index: 1; pointer-events: none;
                    display: none;
                }
                .snow-icon { font-size: 1.5vw; }
                
                @keyframes clientWait {
                    0%   { width: 100%; background-color: hsla(120, 100%, 40%, 0.25); }
                    100% { width: 0%;   background-color: hsla(0, 100%, 40%, 0.25); }
                }
                .t-client-wait .bg-prog { animation: clientWait 300s linear forwards; }
                .t-client-expired .bg-prog { width: 100%; background-color: rgba(239, 68, 68, 0.25); }

                .t-agent-wait .bg-prog { width: 100%; background-color: rgba(14, 165, 233, 0.1); }
                @keyframes agentWait {
                    0%   { width: calc(100% - 2vw); }
                    100% { width: 0%; }
                }
                .t-agent-wait .bot-prog {
                    display: block; background-color: rgba(14, 165, 233, 0.6); animation: agentWait 1800s linear forwards;
                }
                .t-agent-expired .bg-prog { width: 100%; background-color: rgba(100, 116, 139, 0.15); }
            `;
            document.head.appendChild(style);
        }

        parseSeconds(timeStr) {
            if (!timeStr || timeStr.includes('now')) return 0;
            const match = timeStr.match(/(\d+)([a-z]+)/);
            if (!match) return 0;
            const val = parseInt(match[1]);
            const unit = match[2];
            if (unit === 'm') return val * 60;
            if (unit === 'h') return val * 3600;
            if (unit === 'd') return val * 86400;
            return val;
        }

        // --- ФУНКЦИЯ 1: Конвертер времени ---
        featureTimeConverter() {
            if (!this.settings.timeConverter) return;

            const spans = document.querySelectorAll('span.font-mono');
            for (const span of spans) {
                if (span.getAttribute('data-timezone-updated') === 'true') continue;

                const text = span.textContent.trim();
                const timeMatch = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);

                if (timeMatch) {
                    let hours = parseInt(timeMatch[1], 10);
                    const minutes = timeMatch[2];
                    const seconds = timeMatch[3];

                    hours = (hours + 3) % 24;
                    const formattedHours = hours.toString().padStart(2, '0');

                    span.textContent = `[${formattedHours}:${minutes}:${seconds}]`;
                    span.style.setProperty('font-size', '65%', 'important');
                    span.setAttribute('data-timezone-updated', 'true');
                }
            }
        }

        // --- ФУНКЦИЯ 2: Трекер тикетов ---
        featureTicketTracker() {
            if (!this.settings.ticketTracker) {
                // Очистка при выключении
                document.querySelectorAll('.bg-prog, .bot-prog').forEach(el => el.remove());
                document.querySelectorAll('.conversation').forEach(conv => {
                    conv.classList.remove('t-client-wait', 't-client-expired', 't-agent-wait', 't-agent-expired');
                });
                return;
            }

            const conversations = document.querySelectorAll('.conversation');

            for (const conv of conversations) {
                const timeContainer = conv.querySelector('.v-popper--has-tooltip span');
                const msgContainer = conv.querySelector('.leading-6.h-6');
                if (!timeContainer || !msgContainer) continue;

                const timeText = timeContainer.textContent;
                const isAgent = msgContainer.innerHTML.includes('M9.277 16.221');

                const stateHash = timeText + '|' + isAgent;
                if (conv.dataset.stateHash === stateHash) continue;
                conv.dataset.stateHash = stateHash;

                const parts = timeText.split('•').map(s => s.trim());
                const lastActiveStr = parts.length > 1 ? parts[1] : parts[0];
                const elapsedSec = this.parseSeconds(lastActiveStr);

                let bgProg = conv.querySelector('.bg-prog');
                if (!bgProg) {
                    bgProg = document.createElement('div');
                    bgProg.className = 'bg-prog';
                    conv.insertBefore(bgProg, conv.firstChild);
                }

                let botProg = conv.querySelector('.bot-prog');
                if (!botProg) {
                    botProg = document.createElement('div');
                    botProg.className = 'bot-prog';
                    conv.appendChild(botProg);
                }

                Array.from(conv.children).forEach(child => {
                    if (!child.classList.contains('bg-prog') && !child.classList.contains('bot-prog')) {
                        child.style.position = 'relative';
                        child.style.zIndex = '2';
                    }
                });

                const avatarContainer = conv.querySelector('span[role="img"]');
                let avatarImg = avatarContainer ? avatarContainer.querySelector('img, span.select-none') : null;
                let snowIcon = conv.querySelector('.snow-icon');

                if (avatarImg) avatarImg.style.display = '';
                if (snowIcon) snowIcon.style.display = 'none';

                conv.classList.remove('t-client-wait', 't-client-expired', 't-agent-wait', 't-agent-expired');
                bgProg.style.animation = 'none';
                botProg.style.animation = 'none';
                void bgProg.offsetWidth;
                bgProg.style.animation = '';
                botProg.style.animation = '';

                if (!isAgent) {
                    if (elapsedSec >= 300) {
                        conv.classList.add('t-client-expired');
                    } else {
                        conv.classList.add('t-client-wait');
                        bgProg.style.animationDelay = `-${elapsedSec}s`;
                    }
                } else {
                    if (elapsedSec >= 1800) {
                        conv.classList.add('t-agent-expired');
                        if (avatarImg) avatarImg.style.display = 'none';

                        if (!snowIcon && avatarContainer) {
                            snowIcon = document.createElement('div');
                            snowIcon.className = 'snow-icon absolute inset-0 flex items-center justify-center z-20';
                            snowIcon.innerHTML = '❄️';
                            avatarContainer.appendChild(snowIcon);
                        } else if (snowIcon) {
                            snowIcon.style.display = 'flex';
                        }
                    } else {
                        conv.classList.add('t-agent-wait');
                        botProg.style.animationDelay = `-${elapsedSec}s`;
                    }
                }
            }
        }

        // --- ФУНКЦИЯ 3: Внедрение кнопки меню ---
        featureMenuInjector() {
            if (document.getElementById('acid-settings-btn')) return;

            const buttons = document.querySelectorAll('.n-dropdown-item button, .n-dropdown-item a');
            let targetBtn = null;

            for (const btn of buttons) {
                if (btn.textContent.includes('Изменить внешний вид')) {
                    targetBtn = btn;
                    break;
                }
            }

            if (targetBtn) {
                const liElement = targetBtn.closest('.n-dropdown-item');
                if (!liElement) return;
                const containerDiv = liElement.parentElement;

                const newDiv = document.createElement('div');
                newDiv.innerHTML = `
                    <li class="n-dropdown-item">
                        <button id="acid-settings-btn" class="flex text-left rtl:text-right items-center p-2 reset-base text-sm text-n-slate-12 w-full border-0 hover:bg-n-alpha-2 rounded-lg gap-3" style="color: #cbd5e1; font-weight: 400;">
                            <span style="font-size: 1vw; color: #b3e600;">👀</span> ACID SETTINGS
                        </button>
                    </li>
                `;

                containerDiv.parentNode.insertBefore(newDiv, containerDiv.nextSibling);

                document.getElementById('acid-settings-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const menuWrap = document.querySelector('.absolute.bottom-12.z-50');
                    if (menuWrap) menuWrap.style.display = 'none';
                    this.openSettingsPanel();
                });
            }
        }

        // --- ФУНКЦИЯ 4: Панель настроек ---
        openSettingsPanel() {
            if (document.getElementById('acid-modal-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'acid-modal-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 99999;
                display: flex; align-items: center; justify-content: center;
                background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(0.5vh);
                opacity: 0; transition: opacity 0.2s ease;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: rgba(28, 31, 35, 0.95); 
                border: 0.1vw solid rgba(255, 255, 255, 0.08); 
                border-radius: 1vw;
                width: 22vw; min-width: 18vw; padding: 1.5vw; color: #e2e8f0;
                box-shadow: 0 1vh 3vh rgba(0, 0, 0, 0.4);
                transform: scale(0.95); transition: transform 0.2s ease;
                font-family: inherit;
            `;

            modal.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2vh;">
                    <h2 style="margin: 0; font-size: 1vw; font-weight: 500; color: #f8fafc; letter-spacing: 0.02vw;">ACID SETTINGS</h2>
                    <button id="acid-close-btn" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.2vw; padding: 0; transition: color 0.2s;" onmouseover="this.style.color='#f8fafc'" onmouseout="this.style.color='#64748b'">&times;</button>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 2vh;">
                    
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Конвертер времени (МСК)</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.timeConverter ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-time-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.timeConverter ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.timeConverter ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-time-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-time" style="display: none;" ${this.settings.timeConverter ? 'checked' : ''}>
                    </label>

                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Трекер тикетов (Таймеры)</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.ticketTracker ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-tracker-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.ticketTracker ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.ticketTracker ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-tracker-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-tracker" style="display: none;" ${this.settings.ticketTracker ? 'checked' : ''}>
                    </label>

                    <div style="display: flex; flex-direction: column; gap: 0.5vh;">
                        <label style="font-size: 0.75vw; color: #64748b;">Кастомное значение</label>
                        <input type="text" id="acid-text-val" value="${this.settings.customValue}" style="
                            background: rgba(0, 0, 0, 0.2); border: 0.1vw solid rgba(255, 255, 255, 0.08);
                            color: #f8fafc; padding: 0.8vh 0.8vw; border-radius: 0.5vw; font-size: 0.9vw; outline: none;
                            transition: border-color 0.2s;
                        " onfocus="this.style.borderColor='#b3e600'" onblur="this.style.borderColor='rgba(255, 255, 255, 0.08)'">
                    </div>
                </div>

                <button id="acid-save-btn" style="
                    width: 100%; margin-top: 3vh; padding: 1vh; background: #b3e600; color: #111827;
                    border: none; border-radius: 0.5vw; font-weight: 500; cursor: pointer; font-size: 0.9vw;
                    transition: opacity 0.2s;
                " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">Сохранить</button>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });

            // Логика UI
            const bindToggle = (inputId, bgId, dotId) => {
                const check = document.getElementById(inputId);
                const bg = document.getElementById(bgId);
                const dot = document.getElementById(dotId);
                check.addEventListener('change', (e) => {
                    bg.style.background = e.target.checked ? '#b3e600' : 'rgba(255,255,255,0.1)';
                    dot.style.left = e.target.checked ? '1.45vw' : '0.15vw';
                    dot.style.background = e.target.checked ? '#111827' : '#94a3b8';
                });
            };

            bindToggle('acid-t-time', 'acid-t-time-bg', 'acid-t-time-dot');
            bindToggle('acid-t-tracker', 'acid-t-tracker-bg', 'acid-t-tracker-dot');

            const closeModal = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 200);
            };

            document.getElementById('acid-close-btn').addEventListener('click', closeModal);

            document.getElementById('acid-save-btn').addEventListener('click', () => {
                this.saveSettings({
                    timeConverter: document.getElementById('acid-t-time').checked,
                    ticketTracker: document.getElementById('acid-t-tracker').checked,
                    customValue: document.getElementById('acid-text-val').value
                });
                const btn = document.getElementById('acid-save-btn');
                btn.textContent = 'Сохранено';
                btn.style.background = '#e2e8f0';
                setTimeout(closeModal, 600);
            });
        }

        // --- УПРАВЛЕНИЕ ---
        setupObservers() {
            this.observers.menu = new MutationObserver(() => this.featureMenuInjector());
            this.observers.menu.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        startIntervalTasks() {
            this.intervals.timeConverter = setInterval(() => this.featureTimeConverter(), 500);
            this.intervals.ticketTracker = setInterval(() => this.featureTicketTracker(), 1000);
        }

        runOnLoadTasks() {
            console.log("ACID CW PERKS: Модули загружены.");
        }
    }

    const app = new AcidPerks();
    app.init();

})();