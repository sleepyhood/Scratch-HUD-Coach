// Content Script: inject HUD, talk to page bridge & background
(function () {
  const EXT_NS = "scratch-hud-coach";

  // 1) Inject bridge into page context
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content/page_bridge.js");
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  // 2) HUD skeleton
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "hud-coach-toggle";
  toggleBtn.textContent = "HUD 열기";
  document.body.appendChild(toggleBtn);

  const root = document.createElement("div");
  root.id = "hud-coach-root";
  root.innerHTML = `
    <div id="hud-coach-header">
      <div id="hud-coach-title">Scratch HUD Coach</div>
      <div>
        <button id="hud-refresh" title="새로고침" class="btn secondary" style="display:none">↻</button>
        <button id="hud-close" class="btn secondary">닫기</button>
      </div>
    </div>
    <div id="hud-coach-body">
      <div class="hud-section">
        <h4>블록 도움말</h4>
        <div class="hud-card" id="help-card">
          <div id="help-title" style="font-weight:600; margin-bottom:4px;">블록을 선택하면 짧은 팁이 나옵니다.</div>
          <div class="chips" id="help-chips"></div>
          <ul class="hud-tips" id="help-tips"></ul>
        </div>
      </div>
      <div class="hud-section">
        <h4>체크리스트</h4>
        <div class="hud-card" id="checklist"></div>
      </div>
      <div class="hud-section">
        <h4>질문 전 자기점검</h4>
        <div class="hud-card" id="selfcheck">
          <div class="row">
            <label>기대한 동작</label>
            <textarea id="sc-expected" placeholder="예: 초록 깃발을 누르면 고양이가 계속 움직여야 해요"></textarea>
            <label>실제 동작</label>
            <textarea id="sc-actual" placeholder="예: 한 번만 움직이고 멈춰요"></textarea>
            <label>시도해 본 것</label>
            <textarea id="sc-tried" placeholder="예: 영원 반복을 넣어봤어요"></textarea>
          </div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <button class="btn" id="sc-capture">화면 첨부</button>
            <button class="btn secondary" id="sc-copy">요약 복사</button>
          </div>
          <div id="sc-preview" style="margin-top:8px; display:none;">
            <img id="sc-img" alt="screenshot"/>
          </div>
        </div>
      </div>
      <div class="hud-section" style="margin-top: 10px;">
        <h4>1단계: 원본 JSON (사전형)</h4>
        <div class="hud-card" style="padding: 5px;">
          <textarea id="live-json-view" style="width:100%; height:120px; font-family:monospace; font-size:11px; white-space:pre; resize:vertical; background:#f9f9f9; border:1px solid #ccc; border-radius:4px;" readonly placeholder="현재 화면에 배치된 스크래치 블록의 원본 구조"></textarea>
        </div>
      </div>
      <div class="hud-section" style="margin-top: 10px;">
        <h4>2단계: 정규화 파싱(배열형)</h4>
        <div class="hud-card" style="padding: 5px;">
          <textarea id="live-parsed-view" style="width:100%; height:160px; font-family:monospace; font-size:11px; white-space:pre; resize:vertical; background:#eef2ff; border:1px solid #c7d2fe; border-radius:4px; color:#312e81;" readonly placeholder="정규화된 논리적 시퀀스가 나타납니다."></textarea>
        </div>
      </div>

      <div class="hud-section hud-inject-section" style="margin-top: 10px;">
        <h4>⚡ 3단계: AI 블록 주입</h4>
        <div class="hud-card" style="padding: 8px; background: #fff8f0; border-color: #fed7aa;">
          <div style="font-size:11px; color:#92400e; margin-bottom:6px; line-height:1.5;">
            AI(Gemini 등)가 생성한 계층형 스크립트 JSON을 붙여넣으세요.<br>
            형식: <code>[[{"opcode":"event_whenflagclicked"}, ...], ...]</code>
          </div>
          <textarea
            id="inject-json-input"
            placeholder='[
  [
    { "opcode": "event_whenflagclicked" },
    {
      "opcode": "control_forever",
      "inputs": {
        "SUBSTACK": [
          { "opcode": "motion_movesteps", "inputs": { "STEPS": 10 } }
        ]
      }
    }
  ]
]'
            style="width:100%; height:160px; font-family:monospace; font-size:11px; resize:vertical; background:#fffbf5; border:1px solid #fcd34d; border-radius:6px; padding:6px; box-sizing:border-box;"
          ></textarea>
          <div id="inject-status" style="font-size:11px; margin: 5px 0; min-height:18px; padding: 3px 6px; border-radius:4px; display:none;"></div>
          <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
            <button class="inject-btn inject-btn-primary" id="inject-apply">🚀 Apply to Scratch</button>
            <button class="inject-btn inject-btn-secondary" id="inject-preview">👁 미리보기</button>
            <button class="inject-btn inject-btn-ghost" id="inject-clear">🗑 지우기</button>
          </div>
          <div id="inject-preview-panel" style="display:none; margin-top:8px;">
            <div style="font-size:10px; color:#6b7280; margin-bottom:3px;">변환 결과(평면 딕셔너리) 미리보기:</div>
            <textarea id="inject-preview-output" readonly style="width:100%; height:120px; font-family:monospace; font-size:10px; background:#f0fdf4; border:1px solid #86efac; border-radius:4px; resize:vertical; color:#14532d;"></textarea>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // Toggle logic
  const openHUD = () => {
    root.classList.add("open");
    toggleBtn.textContent = "HUD 닫기";
  };
  const closeHUD = () => {
    root.classList.remove("open");
    toggleBtn.textContent = "HUD 열기";
  };
  toggleBtn.addEventListener("click", () =>
    root.classList.contains("open") ? closeHUD() : openHUD()
  );
  root.querySelector("#hud-close").addEventListener("click", closeHUD);

  // 3) Help database (MVP 5개)
  const HELP_DB = {
    event_whenflagclicked: {
      title: "초록 깃발 클릭 시 시작",
      chips: ["시작 블록", "엔트리 포인트"],
      tips: [
        "모든 스크립트는 시작 블록이 필요해요.",
        "테스트할 때는 초록 깃발을 누르고 확인하세요.",
      ],
    },
    control_forever: {
      title: "영원 반복",
      chips: ["반복", "루프"],
      tips: [
        "계속 움직이는 동작은 영원 반복 안에 넣으세요.",
        "너무 많은 블록을 한 루프에 넣으면 렉이 걸릴 수 있어요.",
      ],
    },
    forward: {
      // motion_movesteps: {
      title: "이동: 몇 걸음 움직이기",
      chips: ["이동", "좌표"],
      tips: [
        "한 번만 움직인다면 반복 블록 안에 넣어보세요.",
        "스테이지 경계에서 튕기기와 함께 자주 사용돼요.",
      ],
    },
    control_if: {
      title: "만약 ~라면",
      chips: ["조건", "분기"],
      tips: [
        "비교 연산자(=, <, >)와 함께 사용하세요.",
        "센서/키보드 입력 조건을 묶어 이벤트 반응을 만들 수 있어요.",
      ],
    },
    event_broadcast: {
      title: "방송 보내기",
      chips: ["모듈화", "신호"],
      tips: [
        "수신 이름이 정확히 일치해야 받아요.",
        "여러 스프라이트 동기화에 유용해요.",
      ],
    },
    data_setvariableto: {
      title: "변수 값 정하기",
      chips: ["상태", "데이터"],
      tips: [
        "먼저 변수를 만들고 이름을 정하세요.",
        "게임 점수/체력처럼 변화를 저장할 때 사용해요.",
      ],
    },
  };

  let latestSelected = null; // { opcode, human }
  let lastSnapshot = null; // workspace snapshot

  // 4) Messaging with page_bridge
  window.addEventListener("message", (ev) => {
    const data = ev.data;
    if (!data || data.source !== "scratch-hud") return;

    if (data.type === "BLOCK_SELECTED") {
      latestSelected = data.payload;
      updateHelp(latestSelected);
    }
    if (data.type === "WORKSPACE_SNAPSHOT") {
      lastSnapshot = data.payload;
      renderChecklist(lastSnapshot);
      if (lastSnapshot.rawBlocksByTarget) {
        const jsonView = root.querySelector("#live-json-view");
        if (jsonView) {
          jsonView.value = JSON.stringify(lastSnapshot.rawBlocksByTarget, null, 2);
        }

        try {
          if (window.ScratchParser) {
            const parsedByTarget = {};
            for (const [targetName, blocksDict] of Object.entries(lastSnapshot.rawBlocksByTarget)) {
              const parser = new window.ScratchParser(blocksDict);
              parsedByTarget[targetName] = parser.parseAllScripts();
            }
            const parsedView = root.querySelector("#live-parsed-view");
            if (parsedView) {
              parsedView.value = JSON.stringify(parsedByTarget, null, 2);
            }
          }
        } catch(e) {
          console.error("Scratch HUD Coach: Error parsing json", e);
        }
      }
    }
    if (data.type === "APPLY_RESULT") {
      showInjectStatus(data.payload);
    }
  });

  // Ask for a snapshot initially (in case bridge missed)
  setTimeout(() => {
    window.postMessage(
      { source: "scratch-hud-content", type: "REQUEST_SNAPSHOT" },
      "*"
    );
  }, 1200);

  // 5) Help renderer
  function updateHelp(sel) {
    const titleEl = root.querySelector("#help-title");
    const chipsEl = root.querySelector("#help-chips");
    const tipsEl = root.querySelector("#help-tips");
    chipsEl.innerHTML = "";
    tipsEl.innerHTML = "";

    const help = HELP_DB[sel?.opcode];
    if (!help) {
      titleEl.textContent =
        sel?.human || "블록을 선택하면 팁이 여기에 표시됩니다.";
      return;
    }
    titleEl.textContent = help.title;
    help.chips.forEach((c) => {
      const e = document.createElement("span");
      e.className = "chip";
      e.textContent = c;
      chipsEl.appendChild(e);
    });
    help.tips.forEach((t) => {
      const li = document.createElement("li");
      li.className = "hud-tip";
      li.textContent = t;
      tipsEl.appendChild(li);
    });
  }

  // 6) Checklist rules (MVP 5개)
  function runChecks(snap) {
    const set = new Set(snap.opcodes || []);
    const passes = [];

    // 1) 초록 깃발 시작 존재
    const hasFlag = set.has("event_whenflagclicked");
    passes.push({
      id: "flag",
      pass: hasFlag,
      label: "초록 깃발 시작 블록 있음",
    });

    // 2) 반복문 존재
    const hasLoop = !!snap.hasLoop;
    passes.push({
      id: "loop",
      pass: hasLoop,
      label: "반복(영원/반복/조건반복) 사용",
    });

    // 3) 변수 사용 시 변수 생성
    const usesVarOp = !!snap.usesVariableOp;
    const hasVariables = (snap.variablesCount || 0) > 0;
    const varOk = usesVarOp ? hasVariables : true;
    passes.push({ id: "vars", pass: varOk, label: "변수 사용 전 변수 생성" });

    // 4) 방송 이름 일치
    const sends = new Set(snap.broadcastSends || []);
    const receives = new Set(snap.broadcastReceives || []);
    let intersect = false;
    sends.forEach((n) => {
      if (receives.has(n)) intersect = true;
    });
    const broadcastOk =
      sends.size === 0 && receives.size === 0 ? true : intersect;
    passes.push({
      id: "broadcast",
      pass: broadcastOk,
      label: "방송/수신 이름 일치",
    });

    // 5) 반복 없이 이동만 있는 패턴 경고
    const moveWarn = snap.hasMotion && !snap.hasLoop;
    passes.push({
      id: "motionLoop",
      pass: !moveWarn,
      label: "이동 동작은 반복 안에서 실행",
    });

    return passes;
  }

  function renderChecklist(snap) {
    if (!snap) return;
    const target = root.querySelector("#checklist");
    const items = runChecks(snap);
    target.innerHTML = items
      .map(
        (it) => `
      <div class="checklist-item">
        <span class="badge ${it.pass ? "pass" : "fail"}">${
          it.pass ? "OK" : "확인"
        }</span>
        <div>${it.label}</div>
      </div>`
      )
      .join("");

    // Tips when fail
    const extra = document.createElement("div");
    extra.style.marginTop = "6px";
    items
      .filter((i) => !i.pass)
      .forEach((i) => {
        const tip = document.createElement("div");
        tip.className = "checklist-item";
        tip.innerHTML = `<span class="badge info">Hint</span><div>${getFixTip(
          i.id
        )}</div>`;
        extra.appendChild(tip);
      });
    target.appendChild(extra);
  }

  function getFixTip(id) {
    switch (id) {
      case "flag":
        return "이벤트 → 초록 깃발 클릭했을 때 블록을 스크립트의 맨 위에 두세요.";
      case "loop":
        return "제어 → 영원 반복(또는 반복) 안에 계속 실행할 블록을 넣으세요.";
      case "vars":
        return "변수 카테고리에서 변수를 먼저 만들고, 값 정하기/변경하기 블록을 사용하세요.";
      case "broadcast":
        return "이벤트 → 방송 보내기와 방송을 받았을 때의 이름이 정확히 같아야 해요.";
      case "motionLoop":
        return "한 번만 움직이면 반복 안에 이동 블록을 넣어보세요.";
      default:
        return "";
    }
  }

  // 7) Self-check card actions
  root.querySelector("#sc-capture").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, (res) => {
      const prev = root.querySelector("#sc-preview");
      const img = root.querySelector("#sc-img");
      if (res && res.ok) {
        prev.style.display = "block";
        img.src = res.dataUrl;
      } else {
        prev.style.display = "block";
        img.alt = "캡처 실패";
      }
    });
  });

  root.querySelector("#sc-copy").addEventListener("click", async () => {
    const expected = root.querySelector("#sc-expected").value.trim();
    const actual = root.querySelector("#sc-actual").value.trim();
    const tried = root.querySelector("#sc-tried").value.trim();
    const checks = (lastSnapshot ? runChecks(lastSnapshot) : [])
      .map((c) => `- ${c.label}: ${c.pass ? "OK" : "필요"}`)
      .join("\n");
    const sel = latestSelected
      ? `${latestSelected.opcode} — ${latestSelected.human}`
      : "(선택 안 됨)";

    const text = `【질문 전 요약】\n선택 블록: ${sel}\n\n[기대]\n${expected}\n\n[실제]\n${actual}\n\n[시도]\n${tried}\n\n[체크리스트]\n${checks}`;

    try {
      await navigator.clipboard.writeText(text);
      alert("요약을 클립보드에 복사했어요.");
    } catch (e) {
      prompt("복사가 제한되어 직접 복사해주세요:", text);
    }
  });

  // 8) Keyboard shortcuts routed from background (optional)
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === "prepare-question") openHUD();
    if (msg.type === "toggle-hud")
      root.classList.contains("open") ? closeHUD() : openHUD();
  });

  // ─────────────────────────────────────────────
  // 9) AI 블록 주입 패널 핸들러
  // ─────────────────────────────────────────────

  /** JSON 파싱 → validate → deparse 공통 처리. 성공 시 flatBlocks 반환, 실패 시 null. */
  function parseAndDeparse(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw.trim());
    } catch (e) {
      showInjectStatus({ ok: false, error: `JSON 파싱 오류: ${e.message}` });
      return null;
    }

    if (!window.ScratchParser) {
      showInjectStatus({ ok: false, error: 'ScratchParser가 로드되지 않았습니다.' });
      return null;
    }

    const validation = window.ScratchParser.validate(parsed);
    if (!validation.ok) {
      showInjectStatus({ ok: false, error: `유효성 오류: ${validation.error}` });
      return null;
    }

    try {
      return window.ScratchParser.deparse(parsed);
    } catch (e) {
      showInjectStatus({ ok: false, error: `역파서 오류: ${e.message}` });
      return null;
    }
  }

  /** 상태 표시줄 업데이트 */
  function showInjectStatus({ ok, error, count, method }) {
    const el = root.querySelector('#inject-status');
    if (!el) return;
    el.style.display = 'block';
    el.style.fontWeight = 'normal';

    if (ok) {
      const isXml = method && method.includes('xml');
      if (isXml) {
        // Strategy 1 성공: 새로고침 없이 즉시 반영됨
        el.style.background = '#dcfce7';
        el.style.color = '#14532d';
        el.style.border = '1px solid #86efac';
        el.textContent = `✅ 즉시 반영 완료! ${count}개 블록이 에디터에 바로 나타났습니다.`;
      } else {
        // Strategy 2 폴백: 데이터는 주입됐으나 GUI 갱신이 지연될 수 있음
        el.style.background = '#fff7ed';
        el.style.color = '#9a3412';
        el.style.border = '1px solid #fdba74';
        el.textContent = `⚠️ 데이터 주입 완료 (${count}개). GUI 갱신이 지연될 수 있습니다. 블록 영역을 클릭해 보세요.`;
      }
    } else {
      el.style.background = '#fee2e2';
      el.style.color = '#7f1d1d';
      el.style.border = '1px solid #fecaca';
      el.textContent = `❌ ${error}`;
    }
    // 8초 뒤 자동 숨김
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.display = 'none'; }, 8000);
  }

  // [🚀 Apply to Scratch]
  root.querySelector('#inject-apply').addEventListener('click', () => {
    const raw = root.querySelector('#inject-json-input').value.trim();
    if (!raw) {
      showInjectStatus({ ok: false, error: '입력창이 비어 있습니다.' });
      return;
    }
    const flatBlocks = parseAndDeparse(raw);
    if (!flatBlocks) return; // 오류는 이미 showInjectStatus로 표시됨

    // 전송 전 즉시 '처리 중' 표시
    const statusEl = root.querySelector('#inject-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.style.background = '#e0f2fe';
      statusEl.style.color = '#075985';
      statusEl.style.border = '1px solid #bae6fd';
      statusEl.textContent = '⏳ Scratch 에디터에 블록을 주입하는 중...';
    }

    window.postMessage(
      {
        source: 'scratch-hud-content',
        type: 'APPLY_WORKSPACE_UPDATE',
        payload: { blocks: flatBlocks },
      },
      '*'
    );
  });

  // [👁 미리보기]
  root.querySelector('#inject-preview').addEventListener('click', () => {
    const raw = root.querySelector('#inject-json-input').value.trim();
    if (!raw) {
      showInjectStatus({ ok: false, error: '입력창이 비어 있습니다.' });
      return;
    }
    const flatBlocks = parseAndDeparse(raw);
    if (!flatBlocks) return;

    const panel = root.querySelector('#inject-preview-panel');
    const output = root.querySelector('#inject-preview-output');
    panel.style.display = 'block';
    output.value = JSON.stringify(flatBlocks, null, 2);
    showInjectStatus({ ok: true, count: Object.keys(flatBlocks).length, _preview: true });
    // 미리보기용 메시지 오버라이드
    const el = root.querySelector('#inject-status');
    if (el) el.textContent = `🔍 변환 완료: ${Object.keys(flatBlocks).length}개 블록 (주입 안 됨, 미리보기만)`;
  });

  // [🗑 지우기]
  root.querySelector('#inject-clear').addEventListener('click', () => {
    root.querySelector('#inject-json-input').value = '';
    root.querySelector('#inject-preview-panel').style.display = 'none';
    root.querySelector('#inject-preview-output').value = '';
    const el = root.querySelector('#inject-status');
    if (el) el.style.display = 'none';
  });
})();
