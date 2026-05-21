// ==UserScript==
// @name         ACID CW PERKS
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  CWP ACID perks with OOP and Settings
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
                customValue: 'Текст'
            };
            this.settings = this.loadSettings();
            this.intervals = {};
            this.observers = {};
        }

        init() {
            this.setupObservers();
            this.startIntervalTasks();
            this.runOnLoadTasks();
        }

        loadSettings() {
            // Теперь можно использовать GM_getValue, но для совместимости оставим localStorage
            const saved = localStorage.getItem('acidSettings');
            return saved ? JSON.parse(saved) : this.defaultSettings;
        }

        saveSettings(newSettings) {
            this.settings = newSettings;
            localStorage.setItem('acidSettings', JSON.stringify(this.settings));
        }

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

                    <div style="display: flex; flex-direction: column; gap: 0.5vh;">
                        <label style="font-size: 0.75vw; color: #64748b;">Пример поля</label>
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

            const timeCheck = document.getElementById('acid-t-time');
            const timeBg = document.getElementById('acid-t-time-bg');
            const timeDot = document.getElementById('acid-t-time-dot');

            timeCheck.addEventListener('change', (e) => {
                timeBg.style.background = e.target.checked ? '#b3e600' : 'rgba(255,255,255,0.1)';
                timeDot.style.left = e.target.checked ? '1.45vw' : '0.15vw';
                timeDot.style.background = e.target.checked ? '#111827' : '#94a3b8';
            });

            const closeModal = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 200);
            };

            document.getElementById('acid-close-btn').addEventListener('click', closeModal);

            document.getElementById('acid-save-btn').addEventListener('click', () => {
                this.saveSettings({
                    timeConverter: timeCheck.checked,
                    customValue: document.getElementById('acid-text-val').value
                });
                const btn = document.getElementById('acid-save-btn');
                btn.textContent = 'Сохранено';
                btn.style.background = '#e2e8f0';
                setTimeout(closeModal, 600);
            });
        }

        setupObservers() {
            this.observers.menu = new MutationObserver(() => this.featureMenuInjector());
            this.observers.menu.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        startIntervalTasks() {
            this.intervals.timeConverter = setInterval(() => this.featureTimeConverter(), 500);
        }

        runOnLoadTasks() {
            console.log("ACID CW PERKS: Загружено. Настройки:", this.settings);
        }
    }

    const app = new AcidPerks();
    app.init();

})();