// ==UserScript==
// @name         Traduction Machines Atelier4 Boss
// @namespace    atelier.traduction.machines
// @version      1.0
// @description  Traduit les codes machines (CUA1G -> 1/1G). Clic sur une traduction rouge : tous les codes de la page fusionnent en une machine géante à combattre.
// @match        *://*/*
// @match        file:///*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// NOTE : remplace la ligne @match ci-dessus par l'adresse de ton site de travail
// et recopie ta liste d'exclusions d'URL dans EXCLURE_URLS (comme dans les autres scripts).

(function () {
    'use strict';

    const NOM = '[Traduction Machines Atelier4 Boss]';
    const EXCLURE_URLS = []; // ex : ['/admin', 'exemple.com/pagesensible']
    const DEBUG = true; // badge de contrôle en bas à gauche de la page : passe à false quand tout fonctionne

    for (let i = 0; i < EXCLURE_URLS.length; i++) {
        if (location.href.indexOf(EXCLURE_URLS[i]) !== -1) return;
    }
    if (window.__tm4Boss) return;
    window.__tm4Boss = true;

    const TAU = Math.PI * 2;
    const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const CLASSE = 'tm4-trad';
    const REGEX_CODE = /CU[A-Z][1-9][GD]/;
    let jeuActif = false;
    let ac = null; // contexte audio partagé

    // =====================================================
    // TRADUCTION DES CODES
    // =====================================================

    function traduire(code) {
        const m = /^CU([A-Z])([1-9])([GD])$/.exec(code);
        if (!m) return null;
        return (LETTRES.indexOf(m[1]) + 1) + '/' + m[2] + m[3];
    }

    function estNotre(node) {
        return node && node.nodeType === 1 && node.classList && node.classList.contains(CLASSE);
    }

    function creerSpan(code) {
        const s = document.createElement('span');
        s.className = CLASSE;
        s.setAttribute('data-code', code);
        s.textContent = traduire(code);
        s.style.cssText = 'color:#e53935;font-weight:700;margin-left:4px;cursor:pointer;';
        s.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            lancerBoss();
        });
        return s;
    }

    function traiterTextNode(node) {
        if (!node || !node.parentNode) return;
        const parent = node.parentNode;
        if (parent.nodeType === 1) {
            if (parent.classList.contains(CLASSE)) return;
            const tag = parent.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT' || tag === 'INPUT' || tag === 'CANVAS') return;
            if (parent.isContentEditable) return;
            if (parent.closest && parent.closest('#tm4-overlay')) return;
        }
        const texte = node.nodeValue;
        if (!texte) return;
        const m = REGEX_CODE.exec(texte);
        if (!m) return;

        const code = m[0];
        const debut = m.index;
        const fin = debut + code.length;

        // isole le code dans son propre noeud texte
        let noeudCode = node;
        let reste = null;
        if (fin < texte.length) reste = node.splitText(fin);
        if (debut > 0) noeudCode = node.splitText(debut);

        const suivant = noeudCode.nextSibling;
        if (suivant && estNotre(suivant) && suivant.getAttribute('data-code') === code) {
            // déjà traduit
        } else {
            if (suivant && estNotre(suivant)) suivant.remove(); // traduction périmée
            parent.insertBefore(creerSpan(code), noeudCode.nextSibling);
        }
        if (reste) traiterTextNode(reste);
    }

    function nettoyerOrphelins() {
        document.querySelectorAll('.' + CLASSE).forEach(function (s) {
            const p = s.previousSibling;
            if (!p || p.nodeType !== 3 || p.nodeValue !== s.getAttribute('data-code')) s.remove();
        });
    }

    function scanner() {
        if (!document.body) return;
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        const noeuds = [];
        let n;
        while ((n = w.nextNode())) {
            if (n.nodeValue && n.nodeValue.indexOf('CU') !== -1) noeuds.push(n);
        }
        noeuds.forEach(traiterTextNode);
    }

    let badge = null;
    function majBadge() {
        if (!DEBUG || !document.body) return;
        if (!badge || !badge.parentNode) {
            badge = document.createElement('div');
            badge.id = 'tm4-badge';
            badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483646;background:rgba(0,0,0,.75);color:#fff;font:12px Consolas,monospace;padding:4px 8px;border-radius:6px;pointer-events:none;';
            document.body.appendChild(badge);
        }
        const n = document.querySelectorAll('.' + CLASSE).length;
        const txt = 'Atelier4 actif (' + (window === window.top ? 'page' : 'cadre') + ') · ' + n + ' code(s) traduit(s)';
        if (badge.textContent !== txt) badge.textContent = txt;
    }

    function lancer() {
        if (jeuActif) return;
        nettoyerOrphelins();
        scanner();
        majBadge();
    }

    let planifie = false;
    function planifierScan() {
        if (planifie) return;
        planifie = true;
        setTimeout(function () {
            planifie = false;
            lancer();
        }, 150);
    }

    const observateur = new MutationObserver(function (muts) {
        if (jeuActif) return;
        let utile = false;
        for (let i = 0; i < muts.length; i++) {
            const m = muts[i];
            const cible = m.target;
            if (cible && (cible.id === 'tm4-badge' || (cible.parentNode && cible.parentNode.id === 'tm4-badge'))) continue;
            if (m.type === 'characterData') {
                // les widgets qui réutilisent un noeud : on retire la traduction périmée
                const n = m.target;
                const s = n.nextSibling;
                if (s && estNotre(s) && n.nodeValue !== s.getAttribute('data-code')) s.remove();
                utile = true;
            } else if (m.type === 'childList') {
                for (let j = 0; j < m.addedNodes.length; j++) {
                    if (!estNotre(m.addedNodes[j])) { utile = true; break; }
                }
            }
        }
        if (utile) planifierScan();
    });

    // =====================================================
    // OUTILS AUDIO / MATHS
    // =====================================================

    function audio() {
        if (!ac) {
            try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
        }
        if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
        return ac;
    }

    function bip(f1, f2, dur, type, vol) {
        const a = audio();
        if (!a) return;
        try {
            const o = a.createOscillator();
            const g = a.createGain();
            const t = a.currentTime;
            o.type = type || 'square';
            o.frequency.setValueAtTime(f1, t);
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
            g.gain.setValueAtTime(vol || 0.05, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g);
            g.connect(a.destination);
            o.start(t);
            o.stop(t + dur + 0.02);
        } catch (e) {}
    }

    function bruit(dur, vol, fc) {
        const a = audio();
        if (!a) return;
        try {
            const n = Math.floor(a.sampleRate * dur);
            const buf = a.createBuffer(1, n, a.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
            const src = a.createBufferSource();
            src.buffer = buf;
            const f = a.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = fc || 800;
            const g = a.createGain();
            g.gain.value = vol || 0.1;
            src.connect(f);
            f.connect(g);
            g.connect(a.destination);
            src.start();
        } catch (e) {}
    }

    function melanger(t) {
        for (let i = t.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const x = t[i]; t[i] = t[j]; t[j] = x;
        }
        return t;
    }

    function lisse(p) {
        p = Math.max(0, Math.min(1, p));
        return p * p * (3 - 2 * p);
    }

    function rr(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    // =====================================================
    // LE JEU : BOSS GÉANT
    // =====================================================

    function lancerBoss() {
        if (jeuActif) return;
        jeuActif = true;
        audio();

        // ---------- collecte des codes présents sur la page ----------
        const sources = [];
        document.querySelectorAll('.' + CLASSE).forEach(function (s) {
            const r = s.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) {
                sources.push({ code: s.getAttribute('data-code'), x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }
        });

        const dejaVus = {};
        const pool = [];
        sources.forEach(function (s) {
            if (!dejaVus[s.code]) { dejaVus[s.code] = 1; pool.push(s.code); }
        });
        while (pool.length < 8) {
            const c = 'CU' + LETTRES[Math.floor(Math.random() * 26)] + (1 + Math.floor(Math.random() * 9)) + (Math.random() < 0.5 ? 'G' : 'D');
            if (!dejaVus[c]) { dejaVus[c] = 1; pool.push(c); }
        }
        melanger(pool);

        const volantsSrc = sources.slice(0, 40);
        while (volantsSrc.length < 14) {
            volantsSrc.push({
                code: pool[volantsSrc.length % pool.length],
                x: Math.random() * innerWidth,
                y: Math.random() < 0.5 ? -20 : innerHeight + 20
            });
        }

        // ---------- cibles réelles pour les bombes (texte de la page) ----------
        const cibles = [];
        const vus = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let tn;
        while ((tn = walker.nextNode()) && cibles.length < 250) {
            if (!tn.nodeValue || !tn.nodeValue.trim()) continue;
            const el = tn.parentElement;
            if (!el || vus.has(el)) continue;
            const tag = el.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8 || r.width > 700 || r.height > 140) continue;
            if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
            vus.add(el);
            cibles.push({
                el: el,
                x: Math.min(innerWidth - 20, Math.max(20, r.left + r.width / 2)),
                y: Math.min(innerHeight * 0.85, Math.max(40, r.top + r.height / 2))
            });
        }
        const modifs = new Map();

        // ---------- overlay + canvas ----------
        const overlay = document.createElement('div');
        overlay.id = 'tm4-overlay';
        overlay.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;cursor:none;user-select:none;-webkit-user-select:none;touch-action:none;';
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;';
        overlay.appendChild(canvas);
        const btnFermer = document.createElement('div');
        btnFermer.textContent = '\u2715';
        btnFermer.title = 'Quitter (Échap)';
        btnFermer.style.cssText = 'position:absolute;top:10px;right:12px;width:32px;height:32px;line-height:32px;text-align:center;color:#fff;background:rgba(0,0,0,.55);border:1px solid #888;border-radius:50%;font:16px Arial;cursor:pointer;';
        overlay.appendChild(btnFermer);
        document.body.appendChild(overlay);
        const ctx = canvas.getContext('2d');

        let W = innerWidth, H = innerHeight, U = 1, dpr = 1;
        function redim() {
            W = innerWidth;
            H = innerHeight;
            dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(W * dpr);
            canvas.height = Math.floor(H * dpr);
            canvas.style.width = W + 'px';
            canvas.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            U = Math.max(0.5, Math.min(1.5, Math.min(W / 1000, H / 760)));
        }
        redim();

        // ---------- état du jeu ----------
        let actif = true;
        let raf = 0;
        let derniere = performance.now();
        let etat = 'alerte';
        let tEtat = 0;
        let sirenIdx = -1;
        let shake = 0, flashRouge = 0, flashBlanc = 0;
        let voileAlpha = 0;
        let tirEnCours = false;
        let victoireFlag = false;
        let joueurMort = false;
        let rechargement = false;
        let phaseCible = 2;
        let transInstall = false;
        let timerBoom = 0;
        const souris = { x: W / 2, y: H / 2 };

        const joueur = { x: W / 2, y: H - 60, vies: 5, inv: 0, cd: 0, ang: -Math.PI / 2 };
        const boss = {
            x: W / 2, y: H * 0.31, x0: W / 2, phase: 1, t: 0, spirale: 0,
            noyauHp: 40, noyauMax: 40, noyauExpose: false, flash: 0,
            modules: [], timers: { a: 0, b: 0, c: 0, d: 0, spiral: 0 }, visible: true
        };
        const SLOTS = [{ ox: -262, oy: 34 }, { ox: 262, oy: 34 }, { ox: -140, oy: -102 }, { ox: 140, oy: -102 }];
        const NOMS_PHASES = ['ARMEMENT', 'BOUCLIERS ORBITAUX', 'NOYAU CRITIQUE'];
        const COUL_EXPLO = ['#ffffff', '#ffd54f', '#ff9800', '#ff5722', '#b71c1c'];

        const tirs = [], ennemis = [], bombes = [], lasers = [], parts = [], traces = [];

        const volants = volantsSrc.map(function (s, i) {
            return { code: s.code, x0: s.x, y0: s.y, delai: (i / volantsSrc.length) * 0.7, arrive: false, x: s.x, y: s.y, p: 0, sens: i % 2 ? 1 : -1 };
        });

        function changerEtat(e) { etat = e; tEtat = 0; }

        // ---------- modules du boss ----------
        function creerModule(code, hp) {
            return { code: code, trad: traduire(code), hp: hp, max: hp, vivant: true, ox: 0, oy: 0, px: 0, py: 0, flash: 0, ang: 0, echelle: 1, type: 'canon', slot: SLOTS[0] };
        }

        function installerPhase(n) {
            boss.phase = n;
            boss.timers = { a: 0, b: 0, c: 0, d: 0, spiral: 0 };
            boss.modules = [];
            boss.noyauExpose = (n === 3);
            if (n === 1) {
                for (let i = 0; i < 4; i++) {
                    const m = creerModule(pool[i % pool.length], 8);
                    m.slot = SLOTS[i];
                    m.type = i < 2 ? 'canon' : 'tour';
                    boss.modules.push(m);
                }
            } else if (n === 2) {
                for (let i = 0; i < 3; i++) {
                    const m = creerModule(pool[(4 + i) % pool.length], 7);
                    m.type = 'orbite';
                    m.ang = i * TAU / 3;
                    boss.modules.push(m);
                }
            } else if (n === 3) {
                boss.noyauHp = boss.noyauMax;
            }
            majModules(0);
        }

        function majModules(dt) {
            boss.modules.forEach(function (m) {
                if (m.flash > 0) m.flash -= dt;
                if (m.type === 'orbite') {
                    m.ang += dt * 0.9;
                    m.ox = Math.cos(m.ang) * 210;
                    m.oy = Math.sin(m.ang) * 125;
                } else {
                    m.ox = m.slot.ox;
                    m.oy = m.slot.oy + Math.sin(boss.t * 2 + m.ang) * 4;
                }
                m.px = boss.x + m.ox * U;
                m.py = boss.y + m.oy * U;
            });
        }

        function deplacerBoss() {
            const ph = boss.phase;
            const amp = ph === 1 ? 0.10 : ph === 2 ? 0.16 : 0.18;
            const vit = ph === 1 ? 0.6 : ph === 2 ? 0.7 : 0.9;
            boss.x = W / 2 + Math.sin(boss.t * vit) * W * amp;
            boss.y = H * 0.31 + Math.sin(boss.t * 1.3) * 6 * U;
        }

        installerPhase(1);
        boss.modules.forEach(function (m) { m.echelle = 0; });

        // ---------- particules / effets ----------
        function boom(x, y, n, coul, vit) {
            if (parts.length > 700) return;
            for (let i = 0; i < n; i++) {
                const a = Math.random() * TAU;
                const v = (0.25 + Math.random()) * vit * U;
                parts.push({
                    x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                    life: 0, max: 0.45 + Math.random() * 0.7,
                    r: (2 + Math.random() * 4) * U,
                    c: coul[Math.floor(Math.random() * coul.length)]
                });
            }
        }

        function etincelles(x, y) { boom(x, y, 4, ['#fff59d', '#ffffff', '#90caf9'], 220); }

        function majParticules(dt) {
            for (let i = parts.length - 1; i >= 0; i--) {
                const p = parts[i];
                p.life += dt;
                if (p.life >= p.max) { parts.splice(i, 1); continue; }
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.985;
                p.vy = p.vy * 0.985 + 120 * U * dt;
            }
        }

        // ---------- projectiles ----------
        function viser(x, y) {
            return Math.atan2(joueur.y - 30 * U - y, joueur.x - x);
        }

        function tirEnnemi(x, y, ang, vit, r) {
            ennemis.push({ x: x, y: y, vx: Math.cos(ang) * vit * U, vy: Math.sin(ang) * vit * U, r: r * U });
        }

        function tirer() {
            const ox = joueur.x, oy = joueur.y - 38 * U, a = joueur.ang;
            tirs.push({
                x: ox + Math.cos(a) * 44 * U, y: oy + Math.sin(a) * 44 * U,
                vx: Math.cos(a) * 1100 * U, vy: Math.sin(a) * 1100 * U
            });
            bip(760, 220, 0.06, 'square', 0.025);
        }

        function lancerBombes(n) {
            for (let i = 0; i < n; i++) {
                let tx, ty, el = null;
                if (cibles.length) {
                    const t = cibles[Math.floor(Math.random() * cibles.length)];
                    tx = t.x; ty = t.y; el = t.el;
                } else {
                    tx = 40 + Math.random() * (W - 80);
                    ty = H * 0.4 + Math.random() * H * 0.4;
                }
                bombes.push({ x: tx, y: -30, tx: tx, ty: Math.max(ty, 60), vy: (330 + Math.random() * 90) * U, el: el });
            }
            bip(200, 90, 0.4, 'sawtooth', 0.05);
        }

        function lancerLasers() {
            lasers.push({ x: joueur.x, w: 64 * U, t: 0, tel: 1.3, act: 0.55 });
            lasers.push({ x: 60 * U + Math.random() * (W - 120 * U), w: 64 * U, t: 0, tel: 1.3, act: 0.55 });
            bip(300, 900, 1.2, 'sawtooth', 0.05);
        }

        function bruler(el) {
            if (!el) return;
            if (!modifs.has(el)) modifs.set(el, { op: el.style.opacity, tr: el.style.transition });
            el.style.transition = 'opacity .25s';
            el.style.opacity = '0.08';
        }

        function exploserBombe(b) {
            boom(b.tx, b.ty, 46, COUL_EXPLO, 320);
            traces.push({ x: b.tx, y: b.ty, r: (50 + Math.random() * 25) * U });
            if (traces.length > 60) traces.shift();
            bruler(b.el);
            shake = Math.max(shake, 7);
            bruit(0.5, 0.16, 900);
            if (Math.hypot(joueur.x - b.tx, (joueur.y - 30 * U) - b.ty) < 80 * U) toucher();
        }

        // ---------- dégâts ----------
        function toucher() {
            if (joueur.inv > 0 || joueurMort || etat === 'fin' || etat === 'victoire') return;
            joueur.vies--;
            joueur.inv = 1.5;
            shake = Math.max(shake, 16);
            flashRouge = 0.7;
            bip(180, 40, 0.35, 'sawtooth', 0.12);
            bruit(0.3, 0.14, 700);
            boom(joueur.x, joueur.y - 30 * U, 24, ['#ff5252', '#ffffff', '#b71c1c'], 260);
            if (joueur.vies <= 0) defaite();
        }

        function degatsModule(m) {
            m.hp--;
            m.flash = 0.08;
            bip(300, 120, 0.08, 'triangle', 0.05);
            if (m.hp <= 0) {
                m.vivant = false;
                boom(m.px, m.py, 60, COUL_EXPLO, 340);
                shake = Math.max(shake, 10);
                bruit(0.6, 0.2, 800);
                if (boss.modules.every(function (x) { return !x.vivant; })) finPhase();
            }
        }

        function degatsNoyau() {
            boss.noyauHp--;
            boss.flash = 0.08;
            bip(240, 90, 0.08, 'triangle', 0.06);
            boom(boss.x, boss.y, 3, ['#ffffff', '#ff8a80'], 200);
            if (boss.noyauHp <= 0 && etat === 'combat') victoire();
        }

        function finPhase() {
            ennemis.forEach(function (e) { boom(e.x, e.y, 3, ['#ff6659', '#ffffff'], 90); });
            ennemis.length = 0;
            bombes.length = 0;
            lasers.length = 0;
            phaseCible = boss.phase + 1;
            transInstall = false;
            shake = Math.max(shake, 14);
            flashBlanc = 0.5;
            bruit(1.0, 0.25, 500);
            bip(120, 600, 0.9, 'sawtooth', 0.06);
            changerEtat('transition');
        }

        function victoire() {
            victoireFlag = true;
            ennemis.length = 0;
            bombes.length = 0;
            lasers.length = 0;
            boss.x0 = boss.x;
            timerBoom = 0;
            changerEtat('victoire');
        }

        function defaite() {
            joueurMort = true;
            victoireFlag = false;
            boom(joueur.x, joueur.y - 30 * U, 80, COUL_EXPLO, 380);
            bruit(1.2, 0.25, 600);
            shake = Math.max(shake, 18);
            tirEnCours = false;
            changerEtat('fin');
        }

        // ---------- attaques du boss ----------
        function attaques(dt) {
            const T = boss.timers, ph = boss.phase, bx = boss.x, by = boss.y;

            if (ph === 1) {
                T.a += dt; T.b += dt; T.c += dt;
                if (T.a >= 1.15) {
                    T.a = 0;
                    boss.modules.forEach(function (m) {
                        if (m.vivant && m.type === 'canon') {
                            const a = viser(m.px, m.py);
                            [-0.28, 0, 0.28].forEach(function (d) { tirEnnemi(m.px, m.py + 10 * U, a + d, 300, 8); });
                            bip(320, 140, 0.1, 'square', 0.03);
                        }
                    });
                }
                if (T.b >= 2.6) {
                    T.b = 0;
                    boss.modules.forEach(function (m) {
                        if (m.vivant && m.type === 'tour') tirEnnemi(m.px, m.py + 10 * U, viser(m.px, m.py), 210, 15);
                    });
                }
                if (T.c >= 1.9) {
                    T.c = 0;
                    tirEnnemi(bx, by + 40 * U, viser(bx, by), 240, 9);
                }
            } else if (ph === 2) {
                T.a += dt; T.b += dt; T.c += dt;
                if (T.a >= 1.5) {
                    T.a = 0;
                    const a = viser(bx, by);
                    for (let i = -2; i <= 2; i++) tirEnnemi(bx, by + 40 * U, a + i * 0.22, 250, 8);
                    bip(260, 110, 0.12, 'square', 0.035);
                }
                if (T.b >= 2.2) {
                    T.b = 0;
                    boss.modules.forEach(function (m) {
                        if (m.vivant) tirEnnemi(m.px, m.py, viser(m.px, m.py), 260, 9);
                    });
                }
                if (T.c >= 3.4) {
                    T.c = 0;
                    lancerBombes(3);
                }
            } else if (ph === 3) {
                T.spiral += dt; T.b += dt; T.c += dt; T.d += dt;
                while (T.spiral >= 0.16) {
                    T.spiral -= 0.16;
                    boss.spirale += 0.42;
                    tirEnnemi(bx, by, boss.spirale, 190, 7);
                    tirEnnemi(bx, by, boss.spirale + Math.PI, 190, 7);
                }
                if (T.b >= 3.0) {
                    T.b = 0;
                    const trou = Math.random() * TAU;
                    for (let i = 0; i < 22; i++) {
                        const a = i / 22 * TAU;
                        const d = Math.abs(Math.atan2(Math.sin(a - trou), Math.cos(a - trou)));
                        if (d < 0.4) continue;
                        tirEnnemi(bx, by, a, 230, 8);
                    }
                    bip(150, 60, 0.25, 'sawtooth', 0.06);
                }
                if (T.c >= 6.5) { T.c = 0; lancerLasers(); }
                if (T.d >= 5.0) { T.d = 0; lancerBombes(2); }
            }
        }

        // ---------- mises à jour ----------
        function majTirs(dt) {
            for (let i = tirs.length - 1; i >= 0; i--) {
                const b = tirs[i];
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) tirs.splice(i, 1);
            }
        }

        function majProjectiles(dt) {
            const px = joueur.x, py = joueur.y - 30 * U;
            for (let i = ennemis.length - 1; i >= 0; i--) {
                const e = ennemis[i];
                e.x += e.vx * dt;
                e.y += e.vy * dt;
                if (e.x < -60 || e.x > W + 60 || e.y < -60 || e.y > H + 60) { ennemis.splice(i, 1); continue; }
                if (joueur.inv <= 0 && !joueurMort && Math.hypot(e.x - px, e.y - py) < e.r + 13 * U) {
                    ennemis.splice(i, 1);
                    toucher();
                }
            }
            for (let i = bombes.length - 1; i >= 0; i--) {
                const b = bombes[i];
                b.y += b.vy * dt;
                if (b.y >= b.ty) {
                    bombes.splice(i, 1);
                    exploserBombe(b);
                }
            }
            for (let i = lasers.length - 1; i >= 0; i--) {
                const l = lasers[i];
                l.t += dt;
                if (l.t > l.tel + l.act) { lasers.splice(i, 1); continue; }
                if (l.t > l.tel && Math.abs(joueur.x - l.x) < l.w / 2) toucher();
                if (l.t > l.tel && l.t - dt <= l.tel) { shake = Math.max(shake, 10); bruit(0.5, 0.15, 1500); }
            }
        }

        function collisionsTirs() {
            for (let i = tirs.length - 1; i >= 0; i--) {
                const b = tirs[i];
                let touche = false;
                for (let k = 0; k < boss.modules.length; k++) {
                    const m = boss.modules[k];
                    if (!m.vivant || m.echelle < 1) continue;
                    if (Math.abs(b.x - m.px) < 56 * U + 4 && Math.abs(b.y - m.py) < 25 * U + 4) {
                        degatsModule(m);
                        touche = true;
                        break;
                    }
                }
                if (!touche) {
                    if (boss.phase === 3 && boss.noyauExpose && Math.hypot(b.x - boss.x, b.y - boss.y) < 50 * U) {
                        degatsNoyau();
                        touche = true;
                    } else if (Math.abs(b.x - boss.x) < 165 * U && Math.abs(b.y - boss.y) < 92 * U) {
                        etincelles(b.x, b.y);
                        bip(1800, 1200, 0.05, 'triangle', 0.025);
                        touche = true;
                    }
                }
                if (touche) tirs.splice(i, 1);
                if (etat !== 'combat') return;
            }
        }

        function majAlerte() {
            const idx = Math.floor(tEtat / 0.6);
            if (idx > sirenIdx) { sirenIdx = idx; bip(520, 880, 0.55, 'sawtooth', 0.05); }
            shake = Math.max(shake, 3);
            if (tEtat >= 2.4) changerEtat('assemblage');
        }

        function majAssemblage() {
            boss.x = W / 2;
            boss.y = H * 0.31;
            majModules(0);
            volants.forEach(function (v) {
                const p = Math.max(0, Math.min(1, (tEtat - v.delai) / 1.1));
                const e = lisse(p);
                v.p = p;
                v.x = v.x0 + (boss.x - v.x0) * e + Math.sin(p * Math.PI) * 80 * U * v.sens;
                v.y = v.y0 + (boss.y - v.y0) * e;
                if (p >= 1 && !v.arrive) {
                    v.arrive = true;
                    boom(boss.x, boss.y, 6, ['#ffca28', '#ff7043', '#ffffff'], 160);
                    bip(500 + Math.random() * 500, 900, 0.06, 'triangle', 0.03);
                }
            });
            boss.modules.forEach(function (m, i) { m.echelle = lisse((tEtat - 1.6 - i * 0.15) / 0.7); });
            if (tEtat >= 2.8) {
                boss.modules.forEach(function (m) { m.echelle = 1; });
                bip(90, 400, 0.8, 'sawtooth', 0.07);
                changerEtat('combat');
            }
        }

        function majCombat(dt) {
            boss.t += dt;
            deplacerBoss();
            majModules(dt);
            if (boss.phase === 3) shake = Math.max(shake, 1.5);
            if (tirEnCours && joueur.cd <= 0) { joueur.cd = 0.14; tirer(); }
            majTirs(dt);
            attaques(dt);
            majProjectiles(dt);
            if (etat === 'combat') collisionsTirs();
        }

        function majTransition(dt) {
            boss.t += dt;
            deplacerBoss();
            majModules(dt);
            majTirs(dt);
            if (!transInstall && tEtat >= 1.0) {
                transInstall = true;
                installerPhase(phaseCible);
                boss.modules.forEach(function (m) { m.echelle = 0; });
                joueur.vies = Math.min(5, joueur.vies + 1);
                bip(200, 800, 0.5, 'triangle', 0.06);
            }
            if (transInstall) {
                boss.modules.forEach(function (m, i) { m.echelle = lisse((tEtat - 1.0 - i * 0.2) / 0.7); });
            }
            if (tEtat >= 2.4) {
                boss.modules.forEach(function (m) { m.echelle = 1; });
                changerEtat('combat');
            }
        }

        function majVictoire(dt) {
            boss.t += dt;
            boss.x = boss.x0 + (Math.random() - 0.5) * 8;
            boss.noyauExpose = true;
            timerBoom -= dt;
            if (timerBoom <= 0) {
                timerBoom = 0.11;
                const bx = boss.x + (Math.random() - 0.5) * 300 * U;
                const by = boss.y + (Math.random() - 0.5) * 180 * U;
                boom(bx, by, 26, COUL_EXPLO, 260);
                bruit(0.4, 0.14, 900);
                shake = Math.max(shake, 12);
            }
            if (tEtat >= 3.4) {
                boom(boss.x, boss.y, 200, COUL_EXPLO, 700);
                flashBlanc = 1;
                bruit(1.6, 0.3, 500);
                boss.visible = false;
                changerEtat('fin');
            }
        }

        function majFin() {
            const t1 = victoireFlag ? 2.4 : 0;
            if (tEtat >= t1 + 3.4 && !rechargement) {
                rechargement = true;
                location.reload();
            }
        }

        function maj(dt) {
            joueur.y = H - 60 * U;
            joueur.x += (souris.x - joueur.x) * Math.min(1, dt * 14);
            joueur.x = Math.max(30 * U, Math.min(W - 30 * U, joueur.x));
            const dx = souris.x - joueur.x, dy = souris.y - (joueur.y - 38 * U);
            let ang = Math.atan2(dy, dx);
            if (ang > -0.12) ang = (Math.abs(ang) > Math.PI / 2) ? -Math.PI + 0.12 : -0.12;
            if (ang < -Math.PI + 0.12) ang = -Math.PI + 0.12;
            joueur.ang = ang;
            joueur.inv = Math.max(0, joueur.inv - dt);
            joueur.cd -= dt;
            shake = Math.max(0, shake - 45 * dt);
            flashRouge = Math.max(0, flashRouge - dt * 1.6);
            flashBlanc = Math.max(0, flashBlanc - dt * 1.2);
            boss.flash = Math.max(0, boss.flash - dt);
            majParticules(dt);
            tEtat += dt;
            if (etat === 'alerte') majAlerte();
            else if (etat === 'assemblage') majAssemblage();
            else if (etat === 'combat') majCombat(dt);
            else if (etat === 'transition') majTransition(dt);
            else if (etat === 'victoire') majVictoire(dt);
            else if (etat === 'fin') majFin();
        }

        // ---------- dessin ----------
        function texte(c, s, x, y, taille, coul, alpha) {
            c.save();
            c.globalAlpha = alpha === undefined ? 1 : alpha;
            c.font = '900 ' + Math.round(taille) + "px Impact, 'Arial Black', sans-serif";
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.lineWidth = Math.max(2, taille * 0.08);
            c.strokeStyle = '#000';
            c.strokeText(s, x, y);
            c.fillStyle = coul;
            c.fillText(s, x, y);
            c.restore();
        }

        function dessinerBoss(c, echelle, alpha) {
            c.save();
            c.globalAlpha = alpha;
            c.translate(boss.x, boss.y);
            c.scale(U * echelle, U * echelle);
            const rage = boss.phase === 3;
            const pulse = 0.5 + 0.5 * Math.sin(boss.t * (rage ? 9 : 3));

            // liaisons avec les modules
            c.lineCap = 'round';
            boss.modules.forEach(function (m) {
                if (!m.vivant) return;
                c.beginPath();
                c.moveTo(0, 0);
                c.lineTo(m.ox, m.oy);
                if (m.type === 'orbite') { c.strokeStyle = 'rgba(120,200,255,.35)'; c.lineWidth = 3; }
                else { c.strokeStyle = '#3b4350'; c.lineWidth = 10; }
                c.stroke();
            });

            // corps
            c.fillStyle = '#1b1f26';
            rr(c, -165, -92, 330, 184, 28);
            c.fill();
            c.lineWidth = 5;
            c.strokeStyle = rage ? 'rgb(255,' + Math.floor(60 + pulse * 40) + ',50)' : '#788496';
            c.stroke();
            c.fillStyle = '#242a33';
            rr(c, -140, -70, 280, 140, 18);
            c.fill();
            for (let i = 0; i < 7; i++) {
                const on = (i + Math.floor(boss.t * 4)) % 3 === 0;
                c.fillStyle = on ? (rage ? '#ff3b30' : '#ffb300') : '#3a414d';
                c.beginPath();
                c.arc(-120 + i * 40, 78, 5, 0, TAU);
                c.fill();
            }

            // noyau
            const rc = 46;
            const g = c.createRadialGradient(0, 0, 4, 0, 0, rc * 1.9);
            g.addColorStop(0, rage ? 'rgba(255,80,60,0.9)' : 'rgba(255,170,0,0.55)');
            g.addColorStop(1, 'rgba(255,0,0,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(0, 0, rc * 1.9, 0, TAU);
            c.fill();
            c.fillStyle = '#0d0f13';
            c.beginPath();
            c.arc(0, 0, rc, 0, TAU);
            c.fill();
            c.lineWidth = 4;
            c.strokeStyle = boss.noyauExpose ? '#ff3b30' : '#5a6b82';
            c.stroke();
            const pa = Math.atan2(joueur.y - boss.y, joueur.x - boss.x);
            const ex = Math.cos(pa) * 14, ey = Math.sin(pa) * 14;
            c.fillStyle = boss.noyauExpose ? '#ff3b30' : '#ffb300';
            c.beginPath();
            c.arc(ex, ey, 17 + (boss.noyauExpose ? pulse * 4 : 0), 0, TAU);
            c.fill();
            c.fillStyle = '#fff';
            c.beginPath();
            c.arc(ex + 5, ey - 5, 4, 0, TAU);
            c.fill();
            if (!boss.noyauExpose) {
                c.strokeStyle = 'rgba(120,200,255,' + (0.35 + 0.25 * pulse) + ')';
                c.lineWidth = 5;
                c.beginPath();
                c.arc(0, 0, rc + 12, 0, TAU);
                c.stroke();
            }
            if (boss.flash > 0) {
                c.fillStyle = 'rgba(255,255,255,' + Math.min(1, boss.flash * 10) + ')';
                c.beginPath();
                c.arc(0, 0, rc, 0, TAU);
                c.fill();
            }
            c.restore();
        }

        function dessinerModule(c, m) {
            if (!m.vivant || m.echelle <= 0) return;
            c.save();
            c.translate(m.px, m.py);
            c.scale(U * m.echelle, U * m.echelle);
            const f = m.flash > 0;
            c.fillStyle = f ? '#ffffff' : '#2a303a';
            rr(c, -56, -25, 112, 50, 10);
            c.fill();
            c.lineWidth = 3;
            c.strokeStyle = '#ff3b30';
            c.stroke();
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.font = 'bold 17px Consolas, monospace';
            c.fillStyle = f ? '#000' : '#fff';
            c.fillText(m.code, 0, -6);
            c.font = 'bold 14px Consolas, monospace';
            c.fillStyle = f ? '#000' : '#ffa726';
            c.fillText(m.trad, 0, 12);
            const r = m.hp / m.max;
            c.fillStyle = 'rgba(0,0,0,.6)';
            c.fillRect(-56, -36, 112, 6);
            c.fillStyle = r > 0.5 ? '#4caf50' : r > 0.25 ? '#ffb300' : '#ff3b30';
            c.fillRect(-56, -36, 112 * r, 6);
            c.restore();
        }

        function dessinerJoueur(c) {
            if (joueurMort) return;
            if (joueur.inv > 0 && Math.floor(joueur.inv * 12) % 2 === 0) return;
            c.save();
            c.translate(joueur.x, joueur.y);
            c.scale(U, U);
            c.strokeStyle = '#ff2d2d';
            c.fillStyle = '#ff2d2d';
            c.lineWidth = 5;
            c.lineCap = 'round';
            c.beginPath();
            c.arc(0, -58, 11, 0, TAU);
            c.fill();
            c.beginPath();
            c.moveTo(0, -46);
            c.lineTo(0, -16);
            c.moveTo(0, -16);
            c.lineTo(-12, 10);
            c.moveTo(0, -16);
            c.lineTo(12, 10);
            c.stroke();
            c.translate(0, -38);
            c.rotate(joueur.ang);
            if (Math.cos(joueur.ang) < 0) c.scale(1, -1);
            c.beginPath();
            c.moveTo(0, 0);
            c.lineTo(22, 0);
            c.stroke();
            c.fillStyle = '#222';
            c.fillRect(18, -5, 26, 9);
            c.restore();
        }

        function ratioBoss() {
            if (boss.phase === 3) return Math.max(0, boss.noyauHp / boss.noyauMax);
            let h = 0, m = 0;
            boss.modules.forEach(function (x) { h += x.vivant ? x.hp : 0; m += x.max; });
            return m ? h / m : 0;
        }

        function dessinerHUD(c) {
            c.textAlign = 'left';
            c.textBaseline = 'top';
            c.font = Math.round(22 * Math.max(U, 0.75)) + 'px Arial';
            let s = '';
            for (let i = 0; i < joueur.vies; i++) s += '\u2764\uFE0F';
            c.fillStyle = '#fff';
            c.fillText(s, 16, 14);

            if (etat === 'combat' || etat === 'transition' || etat === 'victoire' || etat === 'assemblage') {
                const bw = Math.min(W * 0.5, 520), bx = (W - bw) / 2, by = 16;
                let r = ratioBoss();
                if (etat === 'assemblage') r = lisse((tEtat - 2.0) / 0.8);
                if (etat === 'victoire') r = 0;
                c.fillStyle = 'rgba(0,0,0,.65)';
                c.fillRect(bx - 3, by - 3, bw + 6, 20);
                const gr = c.createLinearGradient(bx, 0, bx + bw, 0);
                gr.addColorStop(0, '#ff8a00');
                gr.addColorStop(1, '#ff1744');
                c.fillStyle = gr;
                c.fillRect(bx, by, bw * r, 14);
                c.strokeStyle = '#fff';
                c.lineWidth = 1;
                c.strokeRect(bx - 3, by - 3, bw + 6, 20);
                const ph = (etat === 'transition') ? phaseCible : boss.phase;
                c.textAlign = 'center';
                c.font = 'bold ' + Math.round(13 * Math.max(U, 0.8)) + 'px Arial';
                c.fillStyle = '#fff';
                c.fillText('MACHINE \u2014 PHASE ' + ph + '/3 \u00B7 ' + NOMS_PHASES[ph - 1], W / 2, by + 24);
            }
        }

        function dessiner() {
            const c = ctx;
            c.clearRect(0, 0, W, H);

            const cibleVoile = (etat === 'alerte') ? 0.12 : 0.32;
            voileAlpha += (cibleVoile - voileAlpha) * 0.05;
            c.fillStyle = 'rgba(0,0,0,' + voileAlpha + ')';
            c.fillRect(0, 0, W, H);

            const sx = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
            const sy = shake > 0 ? (Math.random() - 0.5) * shake * 2 : 0;
            c.save();
            c.translate(sx, sy);

            // traces de brûlure
            traces.forEach(function (t) {
                const g = c.createRadialGradient(t.x, t.y, 2, t.x, t.y, t.r);
                g.addColorStop(0, 'rgba(0,0,0,.6)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g;
                c.beginPath();
                c.arc(t.x, t.y, t.r, 0, TAU);
                c.fill();
            });

            // lasers
            lasers.forEach(function (l) {
                if (l.t < l.tel) {
                    const al = 0.12 + 0.18 * Math.abs(Math.sin(l.t * 14));
                    c.fillStyle = 'rgba(255,40,40,' + al + ')';
                    c.fillRect(l.x - l.w / 2, 0, l.w, H);
                    c.strokeStyle = 'rgba(255,90,90,.85)';
                    c.lineWidth = 2;
                    c.setLineDash([12, 10]);
                    c.beginPath();
                    c.moveTo(l.x - l.w / 2, 0); c.lineTo(l.x - l.w / 2, H);
                    c.moveTo(l.x + l.w / 2, 0); c.lineTo(l.x + l.w / 2, H);
                    c.stroke();
                    c.setLineDash([]);
                } else {
                    c.fillStyle = 'rgba(255,40,40,.45)';
                    c.fillRect(l.x - l.w / 2, 0, l.w, H);
                    c.fillStyle = 'rgba(255,180,160,.8)';
                    c.fillRect(l.x - l.w * 0.28, 0, l.w * 0.56, H);
                    c.fillStyle = '#fff';
                    c.fillRect(l.x - l.w * 0.12, 0, l.w * 0.24, H);
                }
            });

            // codes volants (assemblage)
            if (etat === 'assemblage') {
                c.font = 'bold ' + Math.round(16 * U) + 'px Consolas, monospace';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                volants.forEach(function (v) {
                    if (v.p <= 0 || v.p >= 1) return;
                    c.fillStyle = 'rgba(255,80,0,.25)';
                    c.beginPath();
                    c.arc(v.x, v.y, 16 * U, 0, TAU);
                    c.fill();
                    c.fillStyle = '#ffcc80';
                    c.fillText(v.code, v.x, v.y);
                });
            }

            // boss
            if (boss.visible) {
                let ech = 1, al = 1;
                if (etat === 'alerte') { ech = 0; al = 0; }
                else if (etat === 'assemblage') { ech = 0.3 + 0.7 * lisse((tEtat - 0.8) / 1.4); al = lisse((tEtat - 0.8) / 1.4); }
                else if (etat === 'victoire') { al = 0.6 + Math.random() * 0.4; }
                if (al > 0) {
                    dessinerBoss(c, ech, al);
                    boss.modules.forEach(function (m) { dessinerModule(c, m); });
                }
            }

            // bombes
            bombes.forEach(function (b) {
                const p = Math.max(0, Math.min(1, (b.y + 30) / (b.ty + 30)));
                c.strokeStyle = 'rgba(255,50,50,' + (0.3 + 0.5 * p) + ')';
                c.lineWidth = 3;
                c.beginPath();
                c.arc(b.tx, b.ty, (60 - 40 * p) * U, 0, TAU);
                c.stroke();
                c.beginPath();
                c.moveTo(b.tx - 10 * U, b.ty); c.lineTo(b.tx + 10 * U, b.ty);
                c.moveTo(b.tx, b.ty - 10 * U); c.lineTo(b.tx, b.ty + 10 * U);
                c.stroke();
                c.fillStyle = '#111';
                c.beginPath();
                c.arc(b.x, b.y, 12 * U, 0, TAU);
                c.fill();
                c.strokeStyle = '#ff3b30';
                c.lineWidth = 2;
                c.stroke();
                c.fillStyle = (Math.floor(b.y / 20) % 2) ? '#ff5252' : '#ffd54f';
                c.beginPath();
                c.arc(b.x, b.y - 14 * U, 3 * U, 0, TAU);
                c.fill();
            });

            // tirs ennemis
            ennemis.forEach(function (e) {
                c.fillStyle = 'rgba(255,60,40,.35)';
                c.beginPath();
                c.arc(e.x, e.y, e.r * 1.8, 0, TAU);
                c.fill();
                c.fillStyle = '#ff3b30';
                c.beginPath();
                c.arc(e.x, e.y, e.r, 0, TAU);
                c.fill();
                c.fillStyle = '#fff';
                c.beginPath();
                c.arc(e.x, e.y, e.r * 0.45, 0, TAU);
                c.fill();
            });

            // tirs du joueur
            c.strokeStyle = '#ffe082';
            c.lineWidth = 3 * U;
            c.lineCap = 'round';
            tirs.forEach(function (b) {
                c.beginPath();
                c.moveTo(b.x, b.y);
                c.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
                c.stroke();
            });

            // particules
            parts.forEach(function (p) {
                c.globalAlpha = Math.max(0, 1 - p.life / p.max);
                c.fillStyle = p.c;
                c.beginPath();
                c.arc(p.x, p.y, p.r, 0, TAU);
                c.fill();
            });
            c.globalAlpha = 1;

            c.restore(); // fin du tremblement (le joueur reste stable)

            dessinerJoueur(c);

            // viseur
            if (etat !== 'fin') {
                c.strokeStyle = 'rgba(255,255,255,.85)';
                c.lineWidth = 2;
                c.beginPath();
                c.arc(souris.x, souris.y, 12 * U, 0, TAU);
                c.moveTo(souris.x - 19 * U, souris.y); c.lineTo(souris.x - 6 * U, souris.y);
                c.moveTo(souris.x + 6 * U, souris.y); c.lineTo(souris.x + 19 * U, souris.y);
                c.moveTo(souris.x, souris.y - 19 * U); c.lineTo(souris.x, souris.y - 6 * U);
                c.moveTo(souris.x, souris.y + 6 * U); c.lineTo(souris.x, souris.y + 19 * U);
                c.stroke();
            }

            dessinerHUD(c);

            // bannières
            if (etat === 'alerte') {
                const p = Math.abs(Math.sin(tEtat * 6));
                c.fillStyle = 'rgba(255,0,0,' + (0.08 + 0.14 * p) + ')';
                c.fillRect(0, 0, W, H);
                texte(c, '\u26A0 ALERTE \u26A0', W / 2, H * 0.42, Math.min(90, W * 0.11), '#ff3b30', 0.6 + 0.4 * p);
                texte(c, 'MACHINE HORS CONTR\u00D4LE', W / 2, H * 0.42 + Math.min(70, W * 0.085), Math.min(44, W * 0.055), '#ffffff', 0.9);
            } else if (etat === 'assemblage' && tEtat > 0.3 && tEtat < 1.6) {
                texte(c, 'FUSION EN COURS...', W / 2, H * 0.62, Math.min(40, W * 0.05), '#ffa726', Math.min(1, (1.6 - tEtat) * 2));
            } else if (etat === 'transition') {
                const a = Math.sin(Math.PI * Math.min(1, tEtat / 2.4));
                texte(c, 'PHASE ' + phaseCible, W / 2, H * 0.55, Math.min(84, W * 0.1), '#ffffff', a);
                texte(c, NOMS_PHASES[phaseCible - 1], W / 2, H * 0.55 + Math.min(64, W * 0.075), Math.min(38, W * 0.048), '#ff8a00', a);
            }

            if (flashRouge > 0) {
                c.fillStyle = 'rgba(255,0,0,' + (flashRouge * 0.5) + ')';
                c.fillRect(0, 0, W, H);
            }
            if (flashBlanc > 0) {
                c.fillStyle = 'rgba(255,255,255,' + Math.min(1, flashBlanc) + ')';
                c.fillRect(0, 0, W, H);
            }

            if (etat === 'fin') {
                c.fillStyle = 'rgba(0,0,0,' + Math.min(0.9, tEtat * 1.5) + ')';
                c.fillRect(0, 0, W, H);
                const t1 = victoireFlag ? 2.4 : 0;
                const taille = Math.min(80, W * 0.1);
                if (victoireFlag && tEtat < t1) {
                    texte(c, 'MACHINE NEUTRALIS\u00C9E.', W / 2, H / 2, Math.min(80, W * 0.075), '#69f0ae', Math.min(1, tEtat * 2));
                } else if (tEtat >= t1 + 0.2) {
                    const a = Math.min(1, (tEtat - t1 - 0.2) * 2);
                    texte(c, "IL EST L'HEURE", W / 2, H / 2 - taille * 0.6, taille, '#ffffff', a);
                    texte(c, "D'ALLER BOSSER.", W / 2, H / 2 + taille * 0.6, taille, '#ff3b30', a);
                }
            }
        }

        // ---------- entrées ----------
        function relacher() { tirEnCours = false; }
        function onKey(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                nettoyer();
            }
        }
        function nettoyer() {
            if (!actif) return;
            actif = false;
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('resize', redim);
            window.removeEventListener('pointerup', relacher);
            window.removeEventListener('blur', relacher);
            modifs.forEach(function (v, el) {
                el.style.opacity = v.op;
                el.style.transition = v.tr;
            });
            modifs.clear();
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            jeuActif = false;
        }

        overlay.addEventListener('pointerdown', function (e) {
            souris.x = e.clientX; souris.y = e.clientY;
            tirEnCours = true;
            audio();
            e.preventDefault();
        });
        overlay.addEventListener('pointermove', function (e) { souris.x = e.clientX; souris.y = e.clientY; });
        overlay.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        overlay.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
        btnFermer.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        btnFermer.addEventListener('click', function (e) { e.stopPropagation(); nettoyer(); });
        window.addEventListener('pointerup', relacher);
        window.addEventListener('blur', relacher);
        window.addEventListener('resize', redim);
        window.addEventListener('keydown', onKey, true);

        // crochet de test (inactif en production : window.__TM4_TEST n'existe pas)
        if (window.__TM4_TEST) {
            window.__TM4_TEST.api = {
                boss: boss, joueur: joueur, ennemis: ennemis, bombes: bombes, lasers: lasers,
                etat: function () { return etat; },
                tuerModules: function () {
                    boss.modules.slice().forEach(function (m) { if (m.vivant) { m.hp = 1; degatsModule(m); } });
                },
                tuerNoyau: function () { boss.noyauHp = 1; degatsNoyau(); },
                forcerLaser: lancerLasers,
                forcerBombes: lancerBombes,
                fermer: nettoyer
            };
        }

        function boucle(now) {
            if (!actif) return;
            let dt = (now - derniere) / 1000;
            derniere = now;
            if (dt > 0.033) dt = 0.033;
            if (dt < 0) dt = 0;
            maj(dt);
            dessiner();
            raf = requestAnimationFrame(boucle);
        }
        raf = requestAnimationFrame(boucle);
    }

    // =====================================================
    // DÉMARRAGE
    // =====================================================

    function init() {
        lancer();
        observateur.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        ['pushState', 'replaceState'].forEach(function (nom) {
            const original = history[nom];
            history[nom] = function () {
                const resultat = original.apply(this, arguments);
                setTimeout(lancer, 300);
                setTimeout(lancer, 1000);
                setTimeout(lancer, 2000);
                return resultat;
            };
        });
        window.addEventListener('popstate', function () {
            setTimeout(lancer, 300);
            setTimeout(lancer, 1000);
            setTimeout(lancer, 2000);
        });

        setInterval(lancer, 3000);
        console.log(NOM + ' ACTIF');
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);

})();

// ===== FIN DU SCRIPT ATELIER4 : si tu vois cette ligne dans Tampermonkey, la copie est complète =====
