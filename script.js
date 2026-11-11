/* Small interactive touches for the site. Everything here is optional:
   the page reads fine with JavaScript off. */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Scroll: progress bar, back-to-top, section nav ---------- */
    var bar = document.querySelector('.scroll-progress');
    var toTop = document.querySelector('.to-top');
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.side-nav a'));
    var sections = navLinks
        .map(function (a) { return document.querySelector(a.getAttribute('href')); })
        .filter(Boolean);
    var ticking = false;

    function onScroll() {
        ticking = false;
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var y = window.scrollY;

        if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
        if (toTop) toTop.classList.toggle('show', y > 500);

        if (sections.length) {
            var current = 0;
            var line = window.innerHeight * 0.3;
            sections.forEach(function (s, i) {
                if (s.getBoundingClientRect().top <= line) current = i;
            });
            if (max > 0 && y >= max - 4) current = sections.length - 1;
            navLinks.forEach(function (a, i) { a.classList.toggle('active', i === current); });
        }
    }

    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    if (toTop) {
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ---------- Reveal on scroll ---------- */
    if ('IntersectionObserver' in window && !reduceMotion) {
        var targets = document.querySelectorAll(
            '.content h2, .bio-intro, .news-list li, .publications-category-title, ' +
            '.publication-item, .exp-item, .activity-list li, .interest-list'
        );
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('in');
                    io.unobserve(e.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        targets.forEach(function (el) {
            el.classList.add('reveal');
            io.observe(el);
        });
    }

    /* ---------- Greeting that switches language ---------- */
    var greet = document.getElementById('greet');
    if (greet && !reduceMotion) {
        var greetings = ['Hello!', '你好!', 'Aloha!', 'Bonjour!', '¡Hola!', 'こんにちは!', '안녕하세요!', 'Ciao!', 'Hallo!', 'Olá!'];
        var gi = 0;
        setInterval(function () {
            greet.classList.add('swap');
            setTimeout(function () {
                gi = (gi + 1) % greetings.length;
                greet.textContent = greetings[gi];
                greet.classList.remove('swap');
            }, 300);
        }, 4000);
    }

    /* ---------- Interests: click for a little burst ---------- */
    var burstColors = ['#8b5fbf', '#6f9fe8', '#f2a07b', '#7cc6a4', '#f2c14e'];
    document.querySelectorAll('.interest').forEach(function (item) {
        item.addEventListener('click', function () {
            if (reduceMotion) return;
            for (var i = 0; i < 10; i++) {
                var dot = document.createElement('span');
                var angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
                var dist = 34 + Math.random() * 22;
                dot.className = 'burst-dot';
                dot.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
                dot.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
                dot.style.background = burstColors[i % burstColors.length];
                dot.addEventListener('animationend', function () { this.remove(); });
                item.appendChild(dot);
            }
        });
    });

    /* ---------- Sidebar: a living graph. The cursor joins as a node;
       clicking sends a message-passing wave through the neighbors. ---------- */
    (function initGraph() {
        var host = document.querySelector('.sidebar');
        var cv = document.getElementById('graph-bg');
        if (!host || !cv || !cv.getContext) return;

        var ctx = cv.getContext('2d');
        var COLORS = ['139,95,191', '111,159,232', '242,160,123', '124,198,164'];
        var LINK = 105;       // max edge length, px
        var HOP_MS = 420;     // time for a message to cross one edge
        var MAX_HOPS = 4;
        var W = 0, H = 0, nodes = [], pulses = [], mouse = null;
        var lastT = 0, lastFire = 0;

        function makeNode() {
            var a = Math.random() * Math.PI * 2;
            var sp = 5 + Math.random() * 7;
            return {
                x: Math.random() * W, y: Math.random() * H,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                r: 2.2 + Math.random() * 2.2,
                c: COLORS[Math.floor(Math.random() * COLORS.length)],
                flash: -1e9
            };
        }

        function resize() {
            var content = 0;
            Array.prototype.forEach.call(host.children, function (ch) {
                if (ch !== cv) content += ch.offsetHeight;
            });
            W = host.clientWidth;
            H = Math.max(host.clientHeight, content + 80);
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.width = Math.round(W * dpr);
            cv.height = Math.round(H * dpr);
            cv.style.height = H + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            var want = Math.max(8, Math.min(28, Math.round((W * H) / 12500)));
            while (nodes.length < want) nodes.push(makeNode());
            nodes.length = want;
            nodes.forEach(function (n) {
                n.x = Math.min(n.x, W);
                n.y = Math.min(n.y, H);
            });
            if (reduceMotion) draw(performance.now());
        }

        function neighbors(n) {
            return nodes.filter(function (m) {
                return m !== n && Math.hypot(m.x - n.x, m.y - n.y) < LINK;
            });
        }

        function send(from, wave, now) {
            if (wave.hops >= MAX_HOPS) return;
            neighbors(from).forEach(function (to) {
                if (wave.seen.indexOf(to) !== -1) return;
                wave.seen.push(to);
                pulses.push({ a: from, b: to, t0: now, wave: wave, hop: wave.hops + 1 });
            });
        }

        function fire(node, now) {
            var wave = { seen: [node], hops: 0 };
            node.flash = now;
            send(node, wave, now);
            lastFire = now;
        }

        function draw(now) {
            ctx.clearRect(0, 0, W, H);
            var i, j, a, b, d;

            // edges
            ctx.lineWidth = 1;
            for (i = 0; i < nodes.length; i++) {
                for (j = i + 1; j < nodes.length; j++) {
                    a = nodes[i]; b = nodes[j];
                    d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK) {
                        ctx.strokeStyle = 'rgba(120,90,170,' + (1 - d / LINK) * 0.22 + ')';
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
            }

            // the cursor joins the graph
            if (mouse) {
                for (i = 0; i < nodes.length; i++) {
                    a = nodes[i];
                    d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
                    if (d < LINK * 1.2) {
                        ctx.strokeStyle = 'rgba(85,11,136,' + (1 - d / (LINK * 1.2)) * 0.45 + ')';
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
                    }
                }
            }

            // messages in flight
            for (i = pulses.length - 1; i >= 0; i--) {
                var p = pulses[i];
                var t = (now - p.t0) / HOP_MS;
                if (t >= 1) {
                    p.b.flash = now;
                    p.wave.hops = Math.max(p.wave.hops, p.hop);
                    send(p.b, p.wave, now);
                    pulses.splice(i, 1);
                    continue;
                }
                var x = p.a.x + (p.b.x - p.a.x) * t;
                var y = p.a.y + (p.b.y - p.a.y) * t;
                ctx.strokeStyle = 'rgba(85,11,136,0.35)';
                ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(x, y); ctx.stroke();
                ctx.fillStyle = 'rgba(85,11,136,0.85)';
                ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
            }

            // nodes
            for (i = 0; i < nodes.length; i++) {
                a = nodes[i];
                var f = Math.max(0, 1 - (now - a.flash) / 800);
                if (f > 0) {
                    ctx.strokeStyle = 'rgba(' + a.c + ',' + f * 0.6 + ')';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(a.x, a.y, a.r + (1 - f) * 16, 0, Math.PI * 2); ctx.stroke();
                    ctx.lineWidth = 1;
                }
                ctx.fillStyle = 'rgba(' + a.c + ',' + (0.55 + f * 0.45) + ')';
                ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (1 + f * 0.8), 0, Math.PI * 2); ctx.fill();
            }
        }

        function frame(now) {
            var dt = Math.min((now - lastT) / 1000, 0.05);
            lastT = now;
            nodes.forEach(function (n) {
                n.x += n.vx * dt; n.y += n.vy * dt;
                if (n.x < 0 || n.x > W) { n.vx *= -1; n.x = Math.max(0, Math.min(W, n.x)); }
                if (n.y < 0 || n.y > H) { n.vy *= -1; n.y = Math.max(0, Math.min(H, n.y)); }
            });
            // keep it alive when nobody is clicking
            if (now - lastFire > 6000 && !pulses.length) {
                fire(nodes[Math.floor(Math.random() * nodes.length)], now);
            }
            draw(now);
            requestAnimationFrame(frame);
        }

        function toLocal(e) {
            var r = cv.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }

        resize();
        window.addEventListener('resize', resize);
        if (reduceMotion) return;

        host.addEventListener('mousemove', function (e) { mouse = toLocal(e); });
        host.addEventListener('mouseleave', function () { mouse = null; });
        host.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            var p = toLocal(e), best = null, bestD = 160;
            nodes.forEach(function (n) {
                var d = Math.hypot(n.x - p.x, n.y - p.y);
                if (d < bestD) { bestD = d; best = n; }
            });
            if (best) fire(best, performance.now());
        });

        lastT = performance.now();
        lastFire = lastT - 4500;
        requestAnimationFrame(frame);
    })();
})();

/* ---------- Interests reel: a tiny looping "video" built from the icons.
   Built here so the page without JavaScript still shows the plain icon row. ---------- */
(function () {
    'use strict';

    var list = document.querySelector('.interest-list');
    var items = Array.prototype.slice.call(document.querySelectorAll('.interest'));
    if (!list || items.length !== 6) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ICON = 'assets/images/icons/';
    var NAMES = ['Badminton', 'Hiking', 'Rubik’s Cube', 'Musicals', 'Reading', 'Traveling'];
    var HINTS = ['drag a racket to hit the shuttlecock', 'drag me · tap to jump', 'spin the cube · tap the tiles', 'aim the light · tap for music', 'tap for ideas', 'tap to drop a pin'];
    var CUBE = ['#f6d27a', '#b9d3a0', '#f4b6b0', '#a9c4ea', '#f2b98a', '#fdf6e8'];
    var PAUSE_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="1"/><rect x="7" y="1.5" width="3" height="9" rx="1"/></svg>';
    var PLAY_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z"/></svg>';

    var ARROW_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="D" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function rep(n, fn) {
        var out = '';
        for (var i = 0; i < n; i++) out += fn(i);
        return out;
    }

    var reel = document.createElement('div');
    reel.className = 'reel';
    reel.setAttribute('role', 'group');
    reel.setAttribute('aria-label', 'Interests, animated');
    reel.innerHTML =
        '<div class="reel-bars">' + rep(6, function () { return '<span class="reel-bar"><i></i></span>'; }) + '</div>' +

        '<div class="reel-scene s-badminton">' +
            '<div class="court"></div><div class="net"></div>' +
            '<img class="reel-icon racket l" src="' + ICON + 'racket.png" alt="">' +
            '<img class="reel-icon racket r" src="' + ICON + 'racket.png" alt="">' +
            '<div class="shuttle-x"><div class="shuttle-y"><img class="shuttle" src="' + ICON + 'shuttlecock.png" alt=""></div></div>' +
        '</div>' +

        '<div class="reel-scene s-hiking">' +
            '<div class="sun"></div>' +
            '<div class="cloud c1"></div><div class="cloud c2"></div>' +
            '<div class="hills back"></div><div class="hills front"></div>' +
            '<img class="reel-icon hiker" src="' + ICON + 'hiking.png" alt="">' +
        '</div>' +

        '<div class="reel-scene s-cube">' +
            '<img class="reel-icon cube" src="' + ICON + 'cube.png" alt="">' +
            '<div class="cube-grid">' + rep(9, function () { return '<i></i>'; }) + '</div>' +
        '</div>' +

        '<div class="reel-scene s-musical">' +
            '<div class="spot"></div>' +
            '<img class="reel-icon star" src="' + ICON + 'musical.png" alt="">' +
            '<span class="note n1">♪</span><span class="note n2">♫</span><span class="note n3">♪</span><span class="note n4">♫</span>' +
            '<div class="curtain l"></div><div class="curtain r"></div>' +
        '</div>' +

        '<div class="reel-scene s-reading">' +
            '<span class="glyph g1">A</span><span class="glyph g2">文</span><span class="glyph g3">∑</span>' +
            '<span class="glyph g4">?</span><span class="glyph g5">✦</span><span class="glyph g6">π</span>' +
            '<img class="reel-icon book" src="' + ICON + 'reading.png" alt="">' +
        '</div>' +

        '<div class="reel-scene s-traveling">' +
            '<div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>' +
            '<svg class="route" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">' +
                '<path d="M40 175 Q 300 -40 560 80" fill="none" stroke="#8fb0dc" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 12" vector-effect="non-scaling-stroke"/>' +
            '</svg>' +
            '<span class="pin p1"></span><span class="pin p2"></span>' +
            '<img class="reel-icon globe" src="' + ICON + 'traveling.png" alt="">' +
        '</div>' +

        '<div class="reel-caption" aria-live="polite"></div>' +
        '<div class="reel-controls">' +
            '<button class="reel-prev" type="button" aria-label="Previous interest">' + ARROW_SVG.replace('D', 'M7.5 2.5 4 6l3.5 3.5') + '</button>' +
            '<button class="reel-toggle" type="button" aria-label="Pause">' + PAUSE_SVG + '</button>' +
            '<button class="reel-next" type="button" aria-label="Next interest">' + ARROW_SVG.replace('D', 'M4.5 2.5 8 6 4.5 9.5') + '</button>' +
        '</div>';

    list.parentNode.insertBefore(reel, list);
    list.style.display = 'none'; // the reel replaces the static icon row

    var scenes = reel.querySelectorAll('.reel-scene');
    var bars = reel.querySelectorAll('.reel-bar');
    var caption = reel.querySelector('.reel-caption');
    var toggle = reel.querySelector('.reel-toggle');
    var grid = reel.querySelector('.cube-grid');
    var cells = Array.prototype.slice.call(grid.querySelectorAll('i'));
    var cur = -1, tick = 0, cubeManual = false, justDragged = false, flight = 0, drags = [];

    function paint(cell, k) {
        cell.dataset.k = k;
        cell.style.background = CUBE[k];
    }

    function scramble() {
        grid.classList.remove('solved');
        cells.forEach(function (c) { paint(c, Math.floor(Math.random() * CUBE.length)); });
    }

    function go(i) {
        cur = (i + scenes.length) % scenes.length;
        Array.prototype.forEach.call(scenes, function (s, k) { s.classList.toggle('on', k === cur); });
        Array.prototype.forEach.call(bars, function (b, k) {
            b.classList.remove('on');
            b.classList.toggle('done', k < cur);
        });
        void reel.offsetWidth; // restart the progress animation
        bars[cur].classList.add('on');
        caption.innerHTML = NAMES[cur] + '<span class="reel-hint">' + HINTS[cur] + '</span>';
        items.forEach(function (it, k) { it.classList.toggle('active', k === cur); });
        resetPlay();
        if (cur === 2) { tick = 0; scramble(); }
    }

    reel.querySelector('.reel-bars').addEventListener('animationend', function (e) {
        if (e.target.parentNode === bars[cur]) go(cur + 1);
    });

    items.forEach(function (it, k) {
        it.addEventListener('click', function () { go(k); });
    });

    reel.querySelector('.reel-prev').addEventListener('click', function () { go(cur - 1); });
    reel.querySelector('.reel-next').addEventListener('click', function () { go(cur + 1); });

    toggle.addEventListener('click', function () {
        var paused = reel.classList.toggle('paused');
        toggle.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
        toggle.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    });

    // The cube scrambles for a while, then snaps to solved.
    setInterval(function () {
        if (cur !== 2 || cubeManual || reduceMotion || reel.classList.contains('paused') || reel.classList.contains('offscreen')) return;
        tick++;
        var phase = tick % 16;
        if (phase < 10) {
            scramble();
        } else if (phase === 10) {
            var solved = CUBE[Math.floor(tick / 16) % (CUBE.length - 1)];
            cells.forEach(function (c) { paint(c, CUBE.indexOf(solved)); });
            grid.classList.add('solved');
        }
    }, 260);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            reel.classList.toggle('offscreen', !entries[0].isIntersecting);
        }).observe(reel);
    }

    /* ----- Play: every scene can be dragged or tapped ----- */

    // Dragging uses the standalone `translate` property, so it stacks on top of
    // whatever `transform` animation the element is already running.
    function makeDrag(el, opts) {
        opts = opts || {};
        var cx = 0, cy = 0, sx = 0, sy = 0, ox = 0, oy = 0;
        var held = false, moved = false, vx = 0, vy = 0, lx = 0, ly = 0, lt = 0;

        function raw(x, y) {
            cx = x; cy = y;
            el.style.translate = x + 'px ' + y + 'px';
        }

        function clamped(x, y) {
            var r = el.getBoundingClientRect(), R = reel.getBoundingClientRect();
            var mx = r.left + r.width / 2 - cx + x, my = r.top + r.height / 2 - cy + y;
            x += Math.max(R.left + 12, Math.min(R.right - 12, mx)) - mx;
            y += Math.max(R.top + 12, Math.min(R.bottom - 12, my)) - my;
            raw(x, opts.axis === 'x' ? cy : y);
        }

        el.classList.add('grab');
        el.setAttribute('draggable', 'false');

        el.addEventListener('pointerdown', function (e) {
            if (e.button) return;
            held = true; moved = false;
            sx = lx = e.clientX; sy = ly = e.clientY; lt = e.timeStamp;
            if (opts.onStart) opts.onStart();
            ox = cx; oy = cy; vx = vy = 0;
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
            el.classList.add('held');
            reel.classList.add('holding');
            e.preventDefault();
        });

        el.addEventListener('pointermove', function (e) {
            if (!held) return;
            var dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            var dt = Math.max(e.timeStamp - lt, 1) / 1000;
            vx = vx * 0.5 + ((e.clientX - lx) / dt) * 0.5;
            vy = vy * 0.5 + ((e.clientY - ly) / dt) * 0.5;
            lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
            clamped(ox + dx, oy + dy);
            if (opts.onMove) opts.onMove(cx, cy);
        });

        function end(e) {
            if (!held) return;
            held = false;
            el.classList.remove('held');
            reel.classList.remove('holding');
            if (moved) {
                justDragged = true;
                setTimeout(function () { justDragged = false; }, 0);
                if (opts.onRelease) opts.onRelease(vx, vy);
            } else {
                if (opts.onRelease) opts.onRelease(0, 0);
                if (opts.onTap) opts.onTap(e);
            }
        }
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);

        var api = {
            raw: raw,
            pos: function () { return { x: cx, y: cy }; },
            isHeld: function () { return held; },
            reset: function () { el.style.transition = ''; raw(0, 0); if (opts.onMove) opts.onMove(0, 0); }
        };
        drags.push(api);
        return api;
    }

    function pop(scene, e, cls, text, color) {
        if (reduceMotion) return;
        var R = scene.getBoundingClientRect();
        var el = document.createElement('span');
        el.className = cls;
        if (text) el.textContent = text;
        if (color) el.style.color = color;
        el.style.left = (e.clientX - R.left) + 'px';
        el.style.top = (e.clientY - R.top) + 'px';
        el.addEventListener('animationend', function () { el.remove(); });
        scene.appendChild(el);
        return el;
    }

    function sceneTap(scene, fn) {
        scene.addEventListener('click', function (e) {
            if (justDragged) return;
            fn(e);
        });
    }

    function resetPlay() {
        flight++;
        cubeManual = false;
        drags.forEach(function (d) { d.reset(); });
        Array.prototype.forEach.call(reel.querySelectorAll('.play'), function (el) { el.classList.remove('play'); });
        Array.prototype.forEach.call(reel.querySelectorAll('.pop, .pin.dropped'), function (el) { el.remove(); });
    }

    // 1. Badminton: grab a racket (or the shuttlecock) and the looping rally becomes
    //    a playable one. The other racket stays put and returns what reaches it. After a few idle
    //    seconds everything glides home and the loop resumes.
    (function () {
        var scene = reel.querySelector('.s-badminton');
        var shEl = scene.querySelector('.shuttle-x');
        var shImg = scene.querySelector('.shuttle');
        var G = 650, IDLE_MS = 5000;
        var play = false, id = 0, last = 0, lastTouch = 0;
        var sx = 0, sy = 0, vx = 0, vy = 0, bx = 0, by = 0;
        var landed = false, landedAt = 0, user = null;

        function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

        function local(el, fx, fy) {
            var r = el.getBoundingClientRect(), R = reel.getBoundingClientRect();
            return { x: r.left - R.left + r.width * fx, y: r.top - R.top + r.height * fy };
        }

        function enter() {
            lastTouch = performance.now();
            if (play) return;
            var before = local(shEl, 0.5, 0.5);
            scene.classList.add('play');
            shEl.style.transition = '';
            shDrag.raw(0, 0);
            var base = local(shEl, 0.5, 0.5);
            bx = base.x; by = base.y;
            sx = before.x; sy = before.y; vx = vy = 0;
            shDrag.raw(sx - bx, sy - by);
            rackets.forEach(function (rk) {
                rk.el.style.transition = '';
                rk.hitAt = 0; rk.hvx = rk.hvy = 0; rk.px = null;
            });
            landed = false; play = true;
            id = ++flight;
            last = performance.now();
            requestAnimationFrame(step);
        }

        function swing(rk) {
            if (reduceMotion || !rk.el.animate) return;
            rk.el.animate(
                [{ rotate: '0deg' }, { rotate: (rk.dir * 28) + 'deg' }, { rotate: '0deg' }],
                { duration: 260, easing: 'ease-out' }
            );
        }

        function hit(rk, now, scale) {
            rk.hitAt = now;
            landed = false;
            if (rk === user) {
                vx = rk.dir * scale * clamp(430 + Math.abs(rk.hvx) * 0.35, 380, 700);
                vy = -clamp(340 - rk.hvy * 0.25, 240, 560);
                lastTouch = now;
            } else {
                vx = rk.dir * scale * (430 + Math.random() * 90);
                vy = -(330 + Math.random() * 70);
            }
            swing(rk);
        }

        function leave() {
            play = false;
            flight++;
            [shEl].concat(rackets.map(function (rk) { return rk.el; })).forEach(function (el) {
                el.style.transition = 'translate 0.45s ease';
            });
            shDrag.raw(0, 0);
            rackets.forEach(function (rk) { rk.drag.raw(0, 0); });
            setTimeout(function () {
                if (play) return;
                shEl.style.transition = '';
                rackets.forEach(function (rk) { rk.el.style.transition = ''; });
                shImg.style.rotate = '';
                scene.classList.remove('play');
                user = null;
            }, 470);
        }

        function step(now) {
            if (id !== flight) {           // the scene changed underneath us
                play = false; user = null;
                shImg.style.rotate = '';
                return;
            }
            var dt = Math.min((now - last) / 1000, 0.04);
            last = now;
            var R = reel.getBoundingClientRect();
            var W = R.width, H = R.height;
            var floor = H * 0.86, netX = W / 2, netTop = H * 0.42;
            var scale = clamp(W / 740, 0.55, 1);
            var holding = shDrag.isHeld();

            rackets.forEach(function (rk) {
                var h = local(rk.el, rk.fx, 0.29);
                if (rk.px !== null && dt > 0) {
                    rk.hvx = rk.hvx * 0.6 + ((h.x - rk.px) / dt) * 0.4;
                    rk.hvy = rk.hvy * 0.6 + ((h.y - rk.py) / dt) * 0.4;
                }
                rk.px = rk.hx = h.x; rk.py = rk.hy = h.y;
                rk.rad = rk.el.getBoundingClientRect().height * 0.3;
                if (rk.drag.isHeld()) { holding = true; lastTouch = now; }
            });

            // the racket nobody is holding stays where it is (it only swings in place)
            rackets.forEach(function (rk) {
                if (rk === user || rk.drag.isHeld()) return;
                var p = rk.drag.pos(), d = Math.hypot(p.x, p.y), max = 560 * scale * dt;
                if (d > 0) rk.drag.raw(d > max ? p.x * (1 - max / d) : 0, d > max ? p.y * (1 - max / d) : 0);
            });

            if (shDrag.isHeld()) {
                var q = shDrag.pos();
                sx = bx + q.x; sy = by + q.y; vx = vy = 0; landed = false;
            } else {
                if (!landed) {
                    var prev = sx;
                    vy += G * dt;
                    vx *= 1 - 0.25 * dt;
                    sx += vx * dt; sy += vy * dt;
                    if (sy > netTop && (prev - netX) * (sx - netX) < 0) { sx = prev; vx = -vx * 0.3; }
                    if (sx < 10) { sx = 10; vx = Math.abs(vx) * 0.5; }
                    if (sx > W - 10) { sx = W - 10; vx = -Math.abs(vx) * 0.5; }
                    rackets.forEach(function (rk) {
                        if (now - rk.hitAt < 350) return;
                        if (Math.hypot(sx - rk.hx, sy - rk.hy) < rk.rad + (rk === user ? 10 : 30)) hit(rk, now, scale);
                    });
                    if (sy > floor) { sy = floor; vx = vy = 0; landed = true; landedAt = now; }
                } else if (now - landedAt > 700) {
                    // serve again from the racket the player is not using
                    var server = rackets[0] === user ? rackets[1] : rackets[0];
                    sx = server.hx + server.dir * 18; sy = server.hy - 8;
                    hit(server, now, scale);
                }
                shDrag.raw(sx - bx, sy - by);
                if (Math.hypot(vx, vy) > 20) {
                    shImg.style.rotate = (Math.atan2(vy, vx) * 180 / Math.PI - 135) + 'deg';
                }
            }

            if (!holding && now - lastTouch > IDLE_MS) return leave();
            requestAnimationFrame(step);
        }

        var shDrag = makeDrag(shEl, {
            onStart: enter,
            onRelease: function (rvx, rvy) {
                vx = clamp(rvx, -900, 900);
                vy = clamp(rvy, -900, 900);
                lastTouch = performance.now();
            }
        });

        var rackets = [
            { el: scene.querySelector('.racket.l'), dir: 1, fx: 0.65 },
            { el: scene.querySelector('.racket.r'), dir: -1, fx: 0.35 }
        ];
        rackets.forEach(function (rk) {
            rk.hitAt = 0; rk.hvx = rk.hvy = 0; rk.px = null; rk.hx = rk.hy = 0; rk.rad = 28;
            rk.drag = makeDrag(rk.el, {
                onStart: function () { enter(); user = rk; },
                onTap: function () {
                    // a tap is a swing; it connects if the shuttlecock is within reach
                    var now = performance.now();
                    var R = reel.getBoundingClientRect();
                    swing(rk);
                    if (Math.hypot(sx - rk.hx, sy - rk.hy) < rk.rad + 48) {
                        hit(rk, now, clamp(R.width / 740, 0.55, 1));
                    }
                    lastTouch = now;
                }
            });
        });
    })();

    // 2. Hiking: drag the hiker along the trail; tap to jump.
    (function () {
        var hiker = reel.querySelector('.hiker');
        var drag = makeDrag(hiker, {
            axis: 'x',
            onTap: function () {
                if (reduceMotion || !hiker.animate) return;
                var x = drag.pos().x;
                hiker.animate(
                    [{ translate: x + 'px 0' }, { translate: x + 'px -44px' }, { translate: x + 'px 0' }],
                    { duration: 520, easing: 'cubic-bezier(0.3, 0, 0.5, 1)' }
                );
            }
        });
    })();

    // 3. Rubik's cube: drag to spin it; tap tiles to recolour them and solve the face yourself.
    (function () {
        var cube = reel.querySelector('.cube');
        makeDrag(cube, { onMove: function (x) { cube.style.rotate = (x * 1.4) + 'deg'; } });
        cells.forEach(function (cell) {
            cell.addEventListener('click', function () {
                cubeManual = true;
                paint(cell, ((+cell.dataset.k || 0) + 1) % CUBE.length);
                var first = cells[0].dataset.k;
                grid.classList.toggle('solved', cells.every(function (c) { return c.dataset.k === first; }));
            });
        });
    })();

    // 4. Musicals: the spotlight follows the pointer; tap anywhere for a note.
    (function () {
        var scene = reel.querySelector('.s-musical');
        var spot = scene.querySelector('.spot');
        makeDrag(scene.querySelector('.star'));
        scene.addEventListener('pointermove', function (e) {
            var R = scene.getBoundingClientRect();
            var t = (e.clientX - R.left) / R.width - 0.5;
            spot.classList.add('aim');
            spot.style.rotate = (-t * 70) + 'deg';
        });
        scene.addEventListener('pointerleave', function () {
            spot.classList.remove('aim');
            spot.style.rotate = '';
        });
        sceneTap(scene, function (e) {
            pop(scene, e, 'pop pop-note', Math.random() < 0.5 ? '♪' : '♫');
        });
    })();

    // 5. Reading: drag the book; tap anywhere for an idea.
    (function () {
        var scene = reel.querySelector('.s-reading');
        var glyphs = ['A', '文', '∑', '?', '✦', 'π', '∞', 'λ', 'あ', '&'];
        var colors = ['#e2733f', '#5b79b8', '#8b5fbf', '#d99a2b', '#7cc6a4'];
        makeDrag(scene.querySelector('.book'));
        sceneTap(scene, function (e) {
            pop(scene, e, 'pop pop-glyph',
                glyphs[Math.floor(Math.random() * glyphs.length)],
                colors[Math.floor(Math.random() * colors.length)]);
        });
    })();

    // 6. Traveling: drag the globe and the pins; tap the sky to drop a new pin.
    (function () {
        var scene = reel.querySelector('.s-traveling');
        makeDrag(scene.querySelector('.globe'));
        Array.prototype.forEach.call(scene.querySelectorAll('.pin'), function (p) { makeDrag(p); });
        sceneTap(scene, function (e) {
            if (e.target.closest('.pin, .globe')) return;
            if (scene.querySelectorAll('.pin.dropped').length >= 12) return;
            var R = scene.getBoundingClientRect();
            var pin = document.createElement('span');
            pin.className = 'pin dropped';
            pin.style.left = (e.clientX - R.left - 7) + 'px';
            pin.style.top = (e.clientY - R.top - 14) + 'px';
            scene.appendChild(pin);
        });
    })();

    go(0);
})();
