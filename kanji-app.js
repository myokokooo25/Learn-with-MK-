/* Learn with MK — Kanji dashboard */
(function () {
  var DATA_URL = './data/kanji.json';
  var STORE_KEY = 'lwm-kanji-v1';
  var PAGE = 48;
  var TODAY_N = 10;
  var data = null;
  var level = 'n5';
  var filter = 'all';
  var query = '';
  var current = null;
  var visible = PAGE;
  var todayIds = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }
  function saveStore(s) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  var store = loadStore();
  if (!store.progress) store.progress = {};
  if (!store.favorites) store.favorites = {};

  function kanjiVgUrl(ch) {
    var hex = ch.codePointAt(0).toString(16);
    while (hex.length < 5) hex = '0' + hex;
    return 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/' + hex + '.svg';
  }

  function injectShell() {
    if ($('#kanjiDashboard')) return;
    var dash = document.createElement('div');
    dash.id = 'kanjiDashboard';
    dash.innerHTML =
      '<div class="kanji-hero">' +
      '<div><h2>漢字 · ခန်းဂျိ</h2>' +
      '<p>JLPT N5–N1 · onyomi / kunyomi · English · မြန်မာ · strokes</p></div>' +
      '<div class="kanji-stats" id="kanjiStats"></div>' +
      '</div>' +
      '<button type="button" class="study-today" id="kanjiToday">Today · N5 · 10 漢字</button>' +
      '<div class="kanji-level-tabs" id="kanjiLevelTabs" role="tablist">' +
      ['n5', 'n4', 'n3', 'n2', 'n1']
        .map(function (lv, i) {
          return (
            '<button type="button" data-klevel="' +
            lv +
            '"' +
            (i === 0 ? ' class="active"' : '') +
            '>' +
            lv.toUpperCase() +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="kanji-toolbar sticky-tools" id="kanjiToolbar">' +
      '<input class="kanji-search" id="kanjiSearch" type="search" placeholder="漢字 / reading / English / မြန်မာ ရှာပါ..." />' +
      '<div class="kanji-filter" id="kanjiFilter">' +
      '<button type="button" data-kfilter="all" class="active">All</button>' +
      '<button type="button" data-kfilter="learning">Learning</button>' +
      '<button type="button" data-kfilter="mastered">Mastered</button>' +
      '<button type="button" data-kfilter="fav">Saved</button>' +
      '<button type="button" data-kfilter="today">Today</button>' +
      '</div>' +
      '</div>' +
      '<div class="kanji-grid" id="kanjiGrid"></div>' +
      '<button type="button" class="load-more" id="kanjiMore" hidden>Load more</button>' +
      '<p class="kanji-empty" id="kanjiEmpty" hidden>No kanji match.</p>' +
      '<p class="kanji-source" id="kanjiSource"></p>';
    document.body.appendChild(dash);

    var detail = document.createElement('div');
    detail.className = 'kanji-detail';
    detail.id = 'kanjiDetail';
    detail.setAttribute('aria-hidden', 'true');
    detail.innerHTML =
      '<div class="kanji-detail-header">' +
      '<button type="button" id="kanjiBack">‹ နောက်သို့</button>' +
      '<div style="flex:1"></div>' +
      '<button type="button" id="kanjiSpeak">🔊 Read</button>' +
      '</div>' +
      '<div class="kanji-detail-scroll" id="kanjiDetailBody"></div>';
    document.body.appendChild(detail);

    $('#kanjiLevelTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-klevel]');
      if (!b) return;
      level = b.getAttribute('data-klevel');
      todayIds = null;
      if (filter === 'today') filter = 'all';
      visible = PAGE;
      $all('#kanjiLevelTabs button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      $all('#kanjiFilter button').forEach(function (x) {
        x.classList.toggle('active', x.getAttribute('data-kfilter') === filter);
      });
      updateTodayBtn();
      renderGrid();
    });
    $('#kanjiFilter').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kfilter]');
      if (!b) return;
      filter = b.getAttribute('data-kfilter');
      if (filter === 'today' && !todayIds) startToday();
      visible = PAGE;
      $all('#kanjiFilter button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      renderGrid();
    });
    $('#kanjiSearch').addEventListener('input', function () {
      query = (this.value || '').trim().toLowerCase();
      visible = PAGE;
      renderGrid();
    });
    $('#kanjiToday').addEventListener('click', function () {
      startToday();
      filter = 'today';
      visible = PAGE;
      $all('#kanjiFilter button').forEach(function (x) {
        x.classList.toggle('active', x.getAttribute('data-kfilter') === 'today');
      });
      renderGrid();
    });
    $('#kanjiMore').addEventListener('click', function () {
      visible += PAGE;
      renderGrid();
    });
    $('#kanjiBack').addEventListener('click', closeDetail);
    $('#kanjiSpeak').addEventListener('click', function () {
      if (current) speak(current.c);
    });
    detail.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kact]');
      if (!b || !current) return;
      var act = b.getAttribute('data-kact');
      if (act === 'fav') toggleFav(current.id);
      if (act === 'learn') setProgress(current.id, 'learning');
      if (act === 'master') setProgress(current.id, 'mastered');
      if (act === 'clear') setProgress(current.id, null);
      refreshDetailActions();
      renderGrid();
    });
  }

  function injectModeSwitch() {
    var actions = $('.mast-actions');
    if (!actions || $('#modeSwitch')) return;
    var sw = document.createElement('div');
    sw.className = 'mode-switch';
    sw.id = 'modeSwitch';
    sw.innerHTML =
      '<button type="button" data-app-mode="grammar" class="active"><span class="ms-full">Grammar</span><span class="ms-short" aria-hidden="true">文</span></button>' +
      '<button type="button" data-app-mode="kanji"><span class="ms-full">Kanji</span><span class="ms-short" aria-hidden="true">漢</span></button>' +
      '<button type="button" data-app-mode="vocab"><span class="ms-full">Vocab</span><span class="ms-short" aria-hidden="true">語</span></button>';
    actions.insertBefore(sw, actions.firstChild);
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('[data-app-mode]');
      if (!b) return;
      setMode(b.getAttribute('data-app-mode'));
    });
  }

  function setMode(mode) {
    var isKanji = mode === 'kanji';
    var isVocab = mode === 'vocab';
    document.body.classList.toggle('mode-kanji', isKanji);
    document.body.classList.toggle('mode-vocab', isVocab);
    $all('#modeSwitch button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-app-mode') === mode);
    });
    var tag = $('.mast-tag');
    if (tag) {
      tag.textContent = isKanji
        ? 'JLPT kanji desk · Myanmar + English'
        : isVocab
          ? 'JLPT vocab desk · Myanmar + English'
          : 'JLPT grammar desk · Myanmar explanations';
    }
    var kicker = $('.mast-kicker');
    if (kicker) {
      kicker.textContent = isKanji
        ? '日本語漢字 · ဂျပန်ခန်းဂျိ'
        : isVocab
          ? '日本語語彙 · ဂျပန်ဝေါဟာရ'
          : '日本語文法 · ဂျပန်သဒ္ဒါ';
    }
    if (isKanji) {
      ensureData().then(renderGrid);
      try {
        history.replaceState({ lwmMode: 'kanji' }, '', '#kanji');
      } catch (e) {}
    } else if (isVocab) {
      closeDetail();
      try {
        history.replaceState({ lwmMode: 'vocab' }, '', '#vocab');
      } catch (e) {}
    } else {
      closeDetail();
      try {
        if (location.hash === '#kanji' || location.hash === '#vocab') {
          history.replaceState({}, '', location.pathname + location.search);
        }
      } catch (e) {}
    }
    if (window.lwmVocabOnMode) window.lwmVocabOnMode(mode);
  }

  function ensureData() {
    if (data) return Promise.resolve(data);
    return fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('kanji load failed');
        return r.json();
      })
      .then(function (j) {
        data = j;
        var src = $('#kanjiSource');
        if (src && j.meta) {
          src.innerHTML =
            'Data: <a href="https://github.com/evanclan/OpenJLPT" target="_blank" rel="noopener">' +
            escapeHtml(j.meta.source) +
            '</a> · ' +
            escapeHtml(j.meta.license) +
            '. Stroke diagrams via KanjiVG when online. ' +
            escapeHtml(j.meta.attribution || '');
        }
        return data;
      })
      .catch(function () {
        var g = $('#kanjiGrid');
        if (g) g.innerHTML = '';
        var empty = $('#kanjiEmpty');
        if (empty) {
          empty.hidden = false;
          empty.textContent = 'Kanji data could not load. Check data/kanji.json';
        }
      });
  }

  function listForLevel() {
    if (!data || !data.levels) return [];
    return data.levels[level] || [];
  }

  function matches(k) {
    var st = (store.progress[k.id] || {}).status || '';
    if (filter === 'learning' && st !== 'learning') return false;
    if (filter === 'mastered' && st !== 'mastered') return false;
    if (filter === 'fav' && !store.favorites[k.id]) return false;
    if (filter === 'today') {
      if (!todayIds || !todayIds[k.id]) return false;
    }
    if (!query) return true;
    var hay = [k.c, k.en.join(' '), k.my.join(' '), k.on.join(' '), k.kun.join(' '), k.lv]
      .join(' ')
      .toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function updateTodayBtn() {
    var btn = $('#kanjiToday');
    if (!btn) return;
    btn.textContent = 'Today · ' + level.toUpperCase() + ' · ' + TODAY_N + ' 漢字';
  }

  function startToday() {
    var pool = listForLevel().filter(function (k) {
      return (store.progress[k.id] || {}).status !== 'mastered';
    });
    if (!pool.length) pool = listForLevel().slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    todayIds = {};
    pool.slice(0, TODAY_N).forEach(function (k) {
      todayIds[k.id] = true;
    });
    updateTodayBtn();
  }

  function myLine(myArr, enArr, forCard) {
    if (myArr && myArr[0]) return escapeHtml(myArr[0]);
    if (forCard) return '<span class="my-missing">မြန်မာ မရှိသေး</span>';
    return (
      '<span class="my-missing">မြန်မာ မရှိသေး · အောက်က English ကိုကြည့်ပါ</span>' +
      (enArr && enArr.length
        ? '<div class="en-fallback">' + escapeHtml(enArr.join(', ')) + '</div>'
        : '')
    );
  }

  function renderGrid() {
    var grid = $('#kanjiGrid');
    var empty = $('#kanjiEmpty');
    var stats = $('#kanjiStats');
    var more = $('#kanjiMore');
    if (!grid) return;
    updateTodayBtn();
    var items = listForLevel().filter(matches);
    var all = listForLevel();
    var mastered = all.filter(function (k) {
      return (store.progress[k.id] || {}).status === 'mastered';
    }).length;
    var shown = items.slice(0, visible);
    if (stats) {
      stats.textContent =
        level.toUpperCase() +
        ' · ' +
        shown.length +
        (items.length > shown.length ? '+' : '') +
        ' / ' +
        all.length +
        ' · Mastered ' +
        mastered;
    }
    if (!items.length) {
      grid.innerHTML = '';
      if (more) more.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (more) more.hidden = shown.length >= items.length;
    grid.innerHTML = shown
      .map(function (k) {
        var st = (store.progress[k.id] || {}).status || '';
        var cls = 'kanji-card';
        if (st === 'mastered') cls += ' is-mastered';
        if (st === 'learning') cls += ' is-learning';
        if (store.favorites[k.id]) cls += ' is-fav';
        var en0 = (k.en && k.en[0]) || '';
        return (
          '<button type="button" class="' +
          cls +
          '" data-kid="' +
          k.id +
          '">' +
          '<span class="kc">' +
          escapeHtml(k.c) +
          '</span>' +
          '<div class="kmeta">' +
          k.st +
          ' strokes · ' +
          k.lv +
          '</div>' +
          '<div class="ken' +
          (k.my && k.my[0] ? '' : ' ken-emphasis') +
          '">' +
          escapeHtml(en0) +
          '</div>' +
          '<div class="kmy">' +
          myLine(k.my, k.en, true) +
          '</div>' +
          '</button>'
        );
      })
      .join('');
    grid.onclick = function (e) {
      var b = e.target.closest('[data-kid]');
      if (!b) return;
      var id = b.getAttribute('data-kid');
      var k = listForLevel().find(function (x) {
        return x.id === id;
      });
      if (k) openDetail(k);
    };
  }

  function openDetail(k) {
    current = k;
    var body = $('#kanjiDetailBody');
    var ov = $('#kanjiDetail');
    if (!body || !ov) return;
    var on = (k.on && k.on.length ? k.on.join('　') : '—');
    var kun = (k.kun && k.kun.length ? k.kun.join('　') : '—');
    body.innerHTML =
      '<div class="kanji-detail-char">' +
      escapeHtml(k.c) +
      '</div>' +
      '<div class="kanji-detail-sub">' +
      k.lv +
      ' · ' +
      k.st +
      ' strokes' +
      (k.fr && k.fr < 9999 ? ' · freq ' + k.fr : '') +
      '</div>' +
      '<div class="kanji-actions" id="kanjiActs"></div>' +
      '<div class="kanji-block"><h3>Onyomi · 音読み</h3><div class="readings">' +
      escapeHtml(on) +
      '</div></div>' +
      '<div class="kanji-block"><h3>Kunyomi · 訓読み</h3><div class="readings">' +
      escapeHtml(kun) +
      '</div></div>' +
      '<div class="kanji-block"><h3>English</h3><div class="meanings' +
      (k.my && k.my.length ? '' : ' ken-emphasis') +
      '">' +
      escapeHtml((k.en || []).join(', ')) +
      '</div></div>' +
      '<div class="kanji-block"><h3>မြန်မာ</h3><div class="meanings my">' +
      (k.my && k.my.length
        ? escapeHtml(k.my.join('၊ '))
        : myLine(null, k.en, false)) +
      '</div></div>' +
      '<div class="kanji-block"><h3>Stroke order · ' +
      k.st +
      ' strokes</h3>' +
      '<div class="kanji-stroke-wrap" id="kanjiStroke"><div class="stroke-fallback">Loading stroke diagram…</div></div>' +
      '</div>';
    refreshDetailActions();
    loadStroke(k.c);
    ov.classList.remove('open');
    ov.style.visibility = 'visible';
    ov.style.pointerEvents = 'auto';
    ov.setAttribute('aria-hidden', 'false');
    if (window.lwmLockScroll) window.lwmLockScroll();
    document.body.classList.add('kanji-detail-open');
    void ov.offsetWidth;
    requestAnimationFrame(function () {
      ov.classList.add('open');
    });
  }

  function refreshDetailActions() {
    var el = $('#kanjiActs');
    if (!el || !current) return;
    var st = (store.progress[current.id] || {}).status || '';
    var fav = !!store.favorites[current.id];
    el.innerHTML =
      '<button type="button" data-kact="fav" class="' +
      (fav ? 'on-fav' : '') +
      '">' +
      (fav ? '♥ Saved' : '♡ Save') +
      '</button>' +
      '<button type="button" data-kact="learn" class="' +
      (st === 'learning' ? 'on' : '') +
      '">Learning</button>' +
      '<button type="button" data-kact="master" class="' +
      (st === 'mastered' ? 'on-master' : '') +
      '">Mastered</button>' +
      (st
        ? '<button type="button" data-kact="clear">Clear status</button>'
        : '');
  }

  function loadStroke(ch) {
    var wrap = $('#kanjiStroke');
    if (!wrap) return;
    var url = kanjiVgUrl(ch);
    var img = new Image();
    img.alt = ch + ' stroke order';
    img.onload = function () {
      wrap.innerHTML = '';
      wrap.appendChild(img);
    };
    img.onerror = function () {
      wrap.innerHTML =
        '<div class="stroke-fallback">Stroke count: <strong>' +
        (current ? current.st : '?') +
        '</strong><br>Diagram unavailable offline. Open online to see KanjiVG stroke order.</div>';
    };
    img.src = url;
  }

  function closeDetail() {
    var ov = $('#kanjiDetail');
    if (!ov) return;
    ov.classList.remove('open');
    ov.setAttribute('aria-hidden', 'true');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      ov.style.visibility = 'hidden';
      ov.style.pointerEvents = 'none';
      document.body.classList.remove('kanji-detail-open');
      if (window.lwmUnlockScroll) window.lwmUnlockScroll();
    }
    ov.addEventListener('transitionend', function onEnd(e) {
      if (e.propertyName && e.propertyName.indexOf('transform') === -1) return;
      ov.removeEventListener('transitionend', onEnd);
      finish();
    });
    setTimeout(finish, 420);
  }

  function toggleFav(id) {
    if (store.favorites[id]) delete store.favorites[id];
    else store.favorites[id] = true;
    saveStore(store);
  }
  function setProgress(id, status) {
    if (!status) delete store.progress[id];
    else store.progress[id] = { status: status, updatedAt: Date.now() };
    saveStore(store);
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function bootKanji() {
    injectShell();
    // Wait for masthead from app-features
    var tries = 0;
    (function wait() {
      tries++;
      if ($('.mast-actions')) {
        injectModeSwitch();
        if (location.hash === '#kanji') setMode('kanji');
        else if (location.hash === '#vocab') setMode('vocab');
        return;
      }
      if (tries < 40) setTimeout(wait, 50);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootKanji);
  } else {
    bootKanji();
  }

  window.lwmSetAppMode = setMode;
})();
