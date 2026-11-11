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
        var greetings = ['Hello!', '你好!', 'Aloha!', 'Hi there!'];
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
