/**
 * 个人网站聊天挂件 —— 右下角浮动按钮 + 聊天面板
 * 引入方式：在任意页面 </body> 前加 <script src="assets/js/agent-widget.js"></script>
 * 样式由本脚本自动加载同目录 ../css/agent-widget.css
 */
(function () {
  'use strict';
  if (window.__yyhAgentLoaded) return;
  window.__yyhAgentLoaded = true;

  // ---- 自动加载样式 ----
  (function loadCss() {
    var script = document.currentScript;
    var href = 'assets/css/agent-widget.css';
    if (script && script.src) {
      href = script.src.replace(/js\/agent-widget\.js$/, 'css/agent-widget.css');
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  })();

  var HISTORY_MAX = 6; // 携带给后端的最近对话轮数

  // ---- DOM ----
  var btn = document.createElement('button');
  btn.id = 'yyh-agent-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '打开网站问答助手');
  btn.innerHTML =
    '<span class="yyh-agent-btn-icon">问</span>' +
    '<span class="yyh-agent-btn-tip">问问这个网站</span>';

  var panel = document.createElement('div');
  panel.id = 'yyh-agent-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '网站问答助手');
  panel.hidden = true;
  panel.innerHTML =
    '<div class="yyh-agent-head">' +
    '  <div class="yyh-agent-title">Ask 姚煜航</div>' +
    '  <div class="yyh-agent-sub">基于本站简历 / 文章回答</div>' +
    '  <button type="button" class="yyh-agent-close" aria-label="关闭">✕</button>' +
    '</div>' +
    '<div class="yyh-agent-msgs" id="yyh-agent-msgs"></div>' +
    '<form class="yyh-agent-form" id="yyh-agent-form">' +
    '  <input type="text" id="yyh-agent-input" class="yyh-agent-input" placeholder="问他点什么…" autocomplete="off" maxlength="800" />' +
    '  <button type="submit" class="yyh-agent-send">发送</button>' +
    '</form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = document.getElementById('yyh-agent-msgs');
  var form = document.getElementById('yyh-agent-form');
  var input = document.getElementById('yyh-agent-input');
  var history = [];

  // ---- 欢迎语 ----
  appendMsg(
    'assistant',
    '你好，我是姚煜航个人网站的问答助手。可以问我他的经历、技能、书架、文章内容，我会基于站内资料回答。'
  );

  // ---- 事件 ----
  btn.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    btn.classList.toggle('is-open', !open);
    if (panel.hidden === false) input.focus();
  });
  panel.querySelector('.yyh-agent-close').addEventListener('click', function () {
    panel.hidden = true;
    btn.classList.remove('is-open');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    ask(text);
  });

  // ---- 逻辑 ----
  function appendMsg(role, text, sources) {
    var row = document.createElement('div');
    row.className = 'yyh-agent-msg ' + (role === 'user' ? 'is-user' : 'is-bot');

    var bubble = document.createElement('div');
    bubble.className = 'yyh-agent-bubble';
    bubble.textContent = text; // textContent 防 XSS

    row.appendChild(bubble);

    if (sources && sources.length) {
      var refs = document.createElement('div');
      refs.className = 'yyh-agent-refs';
      sources.forEach(function (s) {
        if (s.url === '/') return; // 首页来源不单独列出
        var a = document.createElement('a');
        a.href = s.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '来源：' + s.title;
        refs.appendChild(a);
      });
      if (refs.children.length) row.appendChild(refs);
    }
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  function setLoading(show) {
    var el = document.getElementById('yyh-agent-loading');
    if (show && !el) {
      el = document.createElement('div');
      el.id = 'yyh-agent-loading';
      el.className = 'yyh-agent-msg is-bot';
      el.innerHTML = '<div class="yyh-agent-bubble yyh-agent-loading">正在检索本站资料…</div>';
      msgs.appendChild(el);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (!show && el) {
      el.remove();
    }
  }

  function ask(text) {
    appendMsg('user', text);
    history.push({ role: 'user', content: text });
    setLoading(true);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-HISTORY_MAX) }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          throw new Error('响应解析失败（HTTP ' + r.status + '）');
        });
      })
      .then(function (data) {
        setLoading(false);
        if (data.error) {
          appendMsg('assistant', '出错了：' + data.error + '（可刷新页面重试）');
          return;
        }
        history.push({ role: 'assistant', content: data.reply });
        appendMsg('assistant', data.reply, data.sources);
      })
      .catch(function (err) {
        setLoading(false);
        appendMsg('assistant', '网络请求失败：' + err.message + '（可刷新页面重试）');
      });
  }
})();
