// ==UserScript==
// @name         ACID CW PERKS
// @namespace    http://tampermonkey.net/
// @version      3.88
// @description  CWP ACID perks with OOP, Settings and Ticket Tracker1
// @author       Denmar
// @license      MIT
// @match        *://cw.echelon.su/*
// @match        *://cw2.echelon.su/*
// @match        *://echelon.su/api/dashboard/*
// @match        *://adm2.echelon.su/*
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

    // Айфрейм "Рабочая панель" (adm2.echelon.su) — отдельный документ, чужой origin,
    // поэтому это не метод AcidPerks, а самостоятельный скрипт, выполняющийся прямо внутри
    // самого iframe. Chatwoot не пересоздаёт iframe при переключении вкладок "Сообщения" /
    // "Рабочая панель", а только показывает/прячет его через CSS — значит наблюдатель,
    // однажды запущенный при загрузке iframe, сам ловит все дальнейшие обновления данных
    // (новые строки логов и т.п.) без необходимости отдельно слушать клик по кнопке.
    function initDashboardMskConverter() {
        const TIME_RE = /^([0-2]\d):([0-5]\d):([0-5]\d)$/;
        const MSK_OFFSET_HOURS = 3;

        function convertSpan(span) {
            const m = TIME_RE.exec(span.textContent.trim());
            if (!m) return;
            const hh = String((parseInt(m[1], 10) + MSK_OFFSET_HOURS) % 24).padStart(2, '0');

            span.dataset.acidMskDone = '1';
            span.style.display = 'inline-flex';
            span.style.flexDirection = 'column';
            span.style.lineHeight = '1.15';
            span.textContent = '';

            const line1 = document.createElement('span');
            line1.textContent = `${hh}:${m[2]}:${m[3]}`;

            const line2 = document.createElement('span');
            line2.textContent = 'мск';
            line2.style.fontSize = '1em';
            line2.style.opacity = '0.55';

            span.appendChild(line1);
            span.appendChild(line2);
        }

        function scan(root) {
            const scope = root || document;
            const candidates = scope.matches && scope.matches('span') ? [scope] : [];
            candidates.push(...scope.querySelectorAll('span'));
            candidates.forEach(span => {
                if (span.children.length > 0) return;
                if (span.closest('[data-acid-msk-done]')) return;
                convertSpan(span);
            });
        }

        const start = () => {
            scan();
            new MutationObserver(mutations => {
                for (const mut of mutations) {
                    mut.addedNodes.forEach(node => {
                        if (node.nodeType === 1) scan(node);
                    });
                }
            }).observe(document.body, {
                childList: true,
                subtree: true
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    }

    // Настройки хранятся через GM_setValue/GM_getValue, а не localStorage: последний
    // изолирован по origin, и adm2.echelon.su (другой домен, где живёт iframe) не увидел бы
    // localStorage, записанный на cw.echelon.su. GM-хранилище общее для всего скрипта.
    function loadSharedSettings(defaults) {
        let parsed = {};
        try {
            parsed = JSON.parse(GM_getValue('acidSettings', '{}'));
        } catch (e) {}
        return {
            ...defaults,
            ...parsed
        };
    }

    if (location.hostname === 'adm2.echelon.su') {
        const settings = loadSharedSettings({
            mskConverter: true
        });
        if (settings.mskConverter) initDashboardMskConverter();
        return;
    }

    class AcidPerks {
        constructor() {
            this.defaultSettings = {
                ticketTracker: true,
                addressPanel: true,
                customHeader: true,
                rightPanelStyle: true,
                mskConverter: true,
                customValue: ''
            };
            this.settings = this.loadSettings();
            this.intervals = {};
            this.observers = {};

            this.currentChatData = null;

            // Гео-данные (bbox, город, размер пула) больше не нужны на клиенте — этим занимается
            // сервер (server/common.php + server/update.php). Здесь остаётся только то, что нужно
            // самому UI: подпись/флаг/поиск по алиасам и генерация имени по региону.
            this.addressRegions = {
                "SG": {
                    name: "Singapore",
                    label: "Сингапур",
                    flag: "🇸🇬",
                    favorite: true,
                    aliases: ["singapore", "sg", "сингапур"],
                    names: ["Wei", "Jian", "Sarah", "Michael", "Chloe", "David", "Xin", "Lucas", "Emma", "Jun", "Ming", "Li", "Yan", "Hong", "Feng", "Ryan", "Rachel", "Ethan", "Grace", "Noah", "Olivia", "Matthew", "Sophia", "Benjamin", "Isabella", "Ahmad", "Siti", "Priya", "Arjun", "Wen", "Kai", "Jing", "Heai", "Xuan", "Zhi", "Yong", "Hwee", "Choon", "Wan", "Hafiz", "Aisyah", "Nur", "Farah", "Zulkifli", "Rashid", "Kumar", "Raj", "Meera", "Deepa", "Karthik", "Vikram", "Anand", "James", "Daniel", "Nicole", "Amanda", "Jasmine"],
                    surnames: ["Tan", "Lim", "Lee", "Ng", "Ong", "Wong", "Goh", "Chua", "Chan", "Koh", "Teo", "Yeo", "Loh", "Sim", "Wee", "Foo", "Yap", "Heng", "Low", "Chew", "Pang", "Seet", "Kee", "Ho", "Liang", "Phua", "Tay", "Yip", "Lam", "Kwan", "Neo", "Toh", "Poh", "Boon", "Soh", "Ang", "Cheong", "Quek", "Aw", "Ling"]
                },
                "HK": {
                    name: "Hong Kong",
                    label: "Гонконг",
                    flag: "🇭🇰",
                    favorite: true,
                    aliases: ["hongkong", "hong kong", "hk", "гонконг"],
                    names: ["Chun", "Wing", "Hei", "Ka Ho", "Tsz", "Yan", "Ka Yee", "Hoi", "Man", "Lok", "Sze", "Yee", "Cheuk", "Ho Yin", "Ching", "Ka Wai", "Wai Lam", "Tsz Ching", "Yat Long", "Ming"],
                    surnames: ["Chan", "Wong", "Lee", "Cheung", "Ng", "Lau", "Ho", "Wu", "Chow", "Leung", "Kwok", "Tang", "Yip", "Ma", "Yeung", "Fung", "Kwan", "Lam", "Tsang", "Choi"]
                },
                "DE": {
                    name: "Germany",
                    label: "Германия",
                    flag: "🇩🇪",
                    favorite: true,
                    aliases: ["germany", "de", "берлин", "berlin", "deutschland"],
                    names: ["Lukas", "Finn", "Maximilian", "Paul", "Leon", "Jonas", "Felix", "Anna", "Mia", "Emma", "Hannah", "Lena", "Sophie", "Laura", "Ben", "Elias", "Marie", "Julia", "Niklas", "Sarah"],
                    surnames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hartmann"]
                },
                "US": {
                    name: "United States",
                    label: "США",
                    flag: "🇺🇸",
                    favorite: true,
                    needsState: true,
                    aliases: ["usa", "us", "america", "сша", "америка", "нью-йорк", "new york", "штаты"],
                    names: ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Emma", "Olivia", "Ava", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia", "Ethan", "Noah", "Liam", "Grace"],
                    surnames: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "White"]
                },
                "FR": {
                    name: "France",
                    label: "Франция",
                    flag: "🇫🇷",
                    aliases: ["france", "fr", "франция", "париж", "paris"],
                    names: ["Léo", "Louis", "Gabriel", "Jules", "Hugo", "Arthur", "Nathan", "Emma", "Louise", "Chloé", "Camille", "Manon", "Léa", "Inès", "Lucas", "Adam", "Alice", "Jade", "Lina", "Sarah"],
                    surnames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "Roux", "Vincent", "Fournier", "Girard", "Bonnet", "Morel"]
                },
                "NL": {
                    name: "Netherlands",
                    label: "Нидерланды",
                    flag: "🇳🇱",
                    aliases: ["netherlands", "holland", "nl", "нидерланды", "голландия", "амстердам", "amsterdam"],
                    names: ["Daan", "Sem", "Milan", "Levi", "Luuk", "Finn", "Julia", "Emma", "Sophie", "Tess", "Sara", "Anna", "Lotte", "Fleur", "Bram", "Noah", "Sanne", "Eva", "Roos", "Mila"],
                    surnames: ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit"]
                },
                "GB": {
                    name: "United Kingdom",
                    label: "Великобритания",
                    flag: "🇬🇧",
                    aliases: ["uk", "britain", "england", "gb", "великобритания", "англия", "лондон", "london"],
                    names: ["Oliver", "George", "Harry", "Jack", "Charlie", "Jacob", "Freddie", "Olivia", "Amelia", "Isla", "Ava", "Emily", "Sophie", "Grace", "Thomas", "Alfie", "Lily", "Ella", "Poppy", "Jessica"],
                    surnames: ["Smith", "Jones", "Taylor", "Williams", "Brown", "Davies", "Evans", "Wilson", "Thomas", "Roberts", "Johnson", "Walker", "Wright", "Robinson", "Hughes", "Green", "Hall", "Clarke", "Patel", "Baker"]
                },
                "CA": {
                    name: "Canada",
                    label: "Канада",
                    flag: "🇨🇦",
                    needsState: true,
                    aliases: ["canada", "ca", "канада", "торонто", "toronto"],
                    names: ["Liam", "Noah", "William", "Benjamin", "Owen", "Jack", "Emma", "Olivia", "Charlotte", "Amelia", "Ava", "Sophia", "Isabella", "Mia", "Lucas", "Ethan", "Chloe", "Zoe", "Nathan", "Ryan"],
                    surnames: ["Smith", "Brown", "Tremblay", "Martin", "Roy", "Wilson", "MacDonald", "Gagnon", "Taylor", "Campbell", "Anderson", "Morin", "Clark", "Lee", "Cote", "Bouchard", "Bergeron", "Fortin", "Levesque", "Gauthier"]
                },
                "JP": {
                    name: "Japan",
                    label: "Япония",
                    flag: "🇯🇵",
                    aliases: ["japan", "jp", "япония", "токио", "tokyo"],
                    names: ["Haruto", "Yuto", "Sota", "Riku", "Ren", "Yui", "Aoi", "Hina", "Sakura", "Yuna", "Rin", "Mio", "Kaito", "Sora", "Yuki", "Hana", "Sota", "Ayaka", "Kenta", "Nao"],
                    surnames: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu", "Saito", "Yamaguchi"]
                },
                "CH": {
                    name: "Switzerland",
                    label: "Швейцария",
                    flag: "🇨🇭",
                    aliases: ["switzerland", "ch", "швейцария", "цюрих", "zurich"],
                    names: ["Noah", "Liam", "Elias", "Matteo", "Luca", "Julien", "Mia", "Emma", "Lena", "Elena", "Sofia", "Lina", "Nora", "Alina", "Leon", "David", "Laura", "Nina", "Simon", "Anna"],
                    surnames: ["Müller", "Meier", "Schmid", "Keller", "Weber", "Huber", "Schneider", "Meyer", "Steiner", "Fischer", "Gerber", "Brunner", "Baumann", "Frei", "Widmer", "Zimmermann", "Moser", "Graf", "Roth", "Suter"]
                },
                "ES": {
                    name: "Spain",
                    label: "Испания",
                    flag: "🇪🇸",
                    aliases: ["spain", "es", "испания", "мадрид", "madrid"],
                    names: ["Hugo", "Martín", "Lucas", "Mateo", "Leo", "Daniel", "Lucía", "Sofía", "Martina", "María", "Paula", "Julia", "Valeria", "Emma", "Pablo", "Alejandro", "Carla", "Sara", "Diego", "Marcos"],
                    surnames: ["García", "Martínez", "López", "Sánchez", "Pérez", "González", "Rodríguez", "Fernández", "Gómez", "Díaz", "Moreno", "Álvarez", "Romero", "Navarro", "Torres", "Ramírez", "Ruiz", "Gil", "Serrano", "Blanco"]
                },
                "IT": {
                    name: "Italy",
                    label: "Италия",
                    flag: "🇮🇹",
                    aliases: ["italy", "it", "италия", "рим", "rome"],
                    names: ["Leonardo", "Francesco", "Alessandro", "Lorenzo", "Mattia", "Tommaso", "Sofia", "Giulia", "Aurora", "Alice", "Ginevra", "Emma", "Giorgia", "Beatrice", "Andrea", "Marco", "Chiara", "Elena", "Matteo", "Elisa"],
                    surnames: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano", "Mancini", "Rizzo", "Lombardi", "Moretti"]
                },
                "SE": {
                    name: "Sweden",
                    label: "Швеция",
                    flag: "🇸🇪",
                    aliases: ["sweden", "se", "швеция", "стокгольм", "stockholm"],
                    names: ["Lucas", "William", "Liam", "Oscar", "Hugo", "Elias", "Alice", "Maja", "Ella", "Wilma", "Alma", "Ebba", "Freja", "Stella", "Axel", "Erik", "Astrid", "Ines", "Leo", "Alva"],
                    surnames: ["Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson", "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Lindberg", "Berg", "Lindqvist", "Lindgren", "Olofsson"]
                },
                "AU": {
                    name: "Australia",
                    label: "Австралия",
                    flag: "🇦🇺",
                    needsState: true,
                    aliases: ["australia", "au", "австралия", "сидней", "sydney"],
                    names: ["Oliver", "Jack", "William", "Noah", "Thomas", "James", "Charlotte", "Olivia", "Amelia", "Isla", "Mia", "Grace", "Ava", "Ruby", "Lucas", "Henry", "Chloe", "Ella", "Cooper", "Zoe"],
                    surnames: ["Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson", "Thompson", "Nguyen", "Ryan", "Kelly", "King", "Baker", "Harris", "Young", "Walker", "Robinson"]
                },
                "PL": {
                    name: "Poland",
                    label: "Польша",
                    flag: "🇵🇱",
                    aliases: ["poland", "pl", "польша", "варшава", "warsaw"],
                    names: ["Jakub", "Antoni", "Jan", "Aleksander", "Franciszek", "Filip", "Zuzanna", "Julia", "Zofia", "Maja", "Hanna", "Amelia", "Lena", "Alicja", "Szymon", "Kacper", "Wiktoria", "Oliwia", "Marcel", "Nikola"],
                    surnames: ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Krawczyk", "Piotrowski", "Grabowski", "Nowakowski", "Pawłowski", "Michalski"]
                },
                "AE": {
                    name: "United Arab Emirates",
                    label: "ОАЭ",
                    flag: "🇦🇪",
                    aliases: ["uae", "dubai", "оаэ", "дубай", "эмираты"],
                    names: ["Mohammed", "Ahmed", "Ali", "Omar", "Khalid", "Hassan", "Fatima", "Aisha", "Maryam", "Sara", "Noora", "Layla", "Huda", "Amal", "Yousef", "Saeed", "Mariam", "Salem", "Rashid", "Alia"],
                    surnames: ["Al Maktoum", "Al Falasi", "Al Suwaidi", "Al Marri", "Al Shamsi", "Al Zaabi", "Al Ketbi", "Al Hashimi", "Al Qassimi", "Al Mansoori", "Al Ali", "Al Zarooni", "Al Mazrouei", "Al Nuaimi", "Al Blooshi"]
                },
                "TR": {
                    name: "Turkey",
                    label: "Турция",
                    flag: "🇹🇷",
                    aliases: ["turkey", "tr", "турция", "стамбул", "istanbul"],
                    names: ["Ahmet", "Mehmet", "Mustafa", "Yusuf", "Emre", "Burak", "Ayşe", "Fatma", "Zeynep", "Elif", "Merve", "Esra", "Deniz", "Ece", "Kerem", "Baran", "Selin", "Buse", "Cem", "Aylin"],
                    surnames: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek"]
                }
            };
            // База адресного сервера (см. server/ в репозитории). Меняй только тут, если переносишь хостинг.
            this.ADDRESS_SERVER_BASE = "https://gammahub.tech/acid";
            this.currentAddress = null;
            this.selectedRegionCode = "SG";
            this.prefetchStarted = false;

            // Кеш свежих данных из API списка тикетов (fetch-перехват), используется
            // ticket tracker'ом вместо грубого DOM-текста "14m", когда данные ещё не устарели.
            this.conversationsCache = new Map();
            this.conversationsCacheTTL = 3 * 60 * 1000;
        }

        // Запуск до загрузки страницы
        initNetwork() {
            this.setupNetworkHooks();
        }

        // Запуск после рендера DOM
        initDOM() {
            this.injectStyles();
            this.applyRightPanelClass();
            this.setupObservers();
            this.startIntervalTasks();
            this.runOnLoadTasks();
        }

        loadSettings() {
            return loadSharedSettings(this.defaultSettings);
        }

        saveSettings(newSettings) {
            this.settings = newSettings;
            GM_setValue('acidSettings', JSON.stringify(this.settings));
            this.applyRightPanelClass();
        }

        applyRightPanelClass() {
            document.documentElement.classList.toggle('acid-rp-style', !!this.settings.rightPanelStyle);
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

                /* === ACID: правая панель — только компоновка, цвета темы не трогаем === */

                /* панель уже: была 320-360px, делаем компактнее на десктопе (на мобильном drawer'е не трогаем) */
                @media (min-width: 768px) {
                    html.acid-rp-style .md\:static:has(.list-group) {
                        width: 280px !important;
                        min-width: 280px !important;
                    }
                }

                /* компактная сетка контактных данных (email/телефон/id/компания) вместо длинного столбца */
                html.acid-rp-style div.flex.flex-col.items-start.w-full.gap-2:has([title="Email"]) {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    column-gap: 0.7vw;
                    row-gap: 0.5vh;
                }

                /* агент + команда в одну строку, приоритет и категории на всю ширину под ними */
                html.acid-rp-style .list-group [inbox-id] {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    column-gap: 0.6vw;
                    align-items: start;
                }
                html.acid-rp-style .list-group [inbox-id] > .multiselect-wrap--small:nth-of-type(n+3),
                html.acid-rp-style .list-group [inbox-id] > .overflow-auto.py-0.px-0,
                html.acid-rp-style .list-group [inbox-id] > .sidebar-labels-wrap {
                    grid-column: 1 / -1;
                }

                /* плотнее вертикальный ритм между секциями и их заголовками */
                .list-group { display: flex; flex-direction: column; gap: 0.5vh; padding: 0 0.3vw; }
                .list-group .flex.flex-col.gap-3 { gap: 0.5vh; }
                .list-group .drag-handle { height: 2.4vh; padding-top: 0.35vh; padding-bottom: 0.35vh; }
                .list-group .drag-handle h5 { font-weight: 600; }

                /* лейблы-теги оборачиваются компактнее, без лишних внешних отступов */
                .label-wrap { row-gap: 0.35vh; }

                /* карточки прошлых диалогов — компактнее по высоте */
                .list-group .contact-conversation--list .conversation { padding-top: 0.2vh; padding-bottom: 0.2vh; }

                /* === ACID: панель биллинг-адресов — сжатие до иконки, когда левый рейл узкий,
                   и непрерывное масштабирование шрифта/отступов под фактическую ширину рейла
                   (через container query units) в развёрнутом состоянии === */
                #acid-address-panel {
                    container-type: inline-size;
                    --acid-fs-lg: clamp(0.7rem, 9cqw, 0.95rem);
                    --acid-fs-md: clamp(0.62rem, 7.5cqw, 0.85rem);
                    --acid-fs-sm: clamp(0.56rem, 6cqw, 0.72rem);
                    --acid-pad-h: clamp(0.35rem, 5cqw, 0.6rem);
                    --acid-radius: clamp(0.3rem, 3.5cqw, 0.5rem);
                    --acid-gap: clamp(0.2rem, 2.5cqw, 0.4rem);
                }
                #acid-address-panel .acid-compact-only { display: none; }
                #acid-address-panel .acid-wide-only { display: flex; }
                #acid-address-panel.acid-addr-compact .acid-wide-only { display: none !important; }
                #acid-address-panel.acid-addr-compact .acid-compact-only { display: flex !important; }
                #acid-addr-body { width: 100%; box-sizing: border-box; z-index: 99998; box-shadow: 0 1vh 3vh rgba(0, 0, 0, 0.5); }
                /* всплывающая (сжатая) панель вынесена в document.body — фиксированные размеры,
                   т.к. её ширина (240px) не связана с шириной узкого рейла-триггера */
                #acid-addr-body.acid-floating {
                    --acid-fs-lg: 0.85rem;
                    --acid-fs-md: 0.75rem;
                    --acid-fs-sm: 0.65rem;
                    --acid-pad-h: 0.5rem;
                    --acid-radius: 0.4rem;
                    --acid-gap: 0.35rem;
                    width: 240px;
                }
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

        featureTicketTracker() {
            if (!this.settings.ticketTracker) {
                document.querySelectorAll('.bg-prog, .bot-prog').forEach(el => el.remove());
                document.querySelectorAll('.conversation').forEach(conv => {
                    conv.classList.remove('t-client-wait', 't-client-expired', 't-agent-wait', 't-agent-expired');
                });
                document.querySelectorAll('.leading-6.h-6 span').forEach(span => {
                    span.style.color = '';
                });
                return;
            }

            const conversations = document.querySelectorAll('.conversation');
            for (const conv of conversations) {
                const timeContainer = conv.querySelector('.v-popper--has-tooltip span');
                const msgContainer = conv.querySelector('.leading-6.h-6');
                if (!timeContainer || !msgContainer) continue;

                const timeText = timeContainer.textContent;
                const isLocked = msgContainer.innerHTML.includes('M12 2a4 4 0 0 1 4 4v2h1.75');
                let isAgent = msgContainer.innerHTML.includes('M9.277 16.221');

                const nameEl = conv.querySelector('h4.conversation--user');
                const previewSpan = msgContainer.querySelector('span');
                let cached = null;
                if (nameEl && previewSpan) {
                    const fingerprint = nameEl.textContent.trim().toLowerCase() + '|' + this.normalizeFingerprintText(previewSpan.textContent);
                    const entry = this.conversationsCache.get(fingerprint);
                    if (entry && (Date.now() - entry.fetchedAt) < this.conversationsCacheTTL) {
                        cached = entry;
                    }
                }

                if (previewSpan) previewSpan.style.color = isLocked ? '#eab308' : '';

                const stateHash = timeText + '|' + isAgent + '|' + isLocked + '|' + (cached ? cached.lastActivityAt : '');
                if (conv.dataset.stateHash === stateHash) continue;
                conv.dataset.stateHash = stateHash;

                let elapsedSec;
                if (cached) {
                    isAgent = cached.isAgentMessage;
                    elapsedSec = Math.max(0, Math.floor(Date.now() / 1000) - cached.lastActivityAt);
                } else {
                    const parts = timeText.split('•').map(s => s.trim());
                    const lastActiveStr = parts.length > 1 ? parts[1] : parts[0];
                    elapsedSec = this.parseSeconds(lastActiveStr);
                }

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
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Стили правой панели</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.rightPanelStyle ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-rp-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.rightPanelStyle ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.rightPanelStyle ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-rp-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-rp" style="display: none;" ${this.settings.rightPanelStyle ? 'checked' : ''}>
                    </label>
                    <label style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-size: 0.9vw; color: #cbd5e1;">
                        <span>Конвертер времени МСК</span>
                        <div style="position: relative; width: 2.5vw; height: 1.2vw; background: ${this.settings.mskConverter ? '#b3e600' : 'rgba(255,255,255,0.1)'}; border-radius: 1vw; transition: 0.3s;" id="acid-t-msk-bg">
                            <div style="position: absolute; top: 0.15vw; left: ${this.settings.mskConverter ? '1.45vw' : '0.15vw'}; width: 0.9vw; height: 0.9vw; background: ${this.settings.mskConverter ? '#111827' : '#94a3b8'}; border-radius: 50%; transition: 0.3s;" id="acid-t-msk-dot"></div>
                        </div>
                        <input type="checkbox" id="acid-t-msk" style="display: none;" ${this.settings.mskConverter ? 'checked' : ''}>
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

            bindToggle('acid-t-tracker', 'acid-t-tracker-bg', 'acid-t-tracker-dot');
            bindToggle('acid-t-addr', 'acid-t-addr-bg', 'acid-t-addr-dot');
            bindToggle('acid-t-head', 'acid-t-head-bg', 'acid-t-head-dot');
            bindToggle('acid-t-rp', 'acid-t-rp-bg', 'acid-t-rp-dot');
            bindToggle('acid-t-msk', 'acid-t-msk-bg', 'acid-t-msk-dot');

            const closeModal = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 200);
            };

            document.getElementById('acid-close-btn').addEventListener('click', closeModal);

            document.getElementById('acid-save-btn').addEventListener('click', () => {
                this.saveSettings({
                    ticketTracker: document.getElementById('acid-t-tracker').checked,
                    addressPanel: document.getElementById('acid-t-addr').checked,
                    customHeader: document.getElementById('acid-t-head').checked,
                    rightPanelStyle: document.getElementById('acid-t-rp').checked,
                    mskConverter: document.getElementById('acid-t-msk').checked,
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
                <button type="button" id="acid-addr-compact-trigger" class="acid-compact-only flex items-center justify-center size-10 rounded-lg text-n-slate-11 hover:bg-n-alpha-2" title="Биллинг Адреса">
                    <span style="font-size: 1rem;">🌍</span>
                </button>
                <div class="acid-wide-only flex items-center gap-2 px-1.5 py-1 rounded-lg h-8 min-w-0 text-n-slate-11 hover:bg-n-alpha-2 cursor-pointer transition-colors" id="acid-addr-header">
                    <div class="relative flex items-center gap-2">
                        <span style="font-size: var(--acid-fs-lg); color: #b3e600; opacity: 0.8;">🌍</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-grow min-w-0 flex-1">
                        <span class="truncate text-body-main font-medium text-sm">Биллинг Адреса</span>
                    </div>
                    <span class="i-lucide-chevron-down size-3 transition-transform" id="acid-addr-icon"></span>
                </div>
                <ul id="acid-addr-body" class="grid m-0 list-none min-w-0 p-2 gap-2 rounded-lg mt-1" style="display: none; background: rgba(20,22,26,0.98); border: 1px solid rgba(255, 255, 255, 0.08);">
                    <div id="acid-addr-region-title" style="display: flex; align-items: center; justify-content: center; gap: var(--acid-gap); font-size: var(--acid-fs-lg); font-weight: 600; color: #e2e8f0; padding: 0.2vh 0;">
                        <span id="acid-addr-region-flag"></span>
                        <span id="acid-addr-region-name"></span>
                    </div>
                    <div id="acid-addr-country-wrap" style="position: relative;">
                        <button type="button" id="acid-addr-change-country-btn" style="width: 100%; box-sizing: border-box; background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--acid-radius); padding: 0.6vh var(--acid-pad-h); font-size: var(--acid-fs-md); font-family: inherit; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Изменить страну</button>
                        <div id="acid-addr-country-list" style="display: none; position: absolute; top: calc(100% + 0.3vh); left: 0; right: 0; z-index: 20; max-height: 22vh; overflow-y: auto; background: rgba(20,22,26,0.98); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--acid-radius); padding: 0.4vh; box-shadow: 0 1vh 2vh rgba(0,0,0,0.5);"></div>
                    </div>
                    <div id="acid-addr-inner-panel" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--acid-radius); padding: 0.6vh var(--acid-pad-h);">
                        <div style="font-family: inherit; font-size: var(--acid-fs-md); display: flex; flex-direction: column; gap: 0.8vh;" id="acid-addr-data">
                            <span style="color: #64748b;">Загрузка базы...</span>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-1">
                        <button id="acid-addr-reroll" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid transparent; color: #cbd5e1; border-radius: var(--acid-radius); padding: 0.6vh; font-size: var(--acid-fs-md); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">Реролл</button>
                        <button id="acid-addr-copy" style="flex: 1; background: transparent; border: 1px solid #b3e600; color: #b3e600; border-radius: var(--acid-radius); padding: 0.6vh; font-size: var(--acid-fs-md); font-weight: 500; transition: 0.2s;" onmouseover="this.style.background='#b3e600'; this.style.color='#111827';" onmouseout="this.style.background='transparent'; this.style.color='#b3e600';">Скопировать</button>
                    </div>
                </ul>
            `;
            navList.appendChild(panelHtml);

            const li = panelHtml;
            const header = document.getElementById('acid-addr-header');
            const compactTrigger = document.getElementById('acid-addr-compact-trigger');
            const body = document.getElementById('acid-addr-body');
            const icon = document.getElementById('acid-addr-icon');
            const changeCountryBtn = document.getElementById('acid-addr-change-country-btn');
            const countryList = document.getElementById('acid-addr-country-list');
            const countryWrap = document.getElementById('acid-addr-country-wrap');

            this.updateRegionTitle();

            const isBodyOpen = () => body.style.display !== 'none' && body.style.display !== '';

            const closeBody = () => {
                body.style.display = 'none';
                body.style.position = '';
                body.style.left = '';
                body.style.top = '';
                body.classList.remove('acid-floating');
                if (body.parentElement !== li) li.appendChild(body);
                icon.style.transform = 'rotate(0deg)';
                countryList.style.display = 'none';
            };

            const openBody = (floatingAnchor) => {
                if (floatingAnchor) {
                    // Всплывающую панель выносим прямо в document.body: сам li — контейнер
                    // container-query (нужен для масштабирования шрифта в развёрнутом режиме),
                    // а это неявно делает li containing block для position:fixed — если оставить
                    // body внутри, координаты из getBoundingClientRect() окажутся смещены.
                    document.body.appendChild(body);
                    body.classList.add('acid-floating');
                    const rect = floatingAnchor.getBoundingClientRect();
                    body.style.position = 'fixed';
                    body.style.left = `${rect.right + 8}px`;
                    body.style.top = `${rect.top}px`;
                } else {
                    if (body.parentElement !== li) li.appendChild(body);
                    body.classList.remove('acid-floating');
                    body.style.position = '';
                    body.style.left = '';
                    body.style.top = '';
                }
                body.style.display = 'grid';
                icon.style.transform = 'rotate(180deg)';
                if (!this.currentAddress) this.fetchAndRollAddress(this.selectedRegionCode);
            };

            header.addEventListener('click', () => isBodyOpen() ? closeBody() : openBody(null));
            compactTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                isBodyOpen() ? closeBody() : openBody(compactTrigger);
            });

            document.addEventListener('click', (e) => {
                if (!countryWrap.contains(e.target)) countryList.style.display = 'none';
                // body может быть вынесен в document.body (плавающий режим), поэтому проверяем
                // клик и по li, и отдельно по body — иначе клик по кнопкам внутри попапа сам же его закроет.
                if (li.classList.contains('acid-addr-compact') && !li.contains(e.target) && !body.contains(e.target)) {
                    closeBody();
                }
            });

            changeCountryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = countryList.style.display === 'none' || !countryList.style.display;
                if (isHidden) this.renderCountryList('');
                countryList.style.display = isHidden ? 'block' : 'none';
            });

            document.getElementById('acid-addr-reroll').addEventListener('click', () => {
                this.fetchAndRollAddress(this.selectedRegionCode);
            });
            document.getElementById('acid-addr-copy').addEventListener('click', () => this.copyAddressToClipboard());

            // Встроенный левый рейл Chatwoot можно сузить до иконок (Настройки внешнего вида ->
            // компактная навигация) — тогда наша панель тоже сворачивается в иконку и открывается
            // всплывающим окном, чтобы не вылезать за рамки узкого рейла. В развёрнутом состоянии
            // сам рейл может иметь разную ширину — растягиваем li на всю ширину рейла (родительский
            // ul обычно центрирует элементы по контенту, li иначе не подхватит реальную ширину),
            // чтобы cqw-переменные считались от актуальной ширины, а не от размера контента.
            const railEl = navList.closest('nav') || navList;
            const applyCompactState = () => {
                const wasCompact = li.classList.contains('acid-addr-compact');
                const isCompact = railEl.clientWidth > 0 && railEl.clientWidth < 90;
                li.classList.toggle('acid-addr-compact', isCompact);
                li.style.alignSelf = isCompact ? '' : 'stretch';
                if (isCompact !== wasCompact) closeBody();
            };
            applyCompactState();
            if (typeof ResizeObserver !== 'undefined') {
                new ResizeObserver(applyCompactState).observe(railEl);
            }
        }

        updateRegionTitle() {
            const region = this.addressRegions[this.selectedRegionCode];
            const flagEl = document.getElementById('acid-addr-region-flag');
            const nameEl = document.getElementById('acid-addr-region-name');
            if (flagEl) flagEl.textContent = region.flag || '🏳️';
            if (nameEl) nameEl.textContent = region.label;
        }

        renderCountryList(filter) {
            const listEl = document.getElementById('acid-addr-country-list');
            if (!listEl) return;
            const f = (filter || '').trim().toLowerCase();
            const entries = Object.entries(this.addressRegions);
            const matches = entries.filter(([code, r]) => {
                if (!f) return true;
                const hay = [r.name, r.label, code, ...(r.aliases || [])].join(' ').toLowerCase();
                return hay.includes(f);
            });
            const favorites = matches.filter(([, r]) => r.favorite);
            const others = matches.filter(([, r]) => !r.favorite).sort((a, b) => a[1].label.localeCompare(b[1].label, 'ru'));

            const renderItem = ([code, r]) => `
                <div class="acid-addr-country-item" data-code="${code}" style="display: flex; align-items: center; gap: var(--acid-gap); padding: 0.7vh var(--acid-pad-h); border-radius: var(--acid-radius); cursor: pointer; font-size: var(--acid-fs-md); color: #e2e8f0; transition: background 0.15s ease;">
                    <span>${r.flag || '🏳️'}</span>
                    <span style="flex: 1;">${r.label}</span>
                    ${r.favorite ? '<span style="color:#b3e600; font-size: var(--acid-fs-sm);">★</span>' : ''}
                </div>
            `;

            let html = '';
            if (favorites.length) {
                html += `<div style="padding: 0.3vh var(--acid-pad-h); font-size: var(--acid-fs-sm); color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Избранное</div>`;
                html += favorites.map(renderItem).join('');
            }
            if (others.length) {
                html += `<div style="padding: 0.3vh var(--acid-pad-h); font-size: var(--acid-fs-sm); color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">Другие регионы</div>`;
                html += others.map(renderItem).join('');
            }
            listEl.innerHTML = html || `<div style="padding: 1vh; font-size: var(--acid-fs-md); color: #64748b;">Ничего не найдено</div>`;

            listEl.querySelectorAll('.acid-addr-country-item').forEach(item => {
                item.addEventListener('mouseenter', () => item.style.background = 'rgba(179,230,0,0.1)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                item.addEventListener('click', () => this.selectRegion(item.dataset.code));
            });
        }

        selectRegion(code) {
            const region = this.addressRegions[code];
            if (!region) return;
            this.selectedRegionCode = code;
            this.updateRegionTitle();
            document.getElementById('acid-addr-country-list').style.display = 'none';
            this.fetchAndRollAddress(code);
        }

        pickRandom(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        // Оборачивает GM_xmlhttpRequest в промис. Используем GM_xmlhttpRequest, а не fetch(),
        // потому что адресный сервер живёт на своём домене (gammahub.tech), а не на cw.echelon.su —
        // GM_xmlhttpRequest у Tampermonkey игнорирует CORS, обычный fetch() тут бы просто упал.
        gmGetJson(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout: 15000,
                    onload: (res) => {
                        if (res.status < 200 || res.status >= 300) {
                            reject(new Error('Адресный сервер: HTTP ' + res.status));
                            return;
                        }
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch (e) {
                            reject(new Error('Адресный сервер вернул не-JSON'));
                        }
                    },
                    onerror: () => reject(new Error('Адресный сервер недоступен')),
                    ontimeout: () => reject(new Error('Адресный сервер: таймаут'))
                });
            });
        }

        regionCacheKey(code) {
            return `acid_addresses_v5_${code}`;
        }

        getRegionCache(code) {
            try {
                return JSON.parse(localStorage.getItem(this.regionCacheKey(code)) || 'null');
            } catch (e) {
                return null;
            }
        }

        saveRegionCache(code, cache) {
            localStorage.setItem(this.regionCacheKey(code), JSON.stringify(cache));
        }

        // Первичная выдача пачки адресов для региона (get_addresses.php) — избранные регионы
        // получают 40 адресов, базовые — 25 (решает сервер, см. server/common.php).
        async fetchAddressBatch(code) {
            const data = await this.gmGetJson(`${this.ADDRESS_SERVER_BASE}/get_addresses.php?region=${encodeURIComponent(code)}`);
            if (!data || !Array.isArray(data.houses) || data.houses.length === 0) {
                throw new Error('Сервер не вернул адреса для региона ' + code);
            }
            const cache = { houses: data.houses, used: [] };
            this.saveRegionCache(code, cache);
            return cache;
        }

        // Реролл пачки для одного региона (reroll.php) — вызывается только когда в
        // локал сторадж уже нет неиспробованных адресов для этого региона.
        async fetchRerollBatch(code) {
            const data = await this.gmGetJson(`${this.ADDRESS_SERVER_BASE}/reroll.php?region=${encodeURIComponent(code)}`);
            if (!data || !Array.isArray(data.houses) || data.houses.length === 0) {
                throw new Error('Сервер не вернул адреса для реролла региона ' + code);
            }
            const cache = { houses: data.houses, used: [] };
            this.saveRegionCache(code, cache);
            return cache;
        }

        // Возвращает рабочий кеш региона: из локал сторадж, если там ещё остались
        // неиспробованные адреса, иначе — новая пачка с сервера (первая загрузка или реролл).
        async ensureRegionCache(code) {
            const cached = this.getRegionCache(code);
            if (cached && cached.houses && cached.houses.length > 0 && cached.used.length < cached.houses.length) {
                return cached;
            }
            if (cached && cached.houses && cached.houses.length > 0) {
                return this.fetchRerollBatch(code);
            }
            return this.fetchAddressBatch(code);
        }

        // Прогревает кеш избранных регионов (SG/HK/DE/US), пока пользователь смотрит выбранную
        // страну, чтобы переключение на них уже не ждало сетевого запроса. Регионы, для которых
        // кеш уже есть (даже исчерпанный), не трогаем — реролл для них произойдёт по требованию.
        async prefetchRegions() {
            if (this.prefetchStarted) return;
            this.prefetchStarted = true;
            const codes = Object.keys(this.addressRegions).filter(c => c !== this.selectedRegionCode && this.addressRegions[c].favorite && !this.getRegionCache(c));
            for (const code of codes) {
                try {
                    await this.fetchAddressBatch(code);
                } catch (e) {}
            }
        }

        async fetchAndRollAddress(countryCode) {
            const dataBox = document.getElementById('acid-addr-data');
            const rerollBtn = document.getElementById('acid-addr-reroll');
            dataBox.innerHTML = '<span style="color: #64748b;">Загрузка...</span>';
            rerollBtn.disabled = true;

            try {
                const cache = await this.ensureRegionCache(countryCode);

                const usedSet = new Set(cache.used);
                const freeIndices = cache.houses.map((_, i) => i).filter(i => !usedSet.has(i));
                const pickPool = freeIndices.length > 0 ? freeIndices : cache.houses.map((_, i) => i);
                const idx = this.pickRandom(pickPool);
                const house = cache.houses[idx];

                if (!usedSet.has(idx)) {
                    usedSet.add(idx);
                    cache.used = Array.from(usedSet);
                    this.saveRegionCache(countryCode, cache);
                }

                const region = this.addressRegions[countryCode];
                const fullName = `${this.pickRandom(region.names)} ${this.pickRandom(region.surnames)}`;

                this.currentAddress = {
                    fullname: fullName,
                    street: house.street,
                    city: house.city,
                    zip: house.zip,
                    state: house.state,
                    needsState: !!region.needsState,
                    country: region.name
                };

                this.renderAddressData();

                if (countryCode === this.selectedRegionCode) this.prefetchRegions();
            } catch (e) {
                dataBox.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 0.4vh;">
                        <span style="color: #ef4444;">Ошибка API — сервис перегружен</span>
                        <button id="acid-addr-retry" style="background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: var(--acid-radius); padding: 0.3vh 0.6vh; font-size: var(--acid-fs-sm); cursor: pointer;">Повторить</button>
                    </div>
                `;
                const retryBtn = document.getElementById('acid-addr-retry');
                if (retryBtn) retryBtn.addEventListener('click', () => this.fetchAndRollAddress(countryCode));
            } finally {
                rerollBtn.disabled = false;
            }
        }

        renderAddressData() {
            const dataBox = document.getElementById('acid-addr-data');
            const a = this.currentAddress;
            dataBox.innerHTML = `
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Имя:</span> <span style="color:#e2e8f0; text-align: right;">${a.fullname}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Улица:</span> <span style="color:#e2e8f0; text-align: right;">${a.street}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Город:</span> <span style="color:#e2e8f0; text-align: right;">${a.city}</span></div>
                ${a.needsState ? `<div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Штат:</span> <span style="color:#e2e8f0; text-align: right;">${a.state || '-'}</span></div>` : ''}
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Индекс:</span> <span style="color:#e2e8f0; text-align: right;">${a.zip}</span></div>
                <div style="display: flex; justify-content: space-between;"><span style="color:#64748b;">Страна:</span> <span style="color:#e2e8f0; text-align: right;">${a.country}</span></div>
            `;
        }

        copyAddressToClipboard() {
            if (!this.currentAddress) return;
            const a = this.currentAddress;
            let text = `Имя и фамилия: ${a.fullname}\nУлица: ${a.street}\n`;
            if (a.needsState) text += `Штат: ${a.state || '-'}\n`;
            text += `Индекс: ${a.zip}\n`;
            text += (a.city && a.city !== a.country) ?
                `Город: ${a.city}\nСтрана: ${a.country}` :
                `Страна: ${a.country}`;

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
                    if (this.responseURL && this.responseURL.includes('/conversations') && this.responseURL.includes('assignee_type=')) {
                        try {
                            self.cacheConversationsPayload(JSON.parse(this.responseText));
                        } catch (e) {}
                    }
                });
                return originalXhrSend.apply(this, args);
            };

            const originalFetch = targetWin.fetch;
            if (originalFetch) {
                targetWin.fetch = function (input, init) {
                    const promise = originalFetch.apply(this, arguments);
                    try {
                        const url = typeof input === 'string' ? input : (input && input.url) || '';
                        if (url.includes('/conversations') && url.includes('assignee_type=')) {
                            promise.then(res => {
                                if (!res.ok) return;
                                res.clone().json().then(data => self.cacheConversationsPayload(data)).catch(() => {});
                            }).catch(() => {});
                        }
                    } catch (e) {}
                    return promise;
                };
            }
        }

        // Список тикетов приходит без "готового" DOM id, поэтому сопоставляем карточку
        // с записью из API по отпечатку "имя контакта + начало превью сообщения" —
        // этого достаточно, чтобы не зависеть от внутренней вёрстки Chatwoot.
        normalizeFingerprintText(s) {
            return (s || '').replace(/[\\\s]+/g, ' ').trim().toLowerCase().slice(0, 30);
        }

        cacheConversationsPayload(data) {
            const payload = data && data.data && data.data.payload;
            if (!Array.isArray(payload)) return;
            const now = Date.now();
            for (const conv of payload) {
                const senderName = (conv.meta && conv.meta.sender && conv.meta.sender.name) || '';
                const lastMsg = conv.last_non_activity_message;
                if (!senderName || !lastMsg) continue;
                const fingerprint = senderName.trim().toLowerCase() + '|' + this.normalizeFingerprintText(lastMsg.content);
                this.conversationsCache.set(fingerprint, {
                    fetchedAt: now,
                    lastActivityAt: conv.last_activity_at,
                    createdAt: conv.created_at,
                    isAgentMessage: lastMsg.sender_type === 'User'
                });
            }
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