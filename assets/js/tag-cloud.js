// 自绘 Canvas 词云：核心大词居中、螺旋向外密集排布、部分竖排、绿色系分级配色
(function () {
  var root = document.getElementById('tag-cloud-canvas');
  if (!root) return;

  var WORDS = [
    ['C++', 9], ['Agent', 8], ['Redis', 7], ['3DGS', 6],
    ['MySQL', 5], ['MCP', 5], ['Linux 系统编程', 4], ['后端架构', 4],
    ['智能体', 4], ['Qt', 3], ['计算机网络', 3], ['操作系统', 3],
    ['大模型应用', 3], ['Function Calling', 2], ['SQL 调优', 2],
    ['System V 共享内存', 1]
  ];
  var FONT = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
  var HEIGHT = 360; // 逻辑像素高度
  var PAD = 5;      // 词间距
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function colorFor(w) {
    if (w >= 7) return '#eaffea';
    if (w >= 5) return '#c6ffc6';
    if (w >= 3) return '#27c93f';
    return '#019e01';
  }
  function sizeFor(w) { return Math.round(11 + Math.pow(w, 1.25) * 3); }
  function weightFor(w) { return w >= 5 ? 700 : (w >= 3 ? 600 : 500); }

  function fallbackHtml() {
    var html = '<div class="tag-cloud">';
    WORDS.forEach(function (it) { html += '<span>' + it[0] + '</span>'; });
    return html + '</div>';
  }

  function draw(container) {
    var W = container.clientWidth;
    if (W < 10) return;
    container.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(HEIGHT * DPR);
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      container.innerHTML = fallbackHtml();
      return;
    }
    ctx.scale(DPR, DPR);

    var items = WORDS.slice().sort(function (a, b) { return b[1] - a[1]; });

    function measure(text, size, weight, vertical) {
      ctx.font = weight + ' ' + size + 'px ' + FONT;
      var tw = ctx.measureText(text).width;
      if (vertical) return { w: size, h: tw };
      return { w: tw, h: size };
    }

    var placed = [];
    var cx = W / 2, cy = HEIGHT / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy) * 0.62;

    function collide(bx, by, bw, bh) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (bx < p.x + p.w + PAD && bx + bw + PAD > p.x &&
            by < p.y + p.h + PAD && by + bh + PAD > p.y) return true;
      }
      return false;
    }
    function inBounds(bx, by, bw, bh) {
      return bx >= 2 && by >= 2 && bx + bw <= W - 2 && by + bh <= HEIGHT - 2;
    }

    items.forEach(function (it) {
      var text = it[0], w = it[1];
      var size = sizeFor(w);
      var vertical = /^[\u4e00-\u9fa5]+$/.test(text) && text.length <= 4 && Math.random() < 0.2;
      var placedItem = null;

      for (var attempt = 0; attempt < 3 && !placedItem; attempt++) {
        var m = measure(text, size, weightFor(w), vertical);
        var found = false;
        for (var stepIdx = 0; stepIdx < 2400; stepIdx++) {
          var theta = stepIdx * 0.13;
          var r = 4 + theta * 1.15;
          if (r > maxR) break;
          var px = cx + r * Math.cos(theta);
          var py = cy + r * Math.sin(theta);
          var bx = vertical ? px - size : px;
          var by = py;
          if (!inBounds(bx, by, m.w, m.h) || collide(bx, by, m.w, m.h)) continue;
          placed.push({ x: bx, y: by, w: m.w, h: m.h });
          placedItem = { x: bx, y: by, w: m.w, h: m.h, vertical: vertical, text: text, size: size };
          found = true;
          break;
        }
        if (!found) size = Math.round(size * 0.85);
      }

      if (!placedItem) return;
      ctx.save();
      ctx.translate(placedItem.x + (placedItem.vertical ? placedItem.size : 0), placedItem.y);
      if (placedItem.vertical) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = colorFor(w);
      ctx.font = weightFor(w) + ' ' + placedItem.size + 'px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.fillText(text, 0, 0);
      ctx.restore();
    });
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { draw(root); }, 150);
  }
  draw(root);
  window.addEventListener('resize', schedule);
})();
