/* AI早报 · 页面交互（原生 JS，无依赖）
   1 两个精选页签：今日简报 / 本周热门，可左右横滑切换，外框高度贴合当前页
   2 卡片折叠：单开互斥 + 点击空白处收起
   3 搜索弹层：关键词 + 板块筛选
   4 深链接 #panel-x / #card-xxx 直接定位
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  docEl.classList.add("js");

  /* ---------------- 1 两个精选页签（手机点标签切换 / 桌面左右并列） */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".board-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel[data-panel]"));
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a[data-target]"));

  function isWide() {
    return window.matchMedia && window.matchMedia("(min-width: 860px)").matches;
  }

  function setActive(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    railLinks.forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("data-target") === name);
    });
  }

  // 手机：一次只显示一页；桌面：两页都在，[hidden] 由媒体查询放行
  function renderPanels(name) {
    panels.forEach(function (p) {
      p.hidden = !isWide() && p.getAttribute("data-panel") !== name;
    });
  }

  var current = "today";

  // 吸顶顶栏高度 + 10px 留白：跳转后标题行不被顶栏盖住
  function stickyOffset() {
    var bar = document.querySelector(".topbar");
    var h = bar ? bar.getBoundingClientRect().height : 52;
    return h + 10;
  }

  function goTo(name, scrollPage) {
    current = name;
    setActive(name);
    renderPanels(name);
    if (scrollPage) {
      var box = document.getElementById("panes");
      if (box) {
        var top = box.getBoundingClientRect().top + window.pageYOffset - stickyOffset();
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { goTo(t.getAttribute("data-tab"), false); });
    t.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(t);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[n].focus();
        goTo(tabs[n].getAttribute("data-tab"), false);
      }
    });
  });

  railLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      goTo(a.getAttribute("data-target"), true);
    });
  });

  if (tabs.length) goTo(tabs[0].getAttribute("data-tab"), false);
  window.addEventListener("resize", function () { renderPanels(current); });

  /* --------------------------------------------- 2 卡片折叠 + 空白处收起 */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));

  function setOpen(card, open) {
    card.classList.toggle("open", open);
    var head = card.querySelector(".card-head");
    var detail = card.querySelector(".detail");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
    if (detail) detail.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function openCard(card) {
    if (!card) return;
    cards.forEach(function (c) { if (c !== card) setOpen(c, false); });
    setOpen(card, true);
    revealCardPage(card);
  }

  function closeAll() {
    cards.forEach(function (c) { setOpen(c, false); });
  }

  cards.forEach(function (card) {
    var head = card.querySelector(".card-head");
    if (!head) return;

    // 只有头部摘要区（.card-head）响应点击：展开 / 二次点击收起。
    // 展开后的正文 .detail 不绑任何点击，点里面、长按选词都不会收起，方便复制文本。
    head.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("a")) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length > 0) return;
      if (card.classList.contains("open")) { closeAll(); } else { openCard(card); }
    });

    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (card.classList.contains("open")) { closeAll(); } else { openCard(card); }
      }
    });
  });

  // 点空白处（卡片与详情之外）收起全部展开的卡片
  document.addEventListener("click", function (e) {
    if (!cards.some(function (c) { return c.classList.contains("open"); })) return;
    var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    if (!t || !t.closest) return;
    if (t.closest(".card, .mini, .board, .panes, .modal, .rail-dock, .topbar, .group-pager")) return;
    closeAll();
  });

  // 顶部速览条：点一下滚到下方完整卡片并展开（不就地展开）
  Array.prototype.slice.call(document.querySelectorAll(".mini[data-card]")).forEach(function (m) {
    m.addEventListener("click", function (e) {
      var id = m.getAttribute("data-card");
      var card = id && document.getElementById("card-" + id);
      if (!card) return;
      e.preventDefault();
      openCard(card);
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.remove("flash");
      void card.offsetWidth;
      card.classList.add("flash");
      setTimeout(function () { card.classList.remove("flash"); }, 1200);
    });
  });

  // 本周热门：内部按 5 条一页左右翻，右上角按钮显示 1/2 并翻页
  var weekTrack = document.getElementById("week-track");
  var weekPager = document.getElementById("week-pager");
  if (weekTrack && weekPager) {
    var wpArrow = weekPager.querySelector(".wp-arrow");
    var pageCount = weekTrack.querySelectorAll(".week-page").length;

    function weekPage() {
      var w = Math.max(1, weekTrack.clientWidth);
      return Math.max(0, Math.min(pageCount - 1, Math.round(weekTrack.scrollLeft / w)));
    }
    // 悬浮圆钮：不在最后一页时显示 ›，到最后一页显示 ‹（点了回第 1 页）
    function syncPager() {
      var last = weekPage() >= pageCount - 1;
      if (wpArrow) wpArrow.textContent = last ? "‹" : "›";
      weekPager.setAttribute("aria-label", last ? "本周热门上一页" : "本周热门下一页");
      weekPager.setAttribute("title", last ? "本周热门上一页" : "本周热门下一页");
    }
    weekTrack.addEventListener("scroll", function () {
      clearTimeout(weekTrack._t);
      weekTrack._t = setTimeout(syncPager, 100);
    }, { passive: true });

    weekPager.addEventListener("click", function () {
      var p = weekPage();
      var next = p >= pageCount - 1 ? 0 : p + 1;
      weekTrack.scrollTo({ left: next * weekTrack.clientWidth, behavior: "smooth" });
      if (wpArrow) wpArrow.textContent = next >= pageCount - 1 ? "‹" : "›";
    });
    syncPager();
  }

  /* ------------------------------------- 3 四块卡片分区：> 5 条按每页 5 条翻页 */
  // 标题行右侧的 ‹ 1/2 ›（形制同 vvotzs 的板块翻页）只负责切页；
  // 容器本身是横向吸附滚动，手机也能直接横滑。
  var groupTracks = Array.prototype.slice.call(document.querySelectorAll(".group-pages"));

  function groupIndex(track) {
    var w = Math.max(1, track.clientWidth);
    return Math.max(0, Math.round(track.scrollLeft / w));
  }

  // 卡片在别的页时（深链接 #card-xxx、顶部速览条点进来）先把那一页翻到眼前
  function revealCardPage(card) {
    if (!card || !card.closest) return;
    var track = card.closest(".group-pages");
    var page = card.closest(".group-page");
    if (!track || !page) return;
    var idx = Array.prototype.indexOf.call(track.children, page);
    if (idx > 0) track.scrollTo({ left: idx * track.clientWidth, behavior: "smooth" });
  }

  groupTracks.forEach(function (track) {
    var group = track.closest(".group");
    var pager = group && group.querySelector(".group-pager");
    var count = track.querySelectorAll(".group-page").length;
    if (!pager || count < 2) return;

    var prev = pager.querySelector("[data-prev]");
    var next = pager.querySelector("[data-next]");
    var label = pager.querySelector("[data-label]");

    function paint(p) {
      if (label) label.textContent = (p + 1) + " / " + count;
      if (prev) prev.disabled = p <= 0;
      if (next) next.disabled = p >= count - 1;
    }
    function goto(p) {
      p = Math.max(0, Math.min(count - 1, p));
      track.scrollTo({ left: p * track.clientWidth, behavior: "smooth" });
      paint(p);
    }

    track.addEventListener("scroll", function () {
      clearTimeout(track._pt);
      track._pt = setTimeout(function () { paint(groupIndex(track)); }, 90);
    }, { passive: true });
    if (prev) prev.addEventListener("click", function () { goto(groupIndex(track) - 1); });
    if (next) next.addEventListener("click", function () { goto(groupIndex(track) + 1); });
    // 屏宽变了以后页宽也变了，重新对齐到当前页，不要停在半页中间
    window.addEventListener("resize", function () {
      var p = groupIndex(track);
      track.scrollTo({ left: p * track.clientWidth, behavior: "auto" });
    });
    paint(0);
  });

  /* ------------------------------------------------- 4 搜索弹层 */
  var modal = document.getElementById("search-modal");
  var q = document.getElementById("q");
  var resultEl = document.querySelector("[data-result]");
  var state = { cat: "all", text: "" };

  function applyFilter() {
    var text = state.text.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function (c) {
      var okCat = state.cat === "all" || c.getAttribute("data-cat") === state.cat;
      var okText = !text || (c.getAttribute("data-text") || "").toLowerCase().indexOf(text) > -1;
      var show = okCat && okText;
      c.hidden = !show;
      if (show) visible++;
    });
    document.body.classList.toggle("filtering", visible === 0);
    document.body.classList.toggle("has-filter", !!text || state.cat !== "all");
    if (resultEl) resultEl.textContent = visible;
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(function () { if (q) q.focus(); }, 40);
  }
  function closeModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  var openBtn = document.getElementById("open-search");
  if (openBtn) openBtn.addEventListener("click", openModal);
  if (modal) {
    Array.prototype.slice.call(modal.querySelectorAll("[data-close]")).forEach(function (b) {
      b.addEventListener("click", closeModal);
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openModal();
    }
    if (e.key === "Escape") closeModal();
  });

  if (q) {
    q.addEventListener("input", function () {
      state.text = q.value;
      applyFilter();
    });
  }

  Array.prototype.slice.call(document.querySelectorAll('.chips[data-group="cat"] .chip')).forEach(function (chip) {
    chip.addEventListener("click", function () {
      var group = chip.parentElement;
      Array.prototype.slice.call(group.querySelectorAll(".chip")).forEach(function (c) {
        c.classList.toggle("on", c === chip);
      });
      state.cat = chip.getAttribute("data-value");
      applyFilter();
    });
  });

  var resetBtn = document.querySelector("[data-reset]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state = { cat: "all", text: "" };
      if (q) q.value = "";
      Array.prototype.slice.call(document.querySelectorAll('.chips[data-group="cat"] .chip')).forEach(function (c) {
        c.classList.toggle("on", c.getAttribute("data-value") === "all");
      });
      applyFilter();
    });
  }
  // ?q= 关键词直接过滤（JSON-LD 的 SearchAction 指向这里）
  try {
    var pq = new URLSearchParams(location.search).get("q");
    if (pq) {
      state.text = pq;
      if (q) q.value = pq;
    }
  } catch (err) { /* 老浏览器没有 URLSearchParams 时忽略 */ }
  if (resultEl) applyFilter();

  /* --------------------------------------------- 5 深链接直接展开 */
  function openFromHash() {
    var h = location.hash.replace(/^#/, "");
    if (!h) return;
    var pm = /^panel-(.+)$/.exec(h);
    if (pm) { goTo(pm[1], false); return; }
    var card = document.getElementById(h);
    if (card && card.classList.contains("card")) {
      var owner = card.closest(".panel");
      if (owner) goTo(owner.getAttribute("data-panel"), false);
      openCard(card);
    }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
