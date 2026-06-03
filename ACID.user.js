// ==UserScript==
// @name         ACID CW PERKS
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  CWP ACID perks with OOP, Settings and Ticket Tracker1
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
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    class AcidPerks {
        constructor() {
            this.defaultSettings = {
                timeConverter: true,
                ticketTracker: true,
                addressPanel: true,
                customHeader: true,
                customValue: ''
            };
            this.settings = this.loadSettings();
            this.intervals = {};
            this.observers = {};

            this.currentChatData = null;

            this.addressRegions = {
                "SG": {
                    name: "Singapore",
                    bbox: "1.23, 103.60, 1.47, 104.05",
                    defaultCity: "Southern Islands",
                    names: ["Wei", "Jian", "Sarah", "Michael", "Chloe", "David", "Xin", "Lucas", "Emma", "Jun", "Ming", "Li", "Yan", "Hong", "Feng", "Ryan", "Rachel", "Ethan", "Grace", "Noah", "Olivia", "Matthew", "Sophia", "Benjamin", "Isabella", "Ahmad", "Siti", "Priya", "Arjun"],
                    surnames: ["Tan", "Lim", "Lee", "Ng", "Ong", "Wong", "Goh", "Chua", "Chan", "Koh", "Teo", "Yeo", "Loh", "Sim", "Wee", "Foo", "Yap", "Heng", "Low", "Chew", "Pang", "Seet", "Kee", "Ho", "Liang", "Phua", "Tay", "Yip", "Lam", "Kwan"]
                }
            };
            this.currentAddress = null;
        }

        // Запуск до загрузки страницы
        initNetwork() {
            this.setupNetworkHooks();
        }

        // Запуск после рендера DOM
        initDOM() {
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
                .bg-prog { position: absolute; top: 0; left: 0; bottom: 0; z-index: 0; pointer-events: none; }
                .bot-prog { position: absolute; bottom: 0.5vh; left: 1vw; height: 0.4vh; border-radius: 0.2vw; z-index: 1; pointer-events: none; display: none; }
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
                .t-agent-wait .bot-prog { display: block; background-color: rgba(14, 165, 233, 0.6); animation: agentWait 1800s linear forwards; }
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

        featureTicketTracker() {
            if (!this.settings.ticketTracker) {
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
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Трекер тикетов (Таймеры)</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.ticketTracker ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-tracker-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.ticketTracker ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.ticketTracker ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-tracker-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-tracker" style="display: none;" ${this.settings.ticketTracker ? 'checked' : ''}>
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 0.5vh;">
                        <label style="font-size: 0.75vw; color: #64748b;">Кастомное значение</label>
                        <input type="text" id="acid-text-val" value="${this.settings.customValue || ''}" style="
                            background: rgba(0, 0, 0, 0.2); border: 0.1vw solid rgba(255, 255, 255, 0.08);
                            color: #f8fafc; padding: 0.8vh 0.8vw; border-radius: 0.5vw; font-size: 0.9vw; outline: none;
                            transition: border-color 0.2s;
                        " onfocus="this.style.borderColor='#b3e600'" onblur="this.style.borderColor='rgba(255, 255, 255, 0.08)'">
                    </div>
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Панель генерации адресов</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.addressPanel ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-addr-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.addressPanel ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.addressPanel ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-addr-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-addr" style="display: none;" ${this.settings.addressPanel ? 'checked' : ''}>
                    </label>
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Кастомный хедер тикета</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.customHeader ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-head-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.customHeader ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.customHeader ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-head-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-head" style="display: none;" ${this.settings.customHeader ? 'checked' : ''}>
                    </label>
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
            bindToggle('acid-t-addr', 'acid-t-addr-bg', 'acid-t-addr-dot');
            bindToggle('acid-t-head', 'acid-t-head-bg', 'acid-t-head-dot');

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
                    addressPanel: document.getElementById('acid-t-addr').checked,
                    customHeader: document.getElementById('acid-t-head').checked,
                    customValue: document.getElementById('acid-text-val').value || ''
                });

                const btn = document.getElementById('acid-save-btn');
                btn.textContent = 'Сохранено';
                btn.style.background = '#e2e8f0';
                setTimeout(closeModal, 600);
            });
        }

        featureAddressPanel() {
            if (!this.settings.addressPanel) return;
            if (document.getElementById('acid-address-panel')) return;

            const navList = document.querySelector('nav.overflow-y-scroll > ul.flex-col');
            if (!navList) return;

            const panelHtml = document.createElement('li');
            panelHtml.id = 'acid-address-panel';
            panelHtml.className = 'grid gap-1 text-sm select-none min-w-0 mt-2';

            panelHtml.innerHTML = `
                <div class="flex items-center gap-2 px-1.5 py-1 rounded-lg h-8 min-w-0 text-n-slate-11 hover:bg-n-alpha-2 cursor-pointer transition-colors" id="acid-addr-header">
                    <div class="relative flex items-center gap-2">
                        <span style="font-size: 0.9vw; color: #b3e600; opacity: 0.8;">🌍</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-grow min-w-0 flex-1">
                        <span class="truncate text-body-main font-medium text-sm">Биллинг Адреса</span>
                    </div>
                    <span class="i-lucide-chevron-down size-3 transition-transform" id="acid-addr-icon"></span>
                </div>
                <ul id="acid-addr-body" class="grid m-0 list-none min-w-0 p-2 gap-2 rounded-lg mt-1" style="display: none; background: rgba(255, 255, 255, 0.03); border: 0.1vw solid rgba(255, 255, 255, 0.05);">
                    <select id="acid-addr-country" style="background: rgba(0,0,0,0.2); color: #cbd5e1; border: 0.1vw solid rgba(255,255,255,0.08); border-radius: 0.4vw; padding: 0.6vh 0.4vw; outline: none; font-size: 0.8vw; font-family: inherit; cursor: pointer;">
                        <option value="SG">Singapore</option>
                    </select>
                    <div style="font-family: inherit; font-size: 0.75vw; display: flex; flex-direction: column; gap: 0.8vh; padding: 0.5vh 0;" id="acid-addr-data">
                        <span style="color: #64748b;">Загрузка базы...</span>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <button id="acid-addr-reroll" style="flex: 1; background: rgba(255,255,255,0.05); border: 0.1vw solid transparent; color: #cbd5e1; border-radius: 0.4vw; padding: 0.6vh; font-size: 0.75vw; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Реролл</button>
                        <button id="acid-addr-copy" style="flex: 1; background: transparent; border: 0.1vw solid #b3e600; color: #b3e600; border-radius: 0.4vw; padding: 0.6vh; font-size: 0.75vw; font-weight: 500; transition: 0.2s;" onmouseover="this.style.background='#b3e600'; this.style.color='#111827';" onmouseout="this.style.background='transparent'; this.style.color='#b3e600';">Скопировать</button>
                    </div>
                </ul>
            `;
            navList.appendChild(panelHtml);

            const header = document.getElementById('acid-addr-header');
            const body = document.getElementById('acid-addr-body');
            const icon = document.getElementById('acid-addr-icon');

            header.addEventListener('click', () => {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? 'grid' : 'none';
                icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                if (isHidden && !this.currentAddress) this.fetchAndRollAddress('SG');
            });

            document.getElementById('acid-addr-country').addEventListener('change', (e) => this.fetchAndRollAddress(e.target.value));
            document.getElementById('acid-addr-reroll').addEventListener('click', () => {
                const code = document.getElementById('acid-addr-country').value;
                this.fetchAndRollAddress(code, true);
            });
            document.getElementById('acid-addr-copy').addEventListener('click', () => this.copyAddressToClipboard());
        }

        async fetchAndRollAddress(countryCode, forceReroll = false) {
            const dataBox = document.getElementById('acid-addr-data');
            const cacheKey = `acid_addresses_${countryCode}`;
            const cachedData = JSON.parse(localStorage.getItem(cacheKey));
            const now = Date.now();
            let houses = [];

            if (cachedData && (now - cachedData.timestamp < 3 * 60 * 60 * 1000)) {
                houses = cachedData.houses;
            } else {
                dataBox.innerHTML = '<span style="color: #64748b;">Загрузка с Overpass API...</span>';
                document.getElementById('acid-addr-reroll').disabled = true;

                const region = this.addressRegions[countryCode];
                const query = `[out:json][timeout:25];(node["addr:housenumber"]["addr:street"](${region.bbox});way["addr:housenumber"]["addr:street"](${region.bbox}););out center 1500;`;

                try {
                    const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query));
                    const data = await res.json();
                    houses = data.elements.map(el => {
                        const tags = el.tags || {};
                        return {
                            street: `${tags['addr:housenumber'] || ''} ${tags['addr:street'] || ''}`.trim(),
                            city: tags['addr:city'] || tags['addr:suburb'] || tags['addr:neighbourhood'] || region.defaultCity,
                            zip: tags['addr:postcode'] || ''
                        };
                    });

                    localStorage.setItem(cacheKey, JSON.stringify({
                        timestamp: now,
                        houses: houses
                    }));
                } catch (e) {
                    dataBox.innerHTML = '<span style="color: #ef4444;">Ошибка API</span>';
                    document.getElementById('acid-addr-reroll').disabled = false;
                    return;
                }
            }

            document.getElementById('acid-addr-reroll').disabled = false;

            let validHouse = null;
            let attempts = 0;
            while (!validHouse && attempts < 50) {
                const random = houses[Math.floor(Math.random() * houses.length)];
                if (random && random.street.length > 3 && random.zip && random.zip !== '00000' && !random.street.includes('#')) {
                    validHouse = random;
                }
                attempts++;
            }

            if (!validHouse) {
                dataBox.innerHTML = '<span style="color: #ef4444;">Нет полных адресов.</span>';
                return;
            }

            const r = this.addressRegions[countryCode];
            const fullName = `${r.names[Math.floor(Math.random() * r.names.length)]} ${r.surnames[Math.floor(Math.random() * r.surnames.length)]}`;

            this.currentAddress = {
                fullname: fullName,
                street: validHouse.street,
                city: validHouse.city,
                zip: validHouse.zip,
                country: r.name
            };

            dataBox.innerHTML = `
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Имя:</span> <span style="color:#e2e8f0; text-align: right;">${this.currentAddress.fullname}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Улица:</span> <span style="color:#e2e8f0; text-align: right;">${this.currentAddress.street}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Город:</span> <span style="color:#e2e8f0; text-align: right;">${this.currentAddress.city}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Индекс:</span> <span style="color:#e2e8f0; text-align: right;">${this.currentAddress.zip}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Страна:</span> <span style="color:#e2e8f0; text-align: right;">${this.currentAddress.country}</span></div>
            `;
        }

        copyAddressToClipboard() {
            if (!this.currentAddress) return;
            const a = this.currentAddress;
            const text = `Имя и фамилия: ${a.fullname}\nУлица: ${a.street}\nИндекс: ${a.zip}\nСтрана/Город: ${a.country}`;

            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('acid-addr-copy');
                btn.textContent = 'Успешно!';
                btn.style.background = '#b3e600';
                btn.style.color = '#111827';
                setTimeout(() => {
                    btn.textContent = 'Скопировать';
                    btn.style.background = 'transparent';
                    btn.style.color = '#b3e600';
                }, 1500);
            });
        }

        setupNetworkHooks() {
            const targetWin = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const originalXhrSend = targetWin.XMLHttpRequest.prototype.send;
            const self = this;

            targetWin.XMLHttpRequest.prototype.send = function (...args) {
                this.addEventListener('load', function () {
                    if (this.responseURL && this.responseURL.includes('update_last_seen')) {
                        try {
                            self.currentChatData = JSON.parse(this.responseText);
                            self.renderHeaderUI();
                        } catch (e) {}
                    }
                });
                return originalXhrSend.apply(this, args);
            };
        }

        formatMSK(timestamp) {
            if (!timestamp || timestamp === 0) return '<span style="color: #ef4444; font-weight: 600;">0</span>';
            const nowSec = Math.floor(Date.now() / 1000);
            const isOld = (nowSec - timestamp) > 28800;
            const date = new Date(timestamp * 1000);
            if (isOld) {
                return date.toLocaleString('ru-RU', {
                    timeZone: 'Europe/Moscow',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } else {
                return date.toLocaleTimeString('ru-RU', {
                    timeZone: 'Europe/Moscow',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }

        getResponseTimer(created, firstReply) {
            if (!firstReply || firstReply === 0) return '<span style="color: #ef4444; font-weight: 600;">Нет ответа</span>';
            const diff = firstReply - created;
            if (diff < 0) return '<span style="color: #ef4444;">Ошибка</span>';
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            let color = '#ef4444';
            if (diff <= 300) color = '#22c55e';
            else if (diff <= 900) color = '#eab308';
            let timeStr = hours > 0 ? `${hours}ч ` : '';
            timeStr += `${minutes}м ${seconds}с`;
            return `<span style="color: ${color}; font-weight: 600;">${timeStr}</span>`;
        }

        renderHeaderUI() {
            if (!this.settings.customHeader) {
                const existingPanel = document.getElementById('custom-chatwoot-header-block');
                if (existingPanel) existingPanel.remove();
                return;
            }

            const data = this.currentChatData;
            if (!data) return;

            const urlMatch = window.location.pathname.match(/\/conversations\/(\d+)/);
            const currentChatId = urlMatch ? parseInt(urlMatch[1], 10) : null;
            if (!currentChatId || data.id !== currentChatId) return;

            const targetHeader = document.querySelector('.conversation--header--actions') ?.closest('.flex.items-center.justify-start');
            if (!targetHeader) return;

            let panel = document.getElementById('custom-chatwoot-header-block');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'custom-chatwoot-header-block';
                panel.style.cssText = `
                    display: flex; flex-direction: row; justify-content: space-between; align-items: center;
                    flex: 1; margin-left: 2vw; padding: 0.5vh 1vw; background-color: transparent; border: none;
                    font-family: inherit; font-size: 0.8vw; font-weight: 500; color: #e2e8f0;
                    white-space: nowrap; overflow: hidden;
                `;
                targetHeader.appendChild(panel);
            }

            // Генерируем уникальный слепок текущего состояния тикета
            const stateHash = `${data.id}_${data.last_activity_at}_${data.first_reply_created_at}`;

            // Защита от бесконечного цикла MutationObserver: обновляем DOM только если данные изменились
            if (panel.dataset.stateHash === stateHash) return;

            const customAttrs = (data.meta && data.meta.sender && data.meta.sender.custom_attributes) || {};

            panel.innerHTML = `
                <div style="display: flex; gap: 1.5vw;">
                    <span title="Создан">📩 ${this.formatMSK(data.created_at)}</span>
                    <span title="Первый ответ">📤 ${this.formatMSK(data.first_reply_created_at)}</span>
                    <span title="Время ответа">⌛ ${this.getResponseTimer(data.created_at, data.first_reply_created_at)}</span>
                    <span title="Активность">👁️‍🗨️ ${this.formatMSK(data.last_activity_at)}</span>
                </div>
                <div style="display: flex; gap: 1.5vw; color: #22c55e;">
                    <span title="Zarub ID">ID: <span style="color: #fff;">${customAttrs.zarub_id || '<span style="color: #ef4444;">0</span>'}</span></span>
                    <span title="Карт">💳 <span style="color: #fff;">${customAttrs.cards_count || '<span style="color: #ef4444;">0</span>'}</span></span>
                    <span title="Депозит за всё время">💸 <span style="color: #fff;">${customAttrs.total_deposit_usd || '<span style="color: #ef4444;">0</span>'}</span></span>
                </div>
            `;

            panel.dataset.stateHash = stateHash;
        }

        setupObservers() {
            this.observers.menu = new MutationObserver(() => {
                this.featureMenuInjector();
                this.featureAddressPanel();
                this.renderHeaderUI();
            });
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
    app.initNetwork();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => app.initDOM());
    } else {
        app.initDOM();
    }

})();