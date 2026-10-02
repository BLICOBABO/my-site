(function () {
  const root = document.getElementById("terminal-type");
  if (!root) return;

  const promptText = "yyh@dev:~$";
  const sequence = [
    { kind: "command", text: "whoami" },
    { kind: "output", text: "姚煜航 · 后端开发 · 在读硕士 · 大模型智能体方向" },
    { kind: "command", text: "cat about.txt" },
    {
      kind: "output",
      text: "武汉理工大学电子信息硕士在读，方向是大模型智能体。\n现在在做 3DGS 人体重建方向的研究，写论文，持续学习前沿技术。\n晚上看书、健身、做饭，偶尔坐公交漫游。\n相信一句话：把系统拆到最底层，才能讲得清、改得动。",
    },
    { kind: "command", text: "" },
  ];

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.innerHTML =
      '<p><span class="prompt">' + promptText + "</span> whoami</p>" +
      '<p class="output">姚煜航 · 后端开发 · 在读硕士 · 大模型智能体方向</p>' +
      '<p><span class="prompt">' + promptText + "</span> cat about.txt</p>" +
      '<p class="output">武汉理工大学电子信息硕士在读，方向是大模型智能体。<br>现在在做 3DGS 人体重建方向的研究，写论文，持续学习前沿技术。<br>晚上看书、健身、做饭，偶尔坐公交漫游。<br>相信一句话：把系统拆到最底层，才能讲得清、改得动。</p>' +
      '<p><span class="prompt">' + promptText + '</span> <span class="cursor"></span></p>';
    return;
  }

  const cursor = document.createElement("span");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function typeInto(el, text, delay) {
    cursor.classList.add("is-typing");
    for (const ch of text) {
      if (ch === "\n") {
        el.appendChild(document.createElement("br"));
      } else {
        el.appendChild(document.createTextNode(ch));
      }
      el.appendChild(cursor);
      await sleep(delay);
    }
    cursor.classList.remove("is-typing");
  }

  async function play() {
    root.innerHTML = "";
    root.setAttribute("aria-live", "polite");

    for (const step of sequence) {
      if (step.kind === "command") {
        const line = document.createElement("p");
        const prompt = document.createElement("span");
        prompt.className = "prompt";
        prompt.textContent = promptText;
        const cmd = document.createElement("span");
        line.appendChild(prompt);
        line.appendChild(document.createTextNode(" "));
        line.appendChild(cmd);
        line.appendChild(cursor);
        root.appendChild(line);
        await sleep(180);
        await typeInto(cmd, step.text, 48);
        if (step.text) await sleep(360);
      } else {
        const line = document.createElement("p");
        line.className = "output";
        line.appendChild(cursor);
        root.appendChild(line);
        await typeInto(line, step.text, 32);
        await sleep(420);
      }
    }
  }

  play();
})();
