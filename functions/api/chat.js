/**
 * Cloudflare Pages Function — POST /api/chat
 * 流程：加载知识索引（agent-index.json）→ 字符 bigram 打分检索 Top-K → 组装提示词 → 调 LLM → 返回 { reply, sources }
 *
 * 环境变量：
 *   AGENT_LLM_PROVIDER = deepseek（默认） | workers-ai
 *   DEEPSEEK_API_KEY  （deepseek 时必填）
 *   AI                （workers-ai 时使用 Cloudflare Workers AI binding，无需额外 key）
 */
export async function onRequest(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  const json = (obj, status) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ error: '仅支持 POST' }, 405);

  // ---- 入参校验 ----
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400);
  }
  const message = String(body.message || '').trim();
  if (!message) return json({ error: '消息不能为空' }, 400);
  if (message.length > 800) return json({ error: '消息过长（最多 800 字）' }, 400);
  const history = Array.isArray(body.history)
    ? body.history
        .slice(-6)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) }))
    : [];

  // ---- 1. 加载知识索引（已随站点发布为静态资源）----
  let index;
  try {
    const res = await env.ASSETS.fetch(new URL('/agent-index.json', request.url));
    if (!res.ok) throw new Error('index not found');
    index = await res.json();
  } catch {
    return json({ error: '知识索引未加载，请确认 agent-index.json 已随站点发布' }, 500);
  }
  const chunks = Array.isArray(index.chunks) ? index.chunks : [];

  // ---- 2. 检索 Top-K ----
  const hits = retrieve(message, chunks, 4);

  // ---- 3. 组装提示词 ----
  const system = [
    '你是「姚煜航的个人网站」问答助手，姚煜航是武汉理工大学硕士在读生、腾讯 WXG 后台开发实习生，研究方向是大模型智能体。',
    '回答规则：',
    '1. 严格基于下方站内资料回答，引用资料中的事实，不得编造；',
    '2. 资料覆盖不到的问题，直接说明"站内没有提到"，并建议访客查看对应页面；',
    '3. 涉及他的联系方式、私人邮箱等隐私，说明站内未公开；',
    '4. 用简洁自然的中文回答，不要使用 markdown 标题，可以少量使用列表。',
  ].join('\n');
  const contextText = hits
    .map((h, i) => `【片段${i + 1}｜来源：${h.source}（${h.url}）】\n${h.text}`)
    .join('\n\n');
  const userPrompt = `站内资料：\n${contextText}\n\n访客问题：${message}`;

  // ---- 4. 调用大模型 ----
  const provider = (env.AGENT_LLM_PROVIDER || 'deepseek').toLowerCase();
  let reply = '';
  try {
    if (provider === 'workers-ai') {
      if (!env.AI) return json({ error: '未配置 Workers AI binding，请改用 deepseek 或检查绑定' }, 500);
      const out = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userPrompt }],
        max_tokens: 600,
      });
      reply = String(out.response || '');
    } else {
      const key = env.DEEPSEEK_API_KEY;
      if (!key) return json({ error: '缺少环境变量 DEEPSEEK_API_KEY' }, 500);
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: userPrompt }],
          temperature: 0.3,
          max_tokens: 600,
        }),
      });
      if (!resp.ok) return json({ error: `大模型服务返回 ${resp.status}` }, 502);
      const data = await resp.json();
      reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    }
  } catch (e) {
    return json({ error: '调用大模型失败：' + String(e.message || e) }, 502);
  }
  if (!reply) return json({ error: '大模型未返回内容' }, 502);

  return json(
    {
      reply,
      sources: hits.map((h) => ({ title: h.source, url: h.url })),
    },
    200
  );
}

/** 字符 bigram 检索打分：query 中多少二元组被命中（覆盖率）× 命中密度，返回得分 Top-K */
function toBigrams(text) {
  const t = String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function retrieve(query, chunks, k) {
  const q = toBigrams(query);
  const qChars = toCharSet(query);
  if (q.size === 0 && qChars.size === 0) return [];
  const scored = [];
  for (const c of chunks) {
    const cb = toBigrams(c.text);
    const cChars = toCharSet(c.text);
    if (cb.size === 0 && cChars.size === 0) continue;
    let score = 0;
    // 信号1：query 连续二元组被 chunk 覆盖的比例（顺序强相关，权重最高）
    if (q.size > 0 && cb.size > 0) {
      let hit = 0;
      for (const b of q) if (cb.has(b)) hit++;
      score += (hit / q.size) * 2.0; // 覆盖率
      score += (hit / cb.size) * 0.5; // 命中密度
    }
    // 信号2：字符集重合度（兜底近义/口语问法，如"读什么书"→书架）
    if (qChars.size > 0 && cChars.size > 0) {
      let inter = 0;
      for (const ch of qChars) if (cChars.has(ch)) inter++;
      score += (inter / qChars.size) * 1.2;
    }
    if (score <= 0) continue;
    scored.push({ chunk: c, score: score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.chunk);
}

/** 提取文本字符集合（去空白与标点，中文逐字、保留数字字母） */
function toCharSet(text) {
  const t = String(text).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return new Set(t);
}
