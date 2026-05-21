// ==UserScript==
// @name         ACID CW PERKS
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  CWP ACID perks
// @author       Denmar
// @license      MIT
// @match        *://chatwoot.echelon.su/*
// @match        *://echelon.su/api/dashboard/*
// @updateURL    https://openuserjs.org/meta/Denmar/ACID_CW_PERKS.meta.js
// @downloadURL  https://openuserjs.org/install/Denmar/ACID_CW_PERKS.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    setInterval(() => {
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
    }, 500);
})();