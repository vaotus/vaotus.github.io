/* AI早报 · 页面交互（原生 JS，无依赖）
   1 速览板标签页切换
   2 卡片折叠：单开互斥 + 点击空白处收起 + 跳转卡定位展开
   3 右侧滑轨当前板块高亮
   4 搜索弹层：关键词 + 板块筛选
   5 深链接 #card-xxx 直接展开
*/
(function () {
  "use strict";

  var docEl = document.documentElement;
  docEl.classList.add("js");

  /* ------------------------------------------------ 1 速览板标签页 */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".board-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".board-panel"));

  function showTab(name) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-tab") === name;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      p.hidden = p.getAttribute("data-panel") !== name;
    });
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      showTab(t.getAttribute("data-tab"));
    });
    t.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(t);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[n].focus();
        showTab(tabs[n].getAttribute("data-tab"));
      }
    });
  });
  if (tabs.length) showTab(tabs[0].getAttribute("data-tab"));

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
    });
    head.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCard(card.classList.contains("open") ? null : card);
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

  // 速览板里的跳转卡：滚到对应卡片并展开
  Array.prototype.slice.call(document.querySelectorAll(".jump")).forEach(function (j) {
    j.addEventListener("click", function () {
      var id = j.getAttribute("data-jump");
      var target = id && document.getElementById("card-" + id);
      if (!target) return;
      openCard(target);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.remove("flash");
      void target.offsetWidth;
      target.classList.add("flash");
      setTimeout(function () { target.classList.remove("flash"); }, 1200);
    });
  });

  /* --------------------------------------------- 3 滑轨高亮当前板块 */
  var railLinks = Array.prototype.slice.call(document.querySelectorAll(".rail a[data-target]"));
  var modules = Array.prototype.slice.call(document.querySelectorAll("section.module"));
  if ("IntersectionObserver" in window && railLinks.length && modules.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        railLinks.forEach(function (a) {
          a.classList.toggle("on", a.getAttribute("data-target") === id);
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    modules.forEach(function (m) { io.observe(m); });
  }

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
    modules.forEach(function (m) {
      var any = m.querySelectorAll(".card:not([hidden])").length > 0;
      m.classList.toggle("is-empty", !any);
    });
    document.body.classList.toggle("filtering", visible === 0);
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
    var card = document.getElementById(h);
    if (card && card.classList.contains("card")) {
      openCard(card);
    } else if (/^card-/.test(h)) {
      var c2 = document.getElementById(h);
      if (c2) openCard(c2);
    }
  }
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();
