/* Learn with MK — Vocabulary (語彙) dashboard */
(function () {
  var DATA_URL = './data/vocab.json';
  var STORE_KEY = 'lwm-vocab-v1';
  var PAGE = 40;
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

  function injectShell() {
    if ($('#vocabDashboard')) return;
    var dash = document.createElement('div');
    dash.id = 'vocabDashboard';
    dash.innerHTML =
      '<div class="vocab-hero">' +
      '<div><h2>語彙 · ဝေါဟာရ</h2>' +
      '<p>JLPT N5–N1 · reading · English · မြန်မာ · examples</p></div>' +
      '<div class="vocab-stats" id="vocabStats"></div>' +
      '</div>' +
      '<button type="button" class="study-today" id="vocabToday">Today · N5 · 10 語彙</button>' +
      '<div class="vocab-level-tabs" id="vocabLevelTabs" role="tablist">' +
      ['n5', 'n4', 'n3', 'n2', 'n1']
        .map(function (lv, i) {
          return (
            '<button type="button" data-vlevel="' +
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
      '<div class="vocab-toolbar sticky-tools" id="vocabToolbar">' +
      '<input class="vocab-search" id="vocabSearch" type="search" placeholder="単語 / reading / English / မြန်မာ ရှာပါ..." />' +
      '<div class="vocab-filter" id="vocabFilter">' +
      '<button type="button" data-vfilter="all" class="active">All</button>' +
      '<button type="button" data-vfilter="learning">Learning</button>' +
      '<button type="button" data-vfilter="mastered">Mastered</button>' +
      '<button type="button" data-vfilter="fav">Saved</button>' +
      '<button type="button" data-vfilter="today">Today</button>' +
      '</div>' +
      '</div>' +
      '<div class="vocab-list" id="vocabList"></div>' +
      '<button type="button" class="load-more" id="vocabMore" hidden>Load more</button>' +
      '<p class="vocab-empty" id="vocabEmpty" hidden>No vocabulary match.</p>' +
      '<p class="vocab-source" id="vocabSource"></p>';
    document.body.appendChild(dash);

    var detail = document.createElement('div');
    detail.className = 'vocab-detail';
    detail.id = 'vocabDetail';
    detail.setAttribute('aria-hidden', 'true');
    detail.innerHTML =
      '<div class="vocab-detail-header">' +
      '<button type="button" id="vocabBack">‹ နောက်သို့</button>' +
      '<div style="flex:1"></div>' +
      '<button type="button" id="vocabSpeak">🔊 Read</button>' +
      '</div>' +
      '<div class="vocab-detail-scroll" id="vocabDetailBody"></div>';
    document.body.appendChild(detail);

    $('#vocabLevelTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vlevel]');
      if (!b) return;
      level = b.getAttribute('data-vlevel');
      todayIds = null;
      if (filter === 'today') filter = 'all';
      visible = PAGE;
      $all('#vocabLevelTabs button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      $all('#vocabFilter button').forEach(function (x) {
        x.classList.toggle('active', x.getAttribute('data-vfilter') === filter);
      });
      updateTodayBtn();
      renderList();
    });
    $('#vocabFilter').addEventListener('click', function (e) {
      var b = e.target.closest('[data-vfilter]');
      if (!b) return;
      filter = b.getAttribute('data-vfilter');
      if (filter === 'today' && !todayIds) startToday();
      visible = PAGE;
      $all('#vocabFilter button').forEach(function (x) {
        x.classList.toggle('active', x === b);
      });
      renderList();
    });
    $('#vocabSearch').addEventListener('input', function () {
      query = (this.value || '').trim().toLowerCase();
      visible = PAGE;
      renderList();
    });
    $('#vocabToday').addEventListener('click', function () {
      startToday();
      filter = 'today';
      visible = PAGE;
      $all('#vocabFilter button').forEach(function (x) {
        x.classList.toggle('active', x.getAttribute('data-vfilter') === 'today');
      });
      renderList();
    });
    $('#vocabMore').addEventListener('click', function () {
      visible += PAGE;
      renderList();
    });
    $('#vocabBack').addEventListener('click', closeDetail);
    $('#vocabSpeak').addEventListener('click', function () {
      if (!current) return;
      speak(current.r || current.w);
    });
    detail.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vact]');
      if (!b || !current) return;
      var act = b.getAttribute('data-vact');
      if (act === 'fav') toggleFav(current.id);
      if (act === 'learn') setProgress(current.id, 'learning');
      if (act === 'master') setProgress(current.id, 'mastered');
      if (act === 'clear') setProgress(current.id, null);
      refreshDetailActions();
      renderList();
    });
  }

  function ensureData() {
    if (data) return Promise.resolve(data);
    return fetch(DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('vocab load failed');
        return r.json();
      })
      .then(function (j) {
        data = j;
        var src = $('#vocabSource');
        if (src && j.meta) {
          src.innerHTML =
            'Data: <a href="https://github.com/evanclan/OpenJLPT" target="_blank" rel="noopener">' +
            escapeHtml(j.meta.source) +
            '</a> · ' +
            escapeHtml(j.meta.license) +
            '. ' +
            escapeHtml(j.meta.attribution || '');
        }
        return data;
      })
      .catch(function () {
        var list = $('#vocabList');
        if (list) list.innerHTML = '';
        var empty = $('#vocabEmpty');
        if (empty) {
          empty.hidden = false;
          empty.textContent = 'Vocabulary data could not load. Check data/vocab.json';
        }
      });
  }

  function listForLevel() {
    if (!data || !data.levels) return [];
    return data.levels[level] || [];
  }

  function matches(v) {
    var st = (store.progress[v.id] || {}).status || '';
    if (filter === 'learning' && st !== 'learning') return false;
    if (filter === 'mastered' && st !== 'mastered') return false;
    if (filter === 'fav' && !store.favorites[v.id]) return false;
    if (filter === 'today') {
      if (!todayIds || !todayIds[v.id]) return false;
    }
    if (!query) return true;
    var hay = [v.w, v.r, (v.en || []).join(' '), (v.my || []).join(' '), v.lv]
      .join(' ')
      .toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function updateTodayBtn() {
    var btn = $('#vocabToday');
    if (!btn) return;
    btn.textContent = 'Today · ' + level.toUpperCase() + ' · ' + TODAY_N + ' 語彙';
  }

  function startToday() {
    var pool = listForLevel().filter(function (v) {
      return (store.progress[v.id] || {}).status !== 'mastered';
    });
    if (!pool.length) pool = listForLevel().slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i];
      pool[i] = pool[j];
      pool[j] = t;
    }
    todayIds = {};
    pool.slice(0, TODAY_N).forEach(function (v) {
      todayIds[v.id] = true;
    });
    updateTodayBtn();
  }

  function myLine(myArr, enArr, forCard) {
    if (myArr && myArr[0]) return escapeHtml(forCard ? myArr[0] : myArr.join('၊ '));
    if (forCard) return '<span class="my-missing">မြန်မာ မရှိသေး</span>';
    return (
      '<span class="my-missing">မြန်မာ မရှိသေး · အောက်က English ကိုကြည့်ပါ</span>' +
      (enArr && enArr.length
        ? '<div class="en-fallback">' + escapeHtml(enArr.join(', ')) + '</div>'
        : '')
    );
  }

  function renderList() {
    var list = $('#vocabList');
    var empty = $('#vocabEmpty');
    var stats = $('#vocabStats');
    var more = $('#vocabMore');
    if (!list) return;
    updateTodayBtn();
    var items = listForLevel().filter(matches);
    var all = listForLevel();
    var mastered = all.filter(function (v) {
      return (store.progress[v.id] || {}).status === 'mastered';
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
      list.innerHTML = '';
      if (more) more.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (more) more.hidden = shown.length >= items.length;
    list.innerHTML = shown
      .map(function (v) {
        var st = (store.progress[v.id] || {}).status || '';
        var cls = 'vocab-card';
        if (st === 'mastered') cls += ' is-mastered';
        if (st === 'learning') cls += ' is-learning';
        if (store.favorites[v.id]) cls += ' is-fav';
        var reading = v.r && v.r !== v.w ? v.r : '';
        var en0 = (v.en && v.en[0]) || '';
        return (
          '<button type="button" class="' +
          cls +
          '" data-vid="' +
          v.id +
          '">' +
          '<span class="vw">' +
          escapeHtml(v.w) +
          '</span>' +
          '<span class="vr">' +
          escapeHtml(reading) +
          '</span>' +
          '<div class="ven' +
          (v.my && v.my[0] ? '' : ' ken-emphasis') +
          '">' +
          escapeHtml(en0) +
          '</div>' +
          '<div class="vmy">' +
          myLine(v.my, v.en, true) +
          '</div>' +
          '</button>'
        );
      })
      .join('');
    list.onclick = function (e) {
      var b = e.target.closest('[data-vid]');
      if (!b) return;
      var id = b.getAttribute('data-vid');
      var v = listForLevel().find(function (x) {
        return x.id === id;
      });
      if (v) openDetail(v);
    };
  }

  function openDetail(v) {
    current = v;
    var body = $('#vocabDetailBody');
    var ov = $('#vocabDetail');
    if (!body || !ov) return;
    var reading = v.r || '—';
    var exHtml = '';
    if (v.ex && v.ex.length) {
      exHtml =
        '<div class="vocab-block"><h3>Example · 例文</h3><ul class="vocab-ex">' +
        v.ex
          .map(function (ex) {
            return (
              '<li><div class="ja">' +
              escapeHtml(ex.ja) +
              '</div><div class="en">' +
              escapeHtml(ex.en) +
              '</div></li>'
            );
          })
          .join('') +
        '</ul></div>';
    }
    body.innerHTML =
      '<div class="vocab-detail-word">' +
      escapeHtml(v.w) +
      '</div>' +
      '<div class="vocab-detail-reading">' +
      escapeHtml(reading) +
      '</div>' +
      '<div class="vocab-detail-sub">' +
      escapeHtml(v.lv) +
      '</div>' +
      '<div class="vocab-actions" id="vocabActs"></div>' +
      '<div class="vocab-block"><h3>English</h3><div class="meanings' +
      (v.my && v.my.length ? '' : ' ken-emphasis') +
      '">' +
      escapeHtml((v.en || []).join(', ')) +
      '</div></div>' +
      '<div class="vocab-block"><h3>မြန်မာ</h3><div class="meanings my">' +
      (v.my && v.my.length ? escapeHtml(v.my.join('၊ ')) : myLine(null, v.en, false)) +
      '</div></div>' +
      exHtml;
    refreshDetailActions();
    ov.classList.remove('open');
    ov.style.visibility = 'visible';
    ov.style.pointerEvents = 'auto';
    ov.setAttribute('aria-hidden', 'false');
    if (window.lwmLockScroll) window.lwmLockScroll();
    document.body.classList.add('vocab-detail-open');
    void ov.offsetWidth;
    requestAnimationFrame(function () {
      ov.classList.add('open');
    });
  }

  function refreshDetailActions() {
    var el = $('#vocabActs');
    if (!el || !current) return;
    var st = (store.progress[current.id] || {}).status || '';
    var fav = !!store.favorites[current.id];
    el.innerHTML =
      '<button type="button" data-vact="fav" class="' +
      (fav ? 'on-fav' : '') +
      '">' +
      (fav ? '♥ Saved' : '♡ Save') +
      '</button>' +
      '<button type="button" data-vact="learn" class="' +
      (st === 'learning' ? 'on' : '') +
      '">Learning</button>' +
      '<button type="button" data-vact="master" class="' +
      (st === 'mastered' ? 'on-master' : '') +
      '">Mastered</button>' +
      (st ? '<button type="button" data-vact="clear">Clear status</button>' : '');
  }

  function closeDetail() {
    var ov = $('#vocabDetail');
    if (!ov) return;
    ov.classList.remove('open');
    ov.setAttribute('aria-hidden', 'true');
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      ov.style.visibility = 'hidden';
      ov.style.pointerEvents = 'none';
      document.body.classList.remove('vocab-detail-open');
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

  function onMode(mode) {
    if (mode === 'vocab') {
      ensureData().then(renderList);
    } else {
      closeDetail();
    }
  }

  function bootVocab() {
    injectShell();
    if (location.hash === '#vocab' && window.lwmSetAppMode) {
      window.lwmSetAppMode('vocab');
    }
  }

  window.lwmVocabOnMode = onMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootVocab);
  } else {
    bootVocab();
  }
})();
