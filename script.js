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

            var want = Math.max(10, Math.min(36, Math.round((W * H) / 9000)));
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
    var CUBE = ['#f6d27a', '#b9d3a0', '#f4b6b0', '#a9c4ea', '#f2b98a', '#fdf6e8'];
    var PAUSE_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="1"/><rect x="7" y="1.5" width="3" height="9" rx="1"/></svg>';
    var PLAY_SVG = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z"/></svg>';

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
            '<img class="reel-icon racket l" src="' + ICON + 'badminton.png" alt="">' +
            '<img class="reel-icon racket r" src="' + ICON + 'badminton.png" alt="">' +
            '<div class="shuttle-x"><div class="shuttle-y"></div></div>' +
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
        '<button class="reel-toggle" type="button" aria-label="Pause">' + PAUSE_SVG + '</button>';

    list.parentNode.insertBefore(reel, list);

    var scenes = reel.querySelectorAll('.reel-scene');
    var bars = reel.querySelectorAll('.reel-bar');
    var caption = reel.querySelector('.reel-caption');
    var toggle = reel.querySelector('.reel-toggle');
    var grid = reel.querySelector('.cube-grid');
    var cells = Array.prototype.slice.call(grid.querySelectorAll('i'));
    var cur = -1, tick = 0;

    function scramble() {
        grid.classList.remove('solved');
        cells.forEach(function (c) { c.style.background = CUBE[Math.floor(Math.random() * CUBE.length)]; });
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
        caption.textContent = NAMES[cur];
        items.forEach(function (it, k) { it.classList.toggle('active', k === cur); });
        if (cur === 2) { tick = 0; scramble(); }
    }

    reel.querySelector('.reel-bars').addEventListener('animationend', function (e) {
        if (e.target.parentNode === bars[cur]) go(cur + 1);
    });

    items.forEach(function (it, k) {
        it.addEventListener('click', function () { go(k); });
    });

    toggle.addEventListener('click', function () {
        var paused = reel.classList.toggle('paused');
        toggle.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
        toggle.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    });

    // The cube scrambles for a while, then snaps to solved.
    setInterval(function () {
        if (cur !== 2 || reduceMotion || reel.classList.contains('paused') || reel.classList.contains('offscreen')) return;
        tick++;
        var phase = tick % 16;
        if (phase < 10) {
            scramble();
        } else if (phase === 10) {
            var solved = CUBE[Math.floor(tick / 16) % (CUBE.length - 1)];
            cells.forEach(function (c) { c.style.background = solved; });
            grid.classList.add('solved');
        }
    }, 260);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            reel.classList.toggle('offscreen', !entries[0].isIntersecting);
        }).observe(reel);
    }

    go(0);
})();
