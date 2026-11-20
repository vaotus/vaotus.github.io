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

  /* ------------------------- 1 两个精选页签（今日简报 / 本周热门，可横滑） */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".board-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel[data-panel]"));
  var panes = document.getElementById("panes");
  var slider = document.getElementById("slider");
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a[data-target]"));

  function panelIndex(name) {
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].getAttribute("data-panel") === name) return i;
    }
    return 0;
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

  // 当前停在哪一页（按横滑位移算）
  function activeIndex() {
    if (!panes || !panels.length) return 0;
    var w = Math.max(1, panes.clientWidth);
    var i = Math.round(panes.scrollLeft / w);
    return Math.max(0, Math.min(panels.length - 1, i));
  }

  // 把横滑外框的高度贴合到当前页的真实高度：短的那页不留空、展开详情也不会被裁
  function sizePanes() {
    if (!panes) return;
    var p = panels[activeIndex()];
    if (!p) return;
    panes.style.height = "auto";
    var h = p.offsetHeight;
    if (h) panes.style.height = h + "px";
  }

  var sizeTimer = null;
  function scheduleSize(delay) {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(sizePanes, delay || 320);
  }

  function goTo(name, smooth, scrollPage) {
    setActive(name);
    var idx = panelIndex(name);
    if (panes) {
      panes.scrollTo({ left: idx * panes.clientWidth, behavior: smooth ? "smooth" : "auto" });
      scheduleSize(smooth ? 380 : 0);
    }
    if (scrollPage) {
      var box = panes || document.getElementById("panel-" + name);
      if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (panes) {
    var scrollEnd = null;
    panes.addEventListener("scroll", function () {
      var p = panels[activeIndex()];
      if (p) setActive(p.getAttribute("data-panel"));
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(sizePanes, 120);
    }, { passive: true });
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () { goTo(t.getAttribute("data-tab"), true, false); });
    t.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(t);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[n].focus();
        goTo(tabs[n].getAttribute("data-tab"), true, false);
      }
    });
  });

  // 右侧滑轨与顶栏胶囊：切到对应页，并把页面滚到横滑区
  railLinks.forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      goTo(a.getAttribute("data-target"), true, true);
    });
  });

  if (tabs.length) goTo(tabs[0].getAttribute("data-tab"), false, false);
  window.addEventListener("resize", function () { scheduleSize(120); });
  window.addEventListener("load", function () { scheduleSize(0); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { scheduleSize(0); });
  }

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
  }

  function closeAll() {
    cards.forEach(function (c) { setOpen(c, false); });
  }

  cards.forEach(function (card) {
    var head = card.querySelector(".card-head");
    if (!head) return;
    head.addEventListener("click", function (e) {
      // 卡片头部里的直达链接与「详情」按钮各自处理，不重复触发展开
      if (e.target.closest && e.target.closest("a.go")) return;
      openCard(card.classList.contains("open") ? null : card);
      scheduleSize(340);
    });
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCard(card.classList.contains("open") ? null : card);
        scheduleSize(340);
      }
    });
  });

  // 点空白处（卡片与详情之外）收起全部展开的卡片
  document.addEventListener("click", function (e) {
    if (!cards.some(function (c) { return c.classList.contains("open"); })) return;
    var t = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    if (!t || !t.closest) return;
    if (t.closest(".card, .board, .modal, .rail-dock, .topbar")) return;
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
    scheduleSize(240);
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
    if (pm) { goTo(pm[1], false, false); return; }
    var card = document.getElementById(h);
    if (card && card.classList.contains("card")) {
      var owner = card.closest(".panel");
      if (owner) goTo(owner.getAttribute("data-panel"), false, false);
      openCard(card);
      scheduleSize(340);
    }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
