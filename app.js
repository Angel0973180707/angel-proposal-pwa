/* Angel Proposal PWA
 * data source: ./data/tools.csv
 * Works on GitHub Pages (relative paths).
 */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  const state = {
    type: "演講",
    tools: [],        // parsed tools from CSV
    selectedIds: new Set(),
  };

  // ---------- CSV Parser (handles quotes) ----------
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') { cur += '"'; i++; continue; }
        if (c === '"') { inQuotes = false; continue; }
        cur += c;
      } else {
        if (c === '"') { inQuotes = true; continue; }
        if (c === ",") { row.push(cur); cur = ""; continue; }
        if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
        if (c === "\r") { continue; }
        cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }

    if (!rows.length) return [];

    const headers = rows[0].map(h => h.trim());
    const data = [];
    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      const cols = rows[r];
      if (cols.length === 1 && cols[0].trim() === "") continue;

      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = (cols[c] ?? "").trim();
      }
      data.push(obj);
    }
    return data;
  }

  // ---------- Load tools.csv ----------
  async function loadTools() {
    const status = $("#status");
    status.textContent = "正在載入 tools.csv…";

    try {
      // cache-bust for GH Pages / SW
      const res = await fetch(`./data/tools.csv?v=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`tools.csv 載入失敗：HTTP ${res.status}`);
      const text = await res.text();
      const data = parseCSV(text);

      // normalize keys (support your header names)
      state.tools = data.map(t => ({
        id: t["工具ID"] || t["id"] || "",
        name: t["工具名稱"] || t["name"] || "",
        core: t["核心功能"] || "",
        pains: t["適用對象/痛點"] || "",
        chapter: t["對應篇章"] || "",
        steps: t["操作步驟"] || "",
        pouch: t["智多星錦囊"] || "",
        link: t["工具連結"] || "",
        category: t["性質分類"] || "",
        videoName: t["影片名稱"] || "",
        videoLink: t["影片連結"] || "",
      })).filter(t => t.id && t.name);

      if (!state.tools.length) {
        status.textContent = "⚠️ tools.csv 已載入，但資料為空（請確認 CSV 內容與欄位名稱）";
      } else {
        status.textContent = `✅ 已載入 ${state.tools.length} 筆工具`;
      }

      renderToolList();
    } catch (err) {
      console.error(err);
      status.textContent = `❌ ${err.message}`;
      $("#toolList").innerHTML = "";
    }
  }

  // ---------- Render tools ----------
  function toolMatches(t, q) {
    if (!q) return true;
    const s = `${t.id} ${t.name} ${t.core} ${t.pains} ${t.category}`.toLowerCase();
    return s.includes(q.toLowerCase());
  }

  function renderToolList() {
    const list = $("#toolList");
    const q = ($("#toolSearch").value || "").trim();

    const items = state.tools.filter(t => toolMatches(t, q));
    if (!items.length) {
      list.innerHTML = `<div class="status">找不到符合的工具（試試短一點的關鍵字）</div>`;
      return;
    }

    list.innerHTML = items.map(t => {
      const checked = state.selectedIds.has(t.id) ? "checked" : "";
      return `
        <div class="tool">
          <div class="left">
            <div class="id">${escapeHtml(t.id)}</div>
            <div class="name">${escapeHtml(t.name)}</div>
            <div class="meta">
              <div><b>核心：</b>${escapeHtml(shorten(t.core, 90))}</div>
              <div><b>痛點：</b>${escapeHtml(shorten(t.pains, 120))}</div>
            </div>
            ${t.category ? `<div class="pill">${escapeHtml(t.category)}</div>` : ``}
          </div>
          <div class="right">
            <input class="chk" type="checkbox" data-id="${escapeAttr(t.id)}" ${checked} />
          </div>
        </div>
      `;
    }).join("");

    // bind checkbox events
    list.querySelectorAll('input[type="checkbox"][data-id]').forEach(chk => {
      chk.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-id");
        if (!id) return;
        if (e.target.checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
        updateMeta();
      });
    });

    updateMeta();
  }

  // ---------- Proposal generator ----------
  function getSelectedTools() {
    const ids = Array.from(state.selectedIds);
    // keep selected order as in CSV
    return state.tools.filter(t => ids.includes(t.id));
  }

  function generateProposal() {
    const org = ($("#org").value || "").trim();
    const audience = ($("#audience").value || "").trim();
    const duration = ($("#duration").value || "").trim();
    const people = ($("#people").value || "").trim();
    const topic = ($("#topic").value || "").trim();
    const pains = ($("#pains").value || "").trim();

    const tools = getSelectedTools();
    const mainTool = tools[0] || null;
    const extraTools = tools.slice(1);

    const title = topic || defaultTitle(state.type, audience, pains);
    const where = org ? `（場域/單位：${org}）` : "";
    const timeInfo = [duration ? `時長：${duration}` : "", people ? `人數：${people}` : ""].filter(Boolean).join("｜");

    const toolLine = tools.length
      ? tools.map(t => `${t.name}（${t.id}）`).join("、")
      : "（尚未選工具：建議至少選 1 個主工具）";

    const goal = buildGoals(state.type, audience, pains);
    const flow = buildFlow(state.type, mainTool, extraTools);
    const deliver = buildDeliverables(state.type);
    const rationale = buildRationale();
    const closing = buildClosing();

    const lines = [];
    lines.push(`【提案名稱】${title}`);
    if (where) lines.push(where);
    if (timeInfo) lines.push(timeInfo);
    lines.push("");
    lines.push(`【提案類型】${state.type}`);
    lines.push(`【對象】${audience || "—"}`);
    if (pains) lines.push(`【主要痛點/關鍵字】${pains}`);
    lines.push("");
    lines.push(`【採用工具】${toolLine}`);
    if (tools.length) {
      lines.push("");
      lines.push(`【主工具】${mainTool ? `${mainTool.name}（${mainTool.id}）` : "—"}`);
      if (mainTool?.core) lines.push(`- 核心功能：${mainTool.core}`);
      if (mainTool?.steps) lines.push(`- 操作步驟：${mainTool.steps}`);
      if (mainTool?.link) lines.push(`- 工具連結：${mainTool.link}`);
      if (extraTools.length) {
        lines.push(`【副工具】`);
        extraTools.forEach(t => {
          lines.push(`- ${t.name}（${t.id}）${t.link ? `｜${t.link}` : ""}`);
        });
      }
    }

    lines.push("");
    lines.push("【目標】");
    goal.forEach(g => lines.push(`- ${g}`));

    lines.push("");
    lines.push("【流程架構】");
    flow.forEach(f => lines.push(`- ${f}`));

    lines.push("");
    lines.push("【交付物/帶走】");
    deliver.forEach(d => lines.push(`- ${d}`));

    lines.push("");
    lines.push("【為什麼有效（腦科學＋幸福教養核心）】");
    rationale.forEach(r => lines.push(`- ${r}`));

    lines.push("");
    lines.push("【結尾一句話】");
    lines.push(closing);

    $("#output").value = lines.join("\n");
    $("#copyHint").textContent = "✅ 已生成（可一鍵複製）";
  }

  function defaultTitle(type, audience, pains) {
    const a = audience ? `給${audience}的` : "給你的一份";
    if (type === "演講") return `${a}｜大人先穩定，孩子才有路走`;
    if (type === "課程") return `${a}｜幸福教養實作課：把心站穩，方法就會來`;
    return `${a}｜幸福教養體驗活動：從情緒急救到關係修復`;
  }

  function buildGoals(type, audience, pains) {
    const p = pains ? `（聚焦：${pains}）` : "";
    if (type === "演講") return [
      `讓${audience || "參與者"}理解：情緒失控不是壞，而是大腦警報（杏仁核模式）`,
      `提供可立即操作的「穩定工具」與一句說得出口的話，降低衝突成本`,
      `把教養從「硬撐」帶回「有方法的溫柔」${p}`
    ];
    if (type === "課程") return [
      `建立可持續的練習節律：每週一個小步驟，累積穩定感`,
      `把「反應」轉成「選擇」：讓理性空間回來，溝通才有效`,
      `讓家長/老師能帶走可用工具與語句模板，回到現場用得出來${p}`
    ];
    return [
      `用體驗替代說教：在活動中完成「情緒降溫 → 連結修復」`,
      `讓${audience || "參與者"}現場學會一套「先穩定，再處理」的順序`,
      `把衝突變成教育契機：用工具留下幸福的回家路${p}`
    ];
  }

  function buildFlow(type, mainTool, extraTools) {
    const mt = mainTool ? `${mainTool.name}` : "主工具";
    const extras = extraTools.map(t => t.name);
    const add = extras.length ? `（搭配：${extras.join("、")}）` : "";

    if (type === "演講") return [
      `暖身共感：把大家的累說清楚（不是你不會，是你撐太久）`,
      `腦科學理解：杏仁核警報 → 前額葉需要空間`,
      `工具示範：用「${mt}」做一次全場體驗${add}`,
      `收尾整合：帶走一句話＋一個工具連結（回家就能用）`
    ];

    if (type === "課程") return [
      `第1段｜先穩定：用「${mt}