/* ============================================================
   诗词格律 · 古代汉语学习路径 —— 全部交互逻辑
   功能：节点导航 / 五段式渲染 / 点字看平仄 / 自测 / 进度续读 /
        速查表 / 例诗库 / 动效 / 平仄标注模式开关
   纯原生 JS，零依赖；数据来自 window.POETRY_DATA（data/data.js）
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  /** HTML 转义，避免数据中的特殊字符破坏页面 */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 格律术语表（文段内术语加粗强调；长词优先，避免子串误伤） */
  var TERMS = [
    '一三五不论', '二四六分明', '平水韵', '孤平拗救', '对句相救', '本句自救',
    '词林正韵', '诗韵举要', '流水对', '平上去入', '入声字', '平起平收',
    '韵脚', '同韵字', '押韵', '韵部', '邻韵', '出韵', '落韵', '合辙',
    '入声', '平声', '上声', '去声', '四声', '声调',
    '平仄', '仄声', '拗句', '拗救', '孤平', '变格', '对仗',
    '工对', '宽对', '邻对', '借对', '合掌', '律诗', '绝句', '古风',
    '词牌', '词谱', '填词', '双调', '单调', '小令', '三叠', '四叠', '又一体',
    '对句', '出句', '辙', '韵'
  ];
  function highlightTerms(text) {
    if (!text) return text;
    var tokens = {}, counter = 0;
    var re = new RegExp('(' + TERMS.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'g');
    var out = String(text).replace(re, function (m) {
      var key = '' + (counter++) + '';
      tokens[key] = m;
      return key;
    });
    for (var k in tokens) {
      out = out.split(k).join('<strong class="term">' + tokens[k] + '</strong>');
    }
    return out;
  }

  /** 富文本渲染：HTML 转义 → **加粗** → 术语竹青高亮 */
  function renderRich(text) {
    if (text == null) return '';
    var s = escapeHtml(text);
    var tokens = {}, counter = 0;
    s = s.replace(/\*\*([^*]+)\*\*/g, function (m, inner) {
      var k = '' + (counter++) + '';
      tokens[k] = '<strong class="md-bold">' + inner + '</strong>';
      return k;
    });
    var re = new RegExp('(' + TERMS.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'g');
    s = s.replace(re, function (m) {
      var k = '' + (counter++) + '';
      tokens[k] = '<strong class="term">' + m + '</strong>';
      return k;
    });
    for (var kk in tokens) s = s.split(kk).join(tokens[kk]);
    return s;
  }

  /* ---------------- 数据 ---------------- */
  var DATA = window.POETRY_DATA;
  var NODES = DATA.nodes;          // 已按 order 排序
  var POEMS = DATA.poems;          // 例诗库（4 首）
  var QUICKREF = DATA.quickref;    // 速查表

  /** 三个板块（规格书第 3 节，按 order 划分） */
  var SECTIONS = [
    { key: 'concept', label: '概念 · 诗韵',   from: 1,  to: 11 },
    { key: 'poetry',  label: '诗体 · 近体',   from: 12, to: 17 },
    { key: 'ci',      label: '词 · 词牌与词韵', from: 18, to: 20 }
  ];

  function nodeById(id) {
    for (var i = 0; i < NODES.length; i++) if (NODES[i].id === id) return NODES[i];
    return null;
  }
  function prevNode(node) { return NODES.find(function (n) { return n.order === node.order - 1; }) || null; }
  function nextNode(node) { return NODES.find(function (n) { return n.order === node.order + 1; }) || null; }

  /* ---------------- 进度（localStorage） ---------------- */
  var STORE_KEY = 'poetry_progress_v1';
  var progress = loadProgress();
  var toneMode = loadToneMode();

  function loadProgress() {
    var def = { completed: [], current: NODES[0].id, nodeRead: {} };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        return {
          completed: Array.isArray(p.completed) ? p.completed : [],
          current: p.current || def.current,
          nodeRead: p.nodeRead || {}
        };
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return def;
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* 隐私模式等 */ }
  }

  function loadToneMode() {
    try { return localStorage.getItem('poetry_tone_mode') || 'char'; } catch (e) { return 'char'; }
  }

  function isCompleted(id) { return progress.completed.indexOf(id) !== -1; }

  /** 锁定：未完成且前置节点未完成；当前节点与首个节点不算锁定 */
  function isLocked(node) {
    if (isCompleted(node.id)) return false;
    if (node.order === 1) return false;
    if (node.id === progress.current) return false;
    var prev = prevNode(node);
    return prev ? !isCompleted(prev.id) : false;
  }

  /* ---------------- 侧栏渲染 ---------------- */
  function renderSidebar() {
    var sb = $('#sidebar');
    var h = [];
    h.push('<div class="nav-brand">' +
             '<span class="brand-seal">学</span>' +
             '<h1>诗词格律</h1>' +
             '<p>学习路径 · 20 节点</p>' +
           '</div>' +
           '<div class="nav-divider"></div>');
    SECTIONS.forEach(function (sec) {
      var list = NODES.filter(function (n) { return n.order >= sec.from && n.order <= sec.to; });
      var done = list.filter(function (n) { return isCompleted(n.id); }).length;
      h.push('<div class="sec" data-sec="' + sec.key + '">');
      h.push('  <div class="sec-head"><span class="sec-label">' + escapeHtml(sec.label) +
             '</span><span class="sec-progress">' + done + '/' + list.length + '</span></div>');
      h.push('  <div class="sec-list">');
      list.forEach(function (n) { h.push(nodeItemHTML(n)); });
      h.push('  </div></div>');
    });
    sb.innerHTML = h.join('');
  }

  function nodeItemHTML(n) {
    var completed = isCompleted(n.id);
    var current = progress.current === n.id;
    var locked = isLocked(n);
    var cls = 'node-item';
    if (completed) cls += ' completed';
    if (current) cls += ' current';
    if (locked) cls += ' locked';
    var stamp = completed ? '<span class="seal-stamp">已习</span>' : '';
    var state = completed ? '<span class="node-state">✓</span>' : '';
    return '<div class="' + cls + '" data-id="' + n.id + '" title="' + escapeHtml(n.title) + '">' +
             '<span class="node-seal">' + escapeHtml(n.id) + '</span>' +
             '<span class="node-title">' + escapeHtml(n.title) + '</span>' + state + stamp +
           '</div>';
  }

  /** 高亮当前节点 */
  function updateCurrentSidebar(id) {
    $all('#sidebar .node-item.current').forEach(function (el) { el.classList.remove('current'); });
    var el = $('#sidebar .node-item[data-id="' + id + '"]');
    if (el) el.classList.add('current');
  }

  /* ---------------- 全局进度 UI ---------------- */
  function buildGlobalCells() {
    $('#gp-cells').innerHTML = NODES.map(function (n) {
      return '<span class="gp-cell" data-id="' + n.id + '" title="' + escapeHtml(n.title) + '"></span>';
    }).join('');
  }
  function updateProgressUI() {
    $('#gp-count').textContent = progress.completed.length;
    $all('#gp-cells .gp-cell').forEach(function (c) {
      c.classList.toggle('lit', isCompleted(c.dataset.id));
    });
    SECTIONS.forEach(function (sec) {
      var list = NODES.filter(function (n) { return n.order >= sec.from && n.order <= sec.to; });
      var done = list.filter(function (n) { return isCompleted(n.id); }).length;
      var el = $('#sidebar .sec[data-sec="' + sec.key + '"] .sec-progress');
      if (el) el.textContent = done + '/' + list.length;
    });
  }
  /** 重置全部学习进度（清 localStorage + 回到第一节点） */
  function resetProgress() {
    showConfirm('确定要重置全部学习进度吗？\n这会清空已完成的节点、答题记录与续读位置，从第一个节点重新开始。', function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      progress = { completed: [], current: NODES[0].id, nodeRead: {} };
      saveProgress();
      renderSidebar();
      renderNode(progress.current);
      updateProgressUI();
      toast('学习进度已重置');
    });
  }

  /* ============================================================
     节点五段式渲染
     ============================================================ */
  function buildNodeHTML(node) {
    var h = [];
    // 标题头
    h.push('<div class="node-header">' +
             '<div class="node-id-stamp">' + escapeHtml(node.id) + '</div>' +
             '<h2>' + escapeHtml(node.title) + '</h2></div>');

    // ① 目标条（block idx=0）
    h.push('<section class="block goal-bar" data-idx="0">' +
             '<span class="goal-tag">本节目标</span><p>' + renderRich(node.goal) + '</p></section>');

    // ② 内容各区块
    var idx = 1;
    node.content.forEach(function (c) {
      h.push(renderContentBlock(c, idx));
      idx++;
    });

    // ③ 自测（block idx 继续）
    h.push('<section class="block quiz-block" data-idx="' + idx + '">');
    h.push('<h3>自测 · 答对全部 4 题即完成本节</h3>');
    if (isCompleted(node.id)) {
      h.push('<div class="done-banner">✓ 本节已习 · 可进入下一节点</div>');
    }
    node.quiz.forEach(function (q, qi) {
      h.push(renderQuizQ(q, qi, node.id));
    });
    h.push('</section>');

    // ④ 下一步建议
    if (node.next) {
      h.push('<div class="next-box">' + renderRich(node.next) + '</div>');
    }

    // ⑤ 节点导航
    h.push(navHTML(node));

    return h.join('');
  }

  function renderContentBlock(c, idx) {
    var h = [];
    switch (c.type) {
      case 'explain':
        h.push('<section class="block explain" data-idx="' + idx + '">');
        h.push('<h3>' + escapeHtml(c.title) + '</h3>');
        c.paragraphs.forEach(function (p) { h.push('<p>' + renderRich(p) + '</p>'); });
        h.push('</section>');
        break;
      case 'table':
        h.push('<section class="block table-block" data-idx="' + idx + '">');
        h.push('<h3>' + escapeHtml(c.title) + '</h3><table>');
        h.push('<thead><tr>' + c.cols.map(function (x) { return '<th>' + escapeHtml(x) + '</th>'; }).join('') + '</tr></thead>');
        h.push('<tbody>');
        c.rows.forEach(function (r) {
          h.push('<tr>' + r.map(function (cell) { return '<td>' + renderRich(cell) + '</td>'; }).join('') + '</tr>');
        });
        h.push('</tbody></table></section>');
        break;
      case 'poems':
        h.push('<section class="block poem-block" data-idx="' + idx + '">');
        h.push('<h3>' + escapeHtml(c.title) + '</h3>');
        c.items.forEach(function (item) { h.push(renderPoemCard(item)); });
        h.push('</section>');
        break;
      case 'mistakes':
        h.push('<section class="block mistakes-block" data-idx="' + idx + '">');
        h.push('<h3>' + escapeHtml(c.title) + '</h3>');
        c.items.forEach(function (m) {
          h.push('<div class="mistake-card">' +
                   '<div class="mistake-wrong"><span class="mistake-tag">误区</span>' + renderRich(m.wrong) + '</div>' +
                   '<div class="mistake-right"><span class="mistake-tag ok">正解</span>' + renderRich(m.right) + '</div>' +
                 '</div>');
        });
        h.push('</section>');
        break;
      case 'quote':
        h.push('<section class="block quote-block" data-idx="' + idx + '">');
        h.push('<blockquote class="quote-text">' + renderRich(c.text) + '</blockquote>');
        h.push('<div class="quote-source">—— ' + escapeHtml(c.source) + '</div>');
        h.push('</section>');
        break;
      default:
        return '';
    }
    return h.join('');
  }

  /** 节点例诗卡：支持韵脚字（pinyin 字段）点字看拼音 */
  function renderPoemCard(item) {
    var hasPinyin = Array.isArray(item.pinyin) && item.pinyin.length > 0;
    var linesHtml;
    if (item.kind === 'ci' && Array.isArray(item.stanzas) && item.stanzas.length) {
      // 词：按上下阕排版（上阕/下阕 标签；同阕内句子连排、不逐句分行）
      linesHtml = item.stanzas.map(function (stanza, si) {
        var label = item.stanzas.length > 1
          ? (si === 0 ? '<span class="ci-duan">上阕</span>' : '<span class="ci-duan">下阕</span>')
          : '';
        return '<div class="ci-stanza">' + label + '<div class="ci-body">' + escapeHtml(stanza.join('')) + '</div></div>';
      }).join('');
    } else {
      var grouped = regroupLines(item.lines, hasPinyin ? item.pinyin : null);
      linesHtml = grouped.map(function (g) {
        var clean = g.text.replace(/\s*\([a-zA-Zāáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜü]+\)/g, '');
        var li = lastHanziIndex(clean);
        if (g.py && li >= 0) {
          return '<div class="poem-line">' +
                   escapeHtml(clean.slice(0, li)) +
                   '<span class="rhyme-char" data-py="' + escapeHtml(g.py) + '"><ruby>' + escapeHtml(clean[li]) + '<rt>' + escapeHtml(g.py) + '</rt></ruby></span>' +
                   escapeHtml(clean.slice(li + 1)) +
                 '</div>';
        }
        return '<div class="poem-line">' + escapeHtml(clean) + '</div>';
      }).join('');
    }
    var note = item.note ? '<div class="poem-note">' + renderRich(item.note) + '</div>' : '';
    var cardCls = item.kind === 'ci' ? 'poem-card ci-card' : 'poem-card';
    return '<div class="' + cardCls + '">' +
             '<div class="poem-title">' + escapeHtml(item.name) +
               '<span class="poem-author">' + escapeHtml(item.author) + '</span></div>' +
             '<div class="poem-lines">' + linesHtml + '</div>' + note +
           '</div>';
  }

  /** 找到一行中最后一个汉字的索引（韵脚字位置） */
  function lastHanziIndex(line) {
    for (var i = line.length - 1; i >= 0; i--) {
      if (/[一-鿿]/.test(line[i])) return i;
    }
    return -1;
  }

  /** 自测题渲染 */
  function renderQuizQ(q, qi, nodeId) {
    var opts = q.options.map(function (o) {
      return '<button class="quiz-opt" data-val="' + escapeHtml(o) + '">' + renderRich(o) + '</button>';
    }).join('');
    return '<div class="quiz-q" data-node="' + nodeId + '" data-qi="' + qi + '">' +
             '<div class="quiz-q-text"><span class="q-num">' + (qi + 1) + '</span>' + renderRich(q.q) + '</div>' +
             '<div class="quiz-opts">' + opts + '</div>' +
             '<div class="quiz-feedback"></div>' +
           '</div>';
  }

  /** 节点导航条 */
  function navHTML(node) {
    var prev = node.order > 1;
    var nxt = nextNode(node);
    var h = ['<div class="node-nav">'];
    h.push('<button class="btn secondary" id="btn-prev"' + (prev ? '' : ' disabled') + '>◀ 上一节点</button>');
    h.push('<button class="btn primary" id="btn-next">' + (nxt ? '标记完成 · 下一节点 ▶' : '完成本节') + '</button>');
    if (nxt) h.push('<button class="btn secondary" id="btn-skip">跳过</button>');
    h.push('</div>');
    return h.join('');
  }

  /* ---------------- 打开 / 渲染节点 ---------------- */
  function renderNode(id) {
    var node = nodeById(id);
    if (!node) return;
    progress.current = id;
    saveProgress();
    updateCurrentSidebar(id);

    // 先捕获续读位置，避免被下方 trackRead 的初始写入覆盖
    var resumeIdx = progress.nodeRead[id];

    var inner = $('#content-inner');
    inner.innerHTML = buildNodeHTML(node);

    // 展卷切换动效（动效 2）：重启动画
    inner.style.animation = 'none';
    void inner.offsetWidth;
    inner.style.animation = '';

    // 绑定本节点交互
    bindNav(node);
    setupRevealAndScroll(node);

    // 续读定位（滚动到上次区块并高亮）
    if (resumeIdx != null) {
      setTimeout(function () {
        var target = $('#content-inner .block[data-idx="' + resumeIdx + '"]');
        if (target) {
          target.scrollIntoView({ block: 'start' });
          target.classList.add('flash-target');
        }
      }, 90);
    } else {
      window.scrollTo(0, 0);
    }
  }

  /** 节点导航按钮绑定 */
  function bindNav(node) {
    var prevBtn = $('#btn-prev');
    var nextBtn = $('#btn-next');
    var skipBtn = $('#btn-skip');
    var prev = prevNode(node);
    var nxt = nextNode(node);

    if (prevBtn && prev) prevBtn.onclick = function () { renderNode(prev.id); };
    if (nextBtn) nextBtn.onclick = function () {
      if (!nxt) {
        if (!isCompleted(node.id)) markNodeComplete(node.id);
        toast('全部 20 个节点学习完成，祝贺！');
        return;
      }
      if (!isCompleted(node.id)) {
        showConfirm('本节点自测尚未全部答对，仍要标记完成并进入下一节点吗？', function () {
          markNodeComplete(node.id);
          renderNode(nxt.id);
        }, '标记完成并继续');
      } else {
        renderNode(nxt.id);
      }
    };
    if (skipBtn && nxt) skipBtn.onclick = function () { renderNode(nxt.id); };
  }

  /** 当前节点注册的滚动兜底处理器（每次渲染前移除，避免重复监听） */
  var currentScrollHandler = null;

  /** 段落渐显 + 续读区块追踪（动效 4 + 规格书 4.5）
      双保险：IntersectionObserver 为主路径；
      另加滚动兜底（同步/setTimeout，不依赖 rAF），保证弱环境可用。 */
  function setupRevealAndScroll(node) {
    var blocks = $all('#content-inner .block');
    blocks.forEach(function (b) { b.classList.add('reveal'); });

    /** 视口内的区块立即显现（带动效过渡） */
    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      blocks.forEach(function (b) {
        if (b.classList.contains('revealed')) return;
        var r = b.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) b.classList.add('revealed');
      });
    }

    /** 记录当前「正在阅读」的区块索引（视口 0–60% 内最靠上者） */
    function trackRead() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var best = -1, bestTop = 1e9;
      blocks.forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.top < vh * 0.6 && r.bottom > 0) {
          var top = Math.max(r.top, 0);
          if (top < bestTop) { bestTop = top; best = parseInt(b.dataset.idx, 10); }
        }
      });
      // 仅当索引变化时写入，减少 localStorage 压力
      if (best >= 0 && progress.nodeRead[node.id] !== best) {
        progress.nodeRead[node.id] = best;
        saveProgress();
      }
    }

    // 记录初始阅读位置；渐显延迟 30ms 让 opacity 过渡产生渐入效果
    trackRead();
    setTimeout(revealInView, 30);

    if ('IntersectionObserver' in window) {
      // 主路径（规格书要求）：与滚动兜底幂等，二者不会冲突
      var scrollIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            progress.nodeRead[node.id] = parseInt(en.target.dataset.idx, 10);
            saveProgress();
          }
        });
      }, { rootMargin: '0px 0px -40% 0px' });

      var fadeIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('revealed');
            fadeIO.unobserve(en.target);
          }
        });
      }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

      blocks.forEach(function (b) { scrollIO.observe(b); fadeIO.observe(b); });
    }

    // 滚动兜底（直接调用，不依赖 rAF）
    function onScroll() {
      revealInView();
      trackRead();
    }
    if (currentScrollHandler) window.removeEventListener('scroll', currentScrollHandler);
    currentScrollHandler = onScroll;
    window.addEventListener('scroll', currentScrollHandler, { passive: true });
  }

  /* ---------------- 自测答题逻辑 ---------------- */
  function onQuizOptClick(opt) {
    var qEl = opt.closest('.quiz-q');
    if (!qEl || qEl.dataset.done === '1') return;
    var nodeId = qEl.dataset.node;
    var qi = parseInt(qEl.dataset.qi, 10);
    var node = nodeById(nodeId);
    if (!node) return;
    var q = node.quiz[qi];
    var val = opt.dataset.val;
    var correct = optionMatches(val, q.answer);
    var fb = $('.quiz-feedback', qEl);
    var opts = $all('.quiz-opt', qEl);

    opts.forEach(function (o) { o.classList.remove('wrong'); });

    if (correct) {
      // 答对：黛青高亮 + 必显解析
      qEl.dataset.done = '1';
      qEl.dataset.ok = '1';
      opt.classList.add('correct');
      fb.innerHTML = '<div class="fb-correct">✓ 回答正确</div>' +
                     '<div class="fb-explain">' + renderRich(q.explain) + '</div>';
      fb.classList.add('show');
      checkNodeQuizComplete(nodeId);
    } else {
      if (qEl.dataset.attempt === '1') {
        // 第二次答错：显示正确答案 + 解析（温和节奏）
        qEl.dataset.done = '1';
        opt.classList.add('wrong');
        var correctOpt = opts.find(function (o) { return optionMatches(o.dataset.val, q.answer); });
        if (correctOpt) correctOpt.classList.add('correct');
        fb.innerHTML = '<div class="fb-wrong">✗ 正确答案是「' + escapeHtml(q.answer) + '」</div>' +
                       '<div class="fb-explain">' + renderRich(q.explain) + '</div>';
        fb.classList.add('show');
      } else {
        // 第一次答错：提示再试一次，可重选
        qEl.dataset.attempt = '1';
        opt.classList.add('wrong');
        fb.innerHTML = '<div class="fb-wrong">✗ 再试一次</div>';
        fb.classList.add('show');
      }
    }
  }

  /** 选项与答案匹配：支持 "A." 前缀 与 直接相等（对/错） */
  function optionMatches(opt, ans) {
    if (opt === ans) return true;
    return opt.indexOf(ans + '.') === 0 || opt.indexOf(ans + '．') === 0;
  }

  /** 全部 4 题答对 → 节点完成 */
  function checkNodeQuizComplete(nodeId) {
    var node = nodeById(nodeId);
    if (!node) return;
    var qEls = $all('.quiz-q[data-node="' + nodeId + '"]');
    if (qEls.length !== node.quiz.length) return;
    var allOk = qEls.every(function (el) { return el.dataset.ok === '1'; });
    if (allOk) markNodeComplete(nodeId);
  }

  /* ---------------- 节点完成（盖章 + 解锁 + 进度点亮） ---------------- */
  function markNodeComplete(nodeId) {
    if (isCompleted(nodeId)) return;
    progress.completed.push(nodeId);
    saveProgress();

    // 侧栏节点项：盖章动画 + 状态更新
    var item = $('#sidebar .node-item[data-id="' + nodeId + '"]');
    if (item) {
      item.classList.add('completed', 'just-completed');
      item.classList.remove('locked');
      if (!item.querySelector('.seal-stamp')) {
        var stamp = document.createElement('span');
        stamp.className = 'seal-stamp';
        stamp.textContent = '已习';
        item.appendChild(stamp);
      }
      var st = $('.node-state', item);
      if (st) st.textContent = '✓';
    }

    // 解锁下一节点：墨点扩散（动效 3）
    var node = nodeById(nodeId);
    if (node) {
      var nxt = nextNode(node);
      if (nxt) {
        var nxtEl = $('#sidebar .node-item[data-id="' + nxt.id + '"]');
        if (nxtEl) {
          nxtEl.classList.remove('locked');
          nxtEl.classList.add('unlock-anim');
          setTimeout(function () { nxtEl.classList.remove('unlock-anim'); }, 700);
        }
      }
    }

    // 进度条点亮（动效 6）
    updateProgressUI();

    // 若当前正在看此节点，刷新其完成横幅
    if (progress.current === nodeId) {
      var inner = $('#content-inner');
      var quizBlock = $('.quiz-block', inner);
      if (quizBlock && !quizBlock.querySelector('.done-banner')) {
        var banner = document.createElement('div');
        banner.className = 'done-banner';
        banner.textContent = '✓ 本节已习 · 可进入下一节点';
        quizBlock.insertBefore(banner, quizBlock.firstChild);
      }
    }

    toast('本节已完成 · 已解锁下一节点');
  }

  /* ============================================================
     点字看平仄（例诗库逐字 + 节点例诗韵脚拼音）
     ============================================================ */
  function toneLabel(tone) {
    if (toneMode === 'symbol') return tone === '平' ? '○' : (tone === '仄' ? '●' : '—');
    return tone || '—';
  }

  function showTooltip(anchor, html) {
    var tip = $('#tooltip');
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    var rect = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var x = rect.left + rect.width / 2 - tw / 2;
    var y = rect.top - th - 12;
    if (y < 10) y = rect.bottom + 12;          // 上方放不下则放到下方
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    // 触发出现过渡
    void tip.offsetWidth;
    tip.classList.add('visible');
  }
  function hideTooltip() {
    var tip = $('#tooltip');
    tip.classList.remove('visible');
    tip.classList.add('hidden');
  }

  /** 例诗库诗句 → 逐字 span（按 tones 标注平仄） */
  function charSpans(line, tones) {
    var html = '';
    var ti = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (/[一-鿿]/.test(ch)) {
        var t = tones ? (tones[ti] || '') : '';
        html += '<span class="tone-char" data-tone="' + escapeHtml(t) + '">' + escapeHtml(ch) + '</span>';
        ti++;
      } else {
        html += escapeHtml(ch);
      }
    }
    return html;
  }

  /** 例诗库卡（poems.json，支持逐字点平仄） */
  function renderLibraryPoem(p) {
    var hasTones = Array.isArray(p.tones);
    var linesHtml = '';
    for (var li = 0; li < p.lines.length; li += 2) {
      var lineA = p.lines[li] || '';
      var lineB = p.lines[li + 1] || '';
      var merged = hasTones
        ? (Array.isArray(p.tones[li]) ? p.tones[li] : []).concat(Array.isArray(p.tones[li + 1]) ? p.tones[li + 1] : [])
        : [];
      var hasTone = merged.some(function (t) { return !!t; });
      linesHtml += '<div class="poem-line' + (hasTone ? ' tone-line' : '') + '" data-li="' + li + '">' +
                     charSpans(lineA + lineB, hasTone ? merged : null) +
                   '</div>';
    }

    var tags = (p.keywords && p.keywords.length)
      ? '<div class="poem-tags">' + p.keywords.map(function (k) { return '<span class="chip small">' + escapeHtml(k) + '</span>'; }).join('') + '</div>'
      : '';
    return '<div class="poem-card lib-poem">' +
             '<div class="poem-head">' + escapeHtml(p.title) +
               '<span class="poem-author">' + escapeHtml(p.author) + '</span></div>' +
             '<div class="poem-form">' + escapeHtml(p.form) + '</div>' +
             '<div class="poem-lines big">' + linesHtml + '</div>' +
             (p.analysis ? '<div class="poem-analysis"><span class="tag">赏析</span>' + escapeHtml(p.analysis) + '</div>' : '') +
             (p.source_note ? '<div class="poem-source"><span class="tag">平仄依据</span>' + escapeHtml(p.source_note) + '</div>' : '') +
             tags +
           '</div>';
  }

  /* ============================================================
     速查表页签
     ============================================================ */
  function renderQuickref() {
    var el = $('#quickref-view');
    if (el.dataset.built === '1') { openAccordion(el); return; }

    var h = [];
    h.push('<h2 class="qr-title">速查表</h2>');
    h.push('<p class="qr-note">汇集平水韵、绝句平仄格式、入声字、邻韵通用、词林正韵与对仗分类，供随时查阅。</p>');

    h.push(accPanel('pingshui', '平水韵 106 韵', renderPingshui(QUICKREF.pingshui106)));
    h.push(accPanel('jueju', '绝句平仄格式速查', renderJueju(QUICKREF.jueju_formats)));
    h.push(accPanel('rusheng', '常用入声字表', renderRusheng(QUICKREF.rusheng)));
    h.push(accPanel('linyun', '古体诗邻韵通用', renderLinyun(QUICKREF.linyun)));
    h.push(accPanel('cilin', '词林正韵十九部', renderCilin(QUICKREF.cilin)));
    h.push(accPanel('duizhang', '对仗分类', renderDuizhang(QUICKREF.duizhang)));

    // 例诗库专区（规格书 4.7）
    h.push('<h2 class="qr-title" style="margin-top:28px">例诗库</h2>');
    h.push('<p class="qr-note">以下四首诗为正文逐字标注平仄的例诗：点击任一字查看平仄，整句联动着色（平＝黛青，仄＝朱砂）。</p>');
    h.push('<div class="poem-library">');
    POEMS.forEach(function (p) { h.push(renderLibraryPoem(p)); });
    h.push('</div>');

    el.innerHTML = h.join('');
    el.dataset.built = '1';
    openAccordion(el);
  }

  function accPanel(key, title, body) {
    return '<div class="acc" data-acc="' + key + '">' +
             '<button class="acc-head"><span>' + escapeHtml(title) + '</span><span class="acc-arrow">▶</span></button>' +
             '<div class="acc-body">' + body + '</div>' +
           '</div>';
  }

  /** 手风琴折叠：点击展开，其余收起；每次进入默认只展开第一块 */
  function openAccordion(el) {
    $all('.acc', el).forEach(function (acc, i) {
      var head = $('.acc-head', acc);
      var body = $('.acc-body', acc);
      head.onclick = function () {
        var isOpen = head.classList.contains('open');
        $all('.acc-head.open', el).forEach(function (b) {
          b.classList.remove('open');
          b.nextElementSibling.classList.remove('open');
        });
        if (!isOpen) {
          head.classList.add('open');
          body.classList.add('open');
        }
      };
      // 重入时归位：仅第一块展开，其余收起（幂等）
      if (i === 0) {
        head.classList.add('open');
        body.classList.add('open');
      } else {
        head.classList.remove('open');
        body.classList.remove('open');
      }
    });
  }

  /* ---- 速查表各板块渲染 ---- */
  function renderPingshui(s) {
    var groups = s.groups.map(function (g) {
      return '<div class="qr-sub"><h4>' + escapeHtml(g.name) + '</h4>' +
             '<div class="chip-wrap">' + g.items.map(function (i) { return '<span class="chip">' + escapeHtml(i) + '</span>'; }).join('') + '</div></div>';
    }).join('');
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + groups +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  /** 平仄格式图例条（含王力标注符号说明） */
  function renderFormatLegend() {
    return '<div class="fmt-legend">' +
             '<span class="legend-title">图例</span>' +
             '<span class="lg"><span class="dot d-ping"></span>平声</span>' +
             '<span class="lg"><span class="dot d-ze"></span>仄声</span>' +
             '<span class="lg"><span class="dot d-flex"></span>可平可仄</span>' +
             '<span class="lg"><span class="dot d-rhyme"></span>△ 韵脚</span>' +
             '<div class="legend-note">' +
               '圈内数字（如 ④⑤⑥⑦）表示该字<b>可平可仄</b>，数字是编号（第几个灵活位），不是“第几个字”；' +
               '△ 标记句尾<b>韵脚</b>；□ 为占位（七言在五言基础上多出的两个“虚位”）。' +
             '</div>' +
           '</div>';
  }

  /** 按句末标点拆分：只以 。？！； 分句，逗号留在句内 */
  function splitSentences(line) {
    var m = line.match(/[^。？！；]*[。？！；]/g);
    if (!m || !m.length) { var t = (line || '').trim(); return t ? [t] : []; }
    return m.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /** 拆半句（按 ，。？！； 均可断；半句=一联的一半） */
  function splitHalfs(line) {
    var m = line.match(/[^，。？！；]*[，。？！；]/g);
    if (!m || !m.length) { var t = (line || '').trim(); return t ? [t] : []; }
    return m.map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /** 律诗绝句按「一联一行」重排：先拆半句，再两两成联（出句+对句一行） */
  function regroupLines(lines, pinyins) {
    var halfs = [];
    lines.forEach(function (l, idx) {
      splitHalfs(l).forEach(function (h) {
        halfs.push({ text: h, py: (pinyins && pinyins[idx]) ? pinyins[idx] : null });
      });
    });
    var result = [];
    for (var i = 0; i < halfs.length; i += 2) {
      var t = halfs[i].text + (halfs[i + 1] ? halfs[i + 1].text : '');
      var py = halfs[i + 1] ? halfs[i + 1].py : halfs[i].py;
      result.push({ text: t, py: py });
    }
    return result;
  }

  /** 单句内逐字 chip（可平可仄圈号 / 平仄 / 韵脚） */
  function renderChips(text) {
    var out = [], flex = false, i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (/[①-⑩]/.test(ch)) { flex = true; i++; continue; }
      if (ch === '平' || ch === '仄') {
        var isPing = ch === '平';
        if (flex) { out.push('<span class="fmt-chip flex">' + (toneMode === 'symbol' ? '○/●' : '平/仄') + '</span>'); }
        else { out.push('<span class="fmt-chip ' + (isPing ? 'ping' : 'ze') + '">' + (toneMode === 'symbol' ? (isPing ? '○' : '●') : ch) + '</span>'); }
        flex = false; i++; continue;
      }
      if (ch === '○' || ch === '●') {
        var p = ch === '○';
        out.push('<span class="fmt-chip ' + (flex ? 'flex' : p ? 'ping' : 'ze') + '">' + (toneMode === 'symbol' ? ch : (p ? '平' : '仄')) + '</span>');
        flex = false; i++; continue;
      }
      if (ch === '□') { out.push('<span class="fmt-chip slot">·</span>'); i++; continue; }
      if (ch === '△' || ch === 'Δ') { out.push('<span class="fmt-rhyme">△</span>'); i++; continue; }
      if (ch === '，' || ch === '。' || ch === '；' || ch === '、') { out.push('<span class="fmt-punct">' + ch + '</span>'); i++; continue; }
      if (ch === ' ') { i++; continue; }
      out.push('<span class="fmt-other">' + escapeHtml(ch) + '</span>'); i++;
    }
    return out.join('');
  }

  /** 平仄格式逐字可视化（一句一行，按句末标点分句，逗号句内） */
  function renderFormatLine(line) {
    if (!line) return '';
    var sentences = splitSentences(line);
    if (!sentences.length) return '';
    return '<span class="fmt-line">' + sentences.map(function (s) {
      return '<span class="fmt-sentence">' + renderChips(s) + '</span>';
    }).join('') + '</span>';
  }

  /** 格式 ↔ 例诗 切换区 */
  function fmtSwitchHTML(poem) {
    if (!poem || !poem.lines) return '';
    var pl = regroupLines(poem.lines).map(function (g) {
      return '<div class="fmt-poem-line">' + escapeHtml(g.text) + '</div>';
    }).join('');
    return '<div class="fmt-switch">' +
             '<button class="fmt-toggle" data-title="' + escapeHtml(poem.title) + '">看诗《' + escapeHtml(poem.title) + '》</button>' +
             '<div class="fmt-poem" hidden>' + pl +
               '<div class="fmt-poem-meta">' + escapeHtml(poem.author) + '《' + escapeHtml(poem.title) + '》</div>' +
             '</div>' +
           '</div>';
  }

  function renderJueju(s) {
    var legend = renderFormatLegend();
    // 五绝四种格式 → 对比表（格式 / 平仄可视化 + 看诗切换 / 例诗）
    var wtable = '<table class="qr-table fmt-table"><thead><tr><th>格式</th><th>平仄格式</th><th>例诗</th></tr></thead><tbody>';
    s.wujue.forEach(function (w) {
      var fl = w.lines.map(function (l) { return '<div class="fmt-row">' + renderFormatLine(l) + '</div>'; }).join('');
      wtable += '<tr><td class="fmt-name">' + escapeHtml(w.name) + '</td>' +
                '<td><div class="fmt-format">' + fl + '</div>' + fmtSwitchHTML(w.poem) + '</td>' +
                '<td class="fmt-example">' + escapeHtml(w.example) + '</td></tr>';
    });
    wtable += '</tbody></table>';
    // 七言律绝四种句式比较（可视化）
    var cmp = s.qijue_compare;
    var ctable = '<table class="qr-table"><thead><tr><th>句式</th><th>五言</th><th>七言</th></tr></thead><tbody>' +
                 cmp.rows.map(function (r) {
                   return '<tr><td>' + escapeHtml(r.name) + '</td><td>' + renderFormatLine(r.five) + '</td><td>' + renderFormatLine(r.seven) + '</td></tr>';
                 }).join('') + '</tbody></table>';
    var qf = s.qijue_first;
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + legend +
           '<h4>五言绝句四种格式</h4>' + wtable +
           '<h4>' + escapeHtml(cmp.title) + '</h4>' + ctable +
           '<div class="qr-card"><h4>' + escapeHtml(qf.name) + '</h4>' +
           '<div class="fmt-format">' + qf.lines.map(function (l) { return '<div class="fmt-row">' + renderFormatLine(l) + '</div>'; }).join('') + '</div>' +
           fmtSwitchHTML(qf.poem) +
           '<div class="qr-example">例：' + escapeHtml(qf.example) + '</div></div>' +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  function renderRusheng(s) {
    var groups = s.groups.map(function (g) {
      return '<details class="rs-group"><summary>' + escapeHtml(g.name) + '（' + g.chars.length + ' 字）</summary>' +
             '<div class="rs-chars">' + escapeHtml(g.chars) + '</div></details>';
    }).join('');
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + groups +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  function renderLinyun(s) {
    var groups = s.groups.map(function (g) {
      return '<div class="qr-card"><h4>' + escapeHtml(g.name) + '</h4><div>' + escapeHtml(g.desc) + '</div></div>';
    }).join('');
    var r8 = s.rusheng_8;
    var r8html = '<div class="qr-card" style="margin-top:10px"><h4>' + escapeHtml(r8.title) + '</h4>' +
                 '<div class="chip-wrap">' + r8.groups.map(function (g) { return '<span class="chip">' + escapeHtml(g) + '</span>'; }).join('') + '</div>' +
                 (r8.note ? '<div class="qr-example">' + escapeHtml(r8.note) + '</div>' : '') + '</div>';
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + groups + r8html +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  function renderCilin(s) {
    var groups = s.groups.map(function (g) {
      return '<div class="qr-card"><h4>' + escapeHtml(g.name) + '</h4><div>' + escapeHtml(g.desc) + '</div></div>';
    }).join('');
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + groups +
           (s.note ? '<div class="acc-intro">' + escapeHtml(s.note) + '</div>' : '') +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  function renderDuizhang(s) {
    var groups = s.groups.map(function (g) {
      return '<div class="qr-card"><h4>' + escapeHtml(g.name) + '</h4><div>' + escapeHtml(g.desc) + '</div></div>';
    }).join('');
    var nc = s.noun_classes;
    return '<p class="acc-intro">' + escapeHtml(s.intro) + '</p>' + groups +
           '<h4>' + escapeHtml(nc.title) + '</h4>' +
           '<div class="chip-wrap">' + nc.items.map(function (i) { return '<span class="chip">' + escapeHtml(i) + '</span>'; }).join('') + '</div>' +
           (s.quotes ? '<div class="acc-intro">' + escapeHtml(s.quotes) + '</div>' : '') +
           '<p class="acc-source">来源：' + escapeHtml(s.source) + '</p>';
  }

  /* ============================================================
     页签切换
     ============================================================ */
  function switchTab(tab) {
    if (tab === 'quickref') {
      $('#path-view').classList.add('hidden');
      $('#quickref-view').classList.remove('hidden');
      renderQuickref();
    } else {
      $('#quickref-view').classList.add('hidden');
      $('#path-view').classList.remove('hidden');
    }
    $all('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    hideTooltip();
  }

  /* ============================================================
     弹窗 / 提示 / 涟漪
     ============================================================ */
  function showConfirm(message, onOk, okText) {
    var m = $('#modal');
    $('.modal-msg', m).textContent = message;
    var ok = $('.modal-ok', m);
    var cancel = $('.modal-cancel', m);
    ok.textContent = okText || '仍要进入';
    ok.onclick = function () { hideModal(); if (onOk) onOk(); };
    cancel.onclick = hideModal;
    m.classList.remove('hidden');
  }
  function hideModal() { $('#modal').classList.add('hidden'); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ============================================================
     全局事件绑定（事件委托）
     ============================================================ */
  function bindGlobalEvents() {
    document.addEventListener('click', function (e) {
      // 侧栏节点
      var item = e.target.closest('.node-item');
      if (item) {
        var id = item.dataset.id;
        if (id === progress.current) return;
        var node = nodeById(id);
        if (!node) return;
        if (isLocked(node)) {
          var prev = prevNode(node);
          showConfirm('「' + node.title + '」需先完成前置节点「' +
            (prev ? prev.title : '') + '」才能正常解锁，仍要跳过进入吗？',
            function () { renderNode(id); });
        } else {
          renderNode(id);
        }
        return;
      }

      // 自测选项
      var opt = e.target.closest('.quiz-opt');
      if (opt) { onQuizOptClick(opt); return; }

      // 例诗库逐字
      var tch = e.target.closest('.tone-char');
      if (tch) {
        e.stopPropagation();
        if (!tch.dataset.tone) return;
        $all('.tone-line.active').forEach(function (l) { l.classList.remove('active'); });
        $all('.tone-char.current').forEach(function (c) { c.classList.remove('current'); });
        var lineEl = tch.closest('.tone-line');
        if (lineEl) lineEl.classList.add('active');
        tch.classList.add('current');
        var char = tch.textContent;
        var tone = tch.dataset.tone;
        showTooltip(tch, '<div class="tip-title">' + escapeHtml(char) + ' · ' + toneLabel(tone) + '</div>' +
                        '<div class="tip-sub">' + (tone === '平' ? '平声' : '仄声') + '</div>');
        return;
      }

      // 节点例诗韵脚拼音
      var rch = e.target.closest('.rhyme-char');
      if (rch) {
        e.stopPropagation();
        $all('.rhyme-char.on').forEach(function (c) { c.classList.remove('on'); });
        rch.classList.add('on');
        var rubyEl = rch.querySelector('ruby');
        var hanzi = rubyEl ? rubyEl.firstChild.textContent : rch.textContent;
        showTooltip(rch, '<div class="tip-title">' + escapeHtml(hanzi) + '</div>' +
                        '<div class="tip-sub">' + escapeHtml(rch.dataset.py || '') + '</div>');
        return;
      }

      // 速查表：格式 ↔ 例诗 切换
      var ft = e.target.closest('.fmt-toggle');
      if (ft) {
        var cell = ft.closest('td') || ft.closest('.qr-card');
        if (!cell) return;
        var showPoem = cell.classList.toggle('show-poem');
        ft.textContent = showPoem ? '看格式' : '看诗《' + (ft.dataset.title || '') + '》';
        return;
      }

      // 其它区域点击 → 关闭浮层
      hideTooltip();
    });

    // 页面滚动 → 关闭浮层
    window.addEventListener('scroll', function () {
      if (!$('#tooltip').classList.contains('hidden')) hideTooltip();
    }, { passive: true });

    // 按钮涟漪（动效 5）
    document.addEventListener('mousedown', function (e) {
      var btn = e.target.closest('.btn');
      if (!btn) return;
      var rect = btn.getBoundingClientRect();
      var d = Math.max(rect.width, rect.height);
      var span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = d + 'px';
      span.style.left = (e.clientX - rect.left - d / 2) + 'px';
      span.style.top = (e.clientY - rect.top - d / 2) + 'px';
      btn.appendChild(span);
      setTimeout(function () { span.remove(); }, 600);
    });
  }

  /* ---------------- 平仄标注模式开关 ---------------- */
  function initModeToggle() {
    var btn = $('#tone-mode');
    btn.textContent = toneMode === 'symbol' ? '○/●' : '平/仄';
    btn.onclick = function () {
      toneMode = toneMode === 'symbol' ? 'char' : 'symbol';
      try { localStorage.setItem('poetry_tone_mode', toneMode); } catch (e) {}
      btn.textContent = toneMode === 'symbol' ? '○/●' : '平/仄';
      hideTooltip();
      toast(toneMode === 'symbol' ? '平仄标注已切换为符号 ○/●' : '平仄标注已切换为汉字 平/仄');
    };
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (!DATA || !DATA.nodes || DATA.nodes.length === 0) {
      document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif">数据加载失败：请确认 data/data.js 已生成。</div>';
      return;
    }
    buildGlobalCells();
    renderSidebar();
    updateProgressUI();
    updateCurrentSidebar(progress.current);
    initModeToggle();

    var current = nodeById(progress.current) || NODES[0];
    renderNode(current.id);

    // 页签
    $all('.tab').forEach(function (t) {
      t.onclick = function () { switchTab(t.dataset.tab); };
    });

    // 重置进度
    var resetBtn = $('#btn-reset');
    if (resetBtn) resetBtn.onclick = function () { resetProgress(); };

    bindGlobalEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============ 氛围装饰：背景浮动墨点 ============ */
(function () {
  var dust = document.createElement('div');
  dust.className = 'fx-dust';
  var n = 16;
  for (var i = 0; i < n; i++) {
    var dot = document.createElement('i');
    var size = 3 + Math.random() * 7;
    dot.style.width = size + 'px';
    dot.style.height = size + 'px';
    dot.style.left = (Math.random() * 100) + '%';
    dot.style.setProperty('--t', (14 + Math.random() * 16) + 's');
    dot.style.animationDelay = (Math.random() * 22) + 's';
    dust.appendChild(dot);
  }
  document.body.appendChild(dust);
})();
