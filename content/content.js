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
    </div>
    <div id="hud-coach-body">

      <div class="hud-section" style="margin-top: 5px;">
        <h4>1단계: 원본 JSON (사전형)</h4>
        <div class="hud-card" style="padding: 5px;">
          <textarea id="live-json-view" style="width:100%; height:100px; font-family:monospace; font-size:11px; white-space:pre; resize:vertical; background:#f9f9f9; border:1px solid #ccc; border-radius:4px;" readonly placeholder="현재 화면에 배치된 스크래치 블록의 원본 구조"></textarea>
        </div>
      </div>

      <div class="hud-section" style="margin-top: 10px;">
        <h4>2단계: 정규화 파싱(배열형)</h4>
        <div class="hud-card" style="padding: 5px;">
          <textarea id="live-parsed-view" style="width:100%; height:120px; font-family:monospace; font-size:11px; white-space:pre; resize:vertical; background:#eef2ff; border:1px solid #c7d2fe; border-radius:4px; color:#312e81;" readonly placeholder="정규화된 논리적 시퀀스 및 주석(comment)이 나타납니다."></textarea>
        </div>
      </div>

      <div class="hud-section" style="margin-top: 15px;">
        <h4 style="color: #4f46e5; display: flex; align-items: center; justify-content: space-between;">
          <span>📝 AI 주석 가이드 생성기</span>
        </h4>
        <div class="hud-card" style="padding: 10px; background: #fafafa; border-color: #d1d5db;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #e5e7eb;">
            <span style="font-size: 12px; font-weight: 600; color: #4b5563;">가이드북 난이도</span>
            <select id="hud-comment-level-select" style="font-size: 12px; padding: 4px 8px; border-radius: 6px; border: 1px solid #d1d5db; background: white; cursor: pointer; color: #374151; font-weight: 500; outline: none;">
              <option value="basic">기초 단계 (직접 지시)</option>
              <option value="advanced">심화 단계 (간접 미션)</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="ai-btn ai-btn-primary" id="btn-copy-prompt">
              📋 AI 프롬프트 복사
            </button>
            <button class="ai-btn ai-btn-secondary" id="btn-generate-guide">
              🚀 주석 가이드 생성
            </button>
          </div>
          <div id="ai-status" style="font-size:11px; margin-top: 8px; padding: 6px; border-radius:4px; display:none; line-height: 1.4;"></div>
        </div>
      </div>

      <div class="hud-section" style="margin-top: 12px;">
        <h4 style="color: #065f46; margin-bottom: 6px;">📄 주석 가이드 미리보기</h4>
        <div class="hud-card" style="padding: 8px; background: #f0fdf4; border-color: #bbf7d0;">
          <div style="font-size:11px; color:#065f46; margin-bottom:6px; line-height:1.5;">
            생성된 가이드를 확인하고, 학생용 자료로 복사하세요.
          </div>
          <textarea
            id="guidebook-preview-view"
            placeholder="🚀 주석 가이드 생성 버튼을 누르면 여기에 결과가 표시됩니다."
            readonly
          ></textarea>
          <div style="margin-top:6px;">
            <button class="ai-btn ai-btn-guide-copy" id="btn-copy-guide">
              📋 가이드 복사
            </button>
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


  let lastSnapshot = null;
  let lastParsedByTarget = null;

  // 4) Messaging with page_bridge
  window.addEventListener("message", (ev) => {
    const data = ev.data;
    if (!data || data.source !== "scratch-hud") return;

    if (data.type === "WORKSPACE_SNAPSHOT") {
      lastSnapshot = data.payload;
      if (lastSnapshot.rawBlocksByTarget) {
        const jsonView = root.querySelector("#live-json-view");
        if (jsonView) {
          jsonView.value = JSON.stringify(lastSnapshot.rawBlocksByTarget, null, 2);
        }

        try {
          if (window.ScratchParser) {
            const parsedByTarget = {};
            for (const [targetName, blocksDict] of Object.entries(lastSnapshot.rawBlocksByTarget)) {
              const commentsDict = (lastSnapshot.rawCommentsByTarget || {})[targetName] || {};
              const parser = new window.ScratchParser(blocksDict, commentsDict);
              parsedByTarget[targetName] = parser.parseAllScripts();
            }
            lastParsedByTarget = parsedByTarget;
            const parsedView = root.querySelector("#live-parsed-view");
            if (parsedView) {
              parsedView.value = JSON.stringify(parsedByTarget, null, 2);
            }
          }
        } catch (e) {
          console.error("Scratch HUD Coach: Error parsing json", e);
        }
      } else {
        lastParsedByTarget = null;
      }
    }
  });

  // Ask for a snapshot initially
  setTimeout(() => {
    window.postMessage(
      { source: "scratch-hud-content", type: "REQUEST_SNAPSHOT" },
      "*"
    );
  }, 1200);

  // Keyboard shortcuts routed from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === "toggle-hud")
      root.classList.contains("open") ? closeHUD() : openHUD();
  });

  // Load initial comment level & bind change event
  (async function initDifficultySettings() {
    try {
      const data = await chrome.storage.sync.get("hud_comment_level");
      const selectEl = root.querySelector("#hud-comment-level-select");
      if (selectEl && data.hud_comment_level) {
        selectEl.value = data.hud_comment_level;
      }
    } catch (e) {
      console.warn("Scratch HUD Coach: Failed to load difficulty level from storage", e);
    }
  })();

  const difficultySelect = root.querySelector("#hud-comment-level-select");
  if (difficultySelect) {
    difficultySelect.addEventListener("change", async (e) => {
      try {
        await chrome.storage.sync.set({ hud_comment_level: e.target.value });
      } catch (err) {
        console.error("Scratch HUD Coach: Failed to save difficulty level", err);
      }
    });
  }

  // Sync when storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.hud_comment_level) {
      const selectEl = root.querySelector("#hud-comment-level-select");
      if (selectEl) {
        selectEl.value = changes.hud_comment_level.newValue;
      }
    }
  });

  // ─────────────────────────────────────────────
  // 5) 상태 메시지 표시 헬퍼
  // ─────────────────────────────────────────────

  function showAiStatus(msg, type) {
    var t = type || "info";
    const el = root.querySelector('#ai-status');
    if (!el) return;
    el.style.display = 'block';

    if (t === "success") {
      el.style.background = '#dcfce7'; el.style.color = '#14532d'; el.style.border = '1px solid #86efac';
    } else if (t === "error") {
      el.style.background = '#fee2e2'; el.style.color = '#7f1d1d'; el.style.border = '1px solid #fecaca';
    } else if (t === "warning") {
      el.style.background = '#fef08a'; el.style.color = '#854d0e'; el.style.border = '1px solid #fde047';
    } else {
      el.style.background = '#e0f2fe'; el.style.color = '#075985'; el.style.border = '1px solid #bae6fd';
    }

    el.innerHTML = msg;
    clearTimeout(el._timeout);
    el._timeout = setTimeout(function() { el.style.display = 'none'; }, 6000);
  }

  // ─────────────────────────────────────────────
  // 6) 가이드북 생성용 프롬프트 템플릿
  //    (고정 주석 포맷 양식 + 난이도별 규칙 + 실제 예시 포함)
  // ─────────────────────────────────────────────

  const BASIC_LEVEL_INSTRUCTION =
`같은 포맷 안에서 난이도에 따라 [ ] 대괄호 안에 들어갈 단어의 구체성만 다르게 조절합니다.

기초 단계 (직접 지시형): 블록에 적힌 텍스트를 [100% 그대로] 적어줍니다. 조립 위치도 위, 아래, 안쪽 등으로 정확히 짚어줍니다.

적용 예시 (기초 직접 지시):
[1단계: 캐릭터 움직이기]
목표: 깃발을 누르면 고양이가 앞으로 걸어갑니다.

■ 고양이
1. [클릭했을 때] 블록을 먼저 꺼냅니다.
2. 그 바로 아래에 [10 만큼 움직이기] 블록을 자석처럼 붙여줍니다.
3. 숫자를 [50]으로 바꾸고 화면의 초록 깃발을 눌러 확인합니다.`;

  const ADVANCED_LEVEL_INSTRUCTION =
`같은 포맷 안에서 난이도에 따라 [ ] 대괄호 안에 들어갈 단어의 구체성만 다르게 조절합니다.

심화 단계 (간접 미션형): 구체적인 숫자가 포함된 블록 이름 대신 [기능이나 목적] 중심으로 돌려서 표현합니다. 조건문이나 반복문의 구조는 아이들이 직접 설계하도록 유도합니다.
★단, 게임이 올바르게 작동하기 위해 필요한 필수 초기값이나 기준 정보는 심화 단계에서도 구체적인 숫자/텍스트 정보를 그대로 명시해야 합니다:
1. 캐릭터의 초기 위치 (예: x: [-150], y: [100] 위치로 이동하기)
2. 초기 크기 및 방향 (예: 크기를 [80]%로 정하기, [90]도 방향 보기)
3. 대기/지연 시간 (예: [2]초 기다리기)
4. 특정 조작 키 (예: [스페이스] 키를 눌렀을 때)
5. 특정 송수신 신호명 (예: [고기 구워짐] 신호 보내기)
6. 변수 초기화 값 (예: [점수]를 [0]으로 정하기)

적용 예시 (심화 간접 언급 - 고기굽기 프로젝트):
[3단계: 불판에 고기 올리기]
목표: 접시를 클릭했을 때 불판 위에 구울 고기를 새로 만들어냅니다.

■ 고기접시
1. 마우스가 접시에 [닿았는지] 그리고 마우스를 [클릭했는지] 동시에 계속 감시하도록 만듭니다.
2. 두 조건이 모두 맞다면 불판에 보낼 [고기 신호]를 발생시킵니다.

■ 불판
1. 방금 만든 [고기 신호를 받았을 때] 작동을 시작합니다.
2. 플레이어가 불판을 마우스로 클릭하면, 구워질 [고기 복제본]을 하나 만들어내고 감시를 종료합니다.`;

  const PROMPT_TEMPLATE =
`당신은 스크래치 3.0(Scratch 3.0) 전문 코칭 AI이자 교육 자료 제작자입니다.
전달받은 [정답 프로젝트 JSON]은 완성된 스크래치 과제의 논리 구조입니다.
이 정답 코드를 분석하여, 학생들이 단계별로 따라 하며 스스로 이 프로젝트를 완성할 수 있도록 돕는 "스캐폴딩 주석 가이드북"을 작성해 주세요.

### 🗣 어조 및 단어 선택 규칙 (초등/중등 수준 최적화)

- **대상 독자:** 초등학교 고학년 및 중학생
- **지향할 점:** 아이들의 눈높이에 맞춘 친근하고 직관적이며 이해하기 쉬운 표현을 사용해 주세요. (예: "~ 아래에 자석처럼 붙여줍니다", "회전 방향을 정해줍니다", "시작 깃발을 누르면")
- **지양할 점:** 지나치게 기술적이거나 기계적이고 딱딱한 한자어/영문 직역 표현은 절대 사용하지 마세요.
  - ❌ 나쁜 예: "전체 스크립트 최종 최하단 마무리 지점에 [(90) 도 방향 보기] 동작 블록을 완벽 도킹하여 수평 정방향 축을 유지시킵니다."
  - ⭕ 좋은 예 (기초): "맨 아래에 [(90)도 방향 보기] 블록을 붙여서 캐릭터가 오른쪽을 똑바로 바라보도록 만듭니다."
  - ⭕ 좋은 예 (심화): "캐릭터가 [오른쪽을 똑바로 바라보도록] 회전 방향을 설정해 줍니다."
  - ❌ 금지어 예시: 완벽 도킹, 수평 정방향 축 유지, 메모리에 적재, 데이터베이스에 바인딩, 루프 내부 분기, 세션 시작 등

### 📝 고정 주석 포맷 양식

반드시 각 중요 스크립트(동작 단위)마다 다음 형식을 엄격히 지켜 작성해 주세요 (Markdown 백틱 기호 없이 순수 텍스트로만 반환):

[단계 제목]
목표: 이 단계에서 완성할 동작을 한 줄로 요약합니다.

■ 스프라이트 이름
1. 구현 가이드 (난이도별 차등 적용)
2. 구현 가이드

---

### 🛠 난이도별 블록 설명 작성 규칙: [주석 난이도 레벨: {USER_SELECTED_LEVEL}]

{LEVEL_SPECIFIC_INSTRUCTION}

---

### 💡 실제 적용 예시 (동일 포맷 비교)

#### 1. 기초 레벨 프로젝트 적용 예시 (직접 지시)

[1단계: 캐릭터 움직이기]
목표: 깃발을 누르면 고양이가 앞으로 걸어갑니다.

■ 고양이
1. [클릭했을 때] 블록을 먼저 꺼냅니다.
2. 그 바로 아래에 [10 만큼 움직이기] 블록을 자석처럼 붙여줍니다.
3. 숫자를 [50]으로 바꾸고 화면의 초록 깃발을 눌러 확인합니다.

#### 2. 심화 레벨 프로젝트 적용 예시 (간접 언급 - 고기굽기 프로젝트)

[3단계: 불판에 고기 올리기]
목표: 접시를 클릭했을 때 불판 위에 구울 고기를 새로 만들어냅니다.

■ 고기접시
1. 마우스가 접시에 [닿았는지] 그리고 마우스를 [클릭했는지] 동시에 계속 감시하도록 만듭니다.
2. 두 조건이 모두 맞다면 불판에 보낼 [고기 신호]를 발생시킵니다.

■ 불판
1. 방금 만든 [고기 신호를 받았을 때] 작동을 시작합니다.
2. 플레이어가 불판을 마우스로 클릭하면, 구워질 [고기 복제본]을 하나 만들어내고 감시를 종료합니다.

---

[정답 프로젝트 JSON]
{JSON_DATA}`;

  // ─────────────────────────────────────────────
  // 7) [📋 AI 프롬프트 복사]
  // ─────────────────────────────────────────────

  root.querySelector('#btn-copy-prompt').addEventListener('click', async function() {
    if (!lastParsedByTarget || Object.keys(lastParsedByTarget).length === 0) {
      showAiStatus('블록 데이터가 없습니다. 스크래치 화면에 블록을 추가하세요.', 'warning');
      return;
    }

    const selectEl = root.querySelector("#hud-comment-level-select");
    const level = selectEl ? selectEl.value : "basic";

    const levelStr = level === "basic" ? "기초 단계 (직접 지시형)" : "심화 단계 (간접 미션형)";
    const levelInst = level === "basic" ? BASIC_LEVEL_INSTRUCTION : ADVANCED_LEVEL_INSTRUCTION;

    const promptStr = PROMPT_TEMPLATE
      .replace('{USER_SELECTED_LEVEL}', levelStr)
      .replace('{LEVEL_SPECIFIC_INSTRUCTION}', levelInst)
      .replace('{JSON_DATA}', JSON.stringify(lastParsedByTarget, null, 2));

    try {
      await navigator.clipboard.writeText(promptStr);
      showAiStatus('✅ 프롬프트가 클립보드에 복사되었습니다. ChatGPT나 Gemini에 붙여넣으세요!', 'success');
    } catch (err) {
      showAiStatus('복사에 실패했습니다. 권한을 확인하세요.', 'error');
    }
  });

  // ─────────────────────────────────────────────
  // 8) opcode → 한글 설명 매핑 (로컬 Mock AI 가이드 생성용)
  // ─────────────────────────────────────────────

  const OPCODE_LABEL_BASIC = {
    // 이벤트
    'event_whenflagclicked':     '초록 깃발이 [클릭되었을 때] 블록을 배치합니다.',
    'event_whenkeypressed':      '[{KEY} 키를 눌렀을 때] 블록을 배치합니다.',
    'event_whenthisspriteclicked': '[이 스프라이트를 클릭했을 때] 블록을 배치합니다.',
    'event_whenbroadcastreceived': '[{BROADCAST_OPTION} 신호를 받았을 때] 블록을 배치합니다.',
    'event_broadcast':           '[{BROADCAST_INPUT} 신호 보내기] 블록을 조립합니다.',
    'event_broadcastandwait':    '[{BROADCAST_INPUT} 신호 보내고 기다리기] 블록을 조립합니다.',
    // 동작
    'motion_movesteps':          '[{STEPS} 만큼 움직이기] 블록을 아래에 조립합니다.',
    'motion_turnright':          '[{DEGREES} 도 돌기(오른쪽)] 블록을 조립합니다.',
    'motion_turnleft':           '[{DEGREES} 도 돌기(왼쪽)] 블록을 조립합니다.',
    'motion_gotoxy':             'x: [{X}] y: [{Y}] 로 이동하기 블록을 조립합니다.',
    'motion_glidesecstoxy':      '[{SECS} 초 동안 x: {X} y: {Y} 로 이동하기] 블록을 조립합니다.',
    'motion_pointindirection':   '[{DIRECTION} 도 방향 보기] 블록을 조립합니다.',
    'motion_pointtowards':       '[{TOWARDS} 쪽 보기] 블록을 조립합니다.',
    'motion_goto':               '[{TO} 로 이동하기] 블록을 조립합니다.',
    'motion_ifonedgebounce':     '[벽에 닿으면 튕기기] 블록을 조립합니다.',
    'motion_setx':               'x 좌표를 [{X}] 로 정하기 블록을 조립합니다.',
    'motion_sety':               'y 좌표를 [{Y}] 로 정하기 블록을 조립합니다.',
    'motion_changexby':          'x 좌표를 [{DX} 만큼 바꾸기] 블록을 조립합니다.',
    'motion_changeyby':          'y 좌표를 [{DY} 만큼 바꾸기] 블록을 조립합니다.',
    // 형태
    'looks_show':                '[보이기] 블록을 조립합니다.',
    'looks_hide':                '[숨기기] 블록을 조립합니다.',
    'looks_sayforsecs':          '[{MESSAGE} 라고 {SECS} 초 동안 말하기] 블록을 조립합니다.',
    'looks_say':                 '[{MESSAGE} 라고 말하기] 블록을 조립합니다.',
    'looks_thinkforsecs':        '[{MESSAGE} 라고 {SECS} 초 동안 생각하기] 블록을 조립합니다.',
    'looks_switchcostumeto':     '[{COSTUME} 모양으로 바꾸기] 블록을 조립합니다.',
    'looks_nextcostume':         '[다음 모양으로 바꾸기] 블록을 조립합니다.',
    'looks_setsizeto':           '[크기를 {SIZE} 로 정하기] 블록을 조립합니다.',
    'looks_changesizeby':        '[크기를 {CHANGE} 만큼 바꾸기] 블록을 조립합니다.',
    'looks_createclone':         '[{CLONE_OPTION} 의 복제본 만들기] 블록을 조립합니다.',
    'looks_deletethisclone':     '[이 복제본 삭제하기] 블록을 조립합니다.',
    // 소리
    'sound_play':                '[{SOUND_MENU} 소리 재생하기] 블록을 조립합니다.',
    'sound_playuntildone':       '[{SOUND_MENU} 소리 재생이 끝날 때까지 기다리기] 블록을 조립합니다.',
    'sound_stopallsounds':       '[모든 소리 끄기] 블록을 조립합니다.',
    // 제어
    'control_wait':              '[{DURATION} 초 기다리기] 블록을 조립합니다.',
    'control_repeat':            '[{TIMES} 번 반복하기] 블록을 조립하고, 반복할 내용을 안쪽에 넣습니다.',
    'control_forever':           '[계속 반복하기] 블록을 조립하고, 반복할 내용을 안쪽에 넣습니다.',
    'control_if':                '[만약 (조건) 이라면] 블록을 조립하고, 조건이 맞을 때 실행할 내용을 안쪽에 넣습니다.',
    'control_if_else':           '[만약 (조건) 이라면 / 아니면] 블록을 조립하고, 각 경우의 내용을 안쪽에 넣습니다.',
    'control_repeat_until':      '[(조건) 이 될 때까지 반복하기] 블록을 조립합니다.',
    'control_stop':              '[{STOP_OPTION} 멈추기] 블록을 조립합니다.',
    'control_start_as_clone':    '[복제되었을 때] 블록을 배치합니다.',
    // 감지
    'sensing_touchingobject':    '[(물체)에 닿았는가?] 블록을 조건 칸에 넣습니다.',
    'sensing_touchingcolor':     '[(색)에 닿았는가?] 블록을 조건 칸에 넣습니다.',
    'sensing_keypressed':        '[{KEY_OPTION} 키를 눌렀는가?] 블록을 조건 칸에 넣습니다.',
    'sensing_mousedown':         '[마우스를 클릭했는가?] 블록을 조건 칸에 넣습니다.',
    'sensing_distanceto':        '[{DISTANCETOMENU} 까지의 거리] 블록을 값 칸에 넣습니다.',
    'sensing_askandwait':        '[{QUESTION} 라고 묻고 기다리기] 블록을 조립합니다.',
    // 연산
    'operator_add':              '숫자를 더하는 [{NUM1} + {NUM2}] 연산 블록을 값 칸에 넣습니다.',
    'operator_subtract':         '숫자를 빼는 [{NUM1} - {NUM2}] 연산 블록을 값 칸에 넣습니다.',
    'operator_multiply':         '숫자를 곱하는 [{NUM1} * {NUM2}] 연산 블록을 값 칸에 넣습니다.',
    'operator_divide':           '숫자를 나누는 [{NUM1} / {NUM2}] 연산 블록을 값 칸에 넣습니다.',
    'operator_equals':           '[{OPERAND1} = {OPERAND2}] 비교 블록을 조건 칸에 넣습니다.',
    'operator_gt':               '[{OPERAND1} > {OPERAND2}] 비교 블록을 조건 칸에 넣습니다.',
    'operator_lt':               '[{OPERAND1} < {OPERAND2}] 비교 블록을 조건 칸에 넣습니다.',
    'operator_and':              '[{OPERAND1} 그리고 {OPERAND2}] 논리 블록을 조건 칸에 넣습니다.',
    'operator_or':               '[{OPERAND1} 또는 {OPERAND2}] 논리 블록을 조건 칸에 넣습니다.',
    'operator_not':              '[{OPERAND} 이(가) 아님] 논리 블록을 조건 칸에 넣습니다.',
    'operator_random':           '[{FROM} 부터 {TO} 사이의 난수] 블록을 값 칸에 넣습니다.',
    // 변수·리스트
    'data_setvariableto':        '[{VARIABLE} 을(를) {VALUE} 로 정하기] 블록을 조립합니다.',
    'data_changevariableby':     '[{VARIABLE} 을(를) {VALUE} 만큼 바꾸기] 블록을 조립합니다.',
    'data_addtolist':            '[{ITEM} 을(를) {LIST} 에 추가하기] 블록을 조립합니다.',
    'data_deleteoflist':         '[{LIST} 의 {INDEX} 번째 항목 삭제하기] 블록을 조립합니다.',
    'data_deletealloflist':      '[{LIST} 의 모든 항목 삭제하기] 블록을 조립합니다.',
  };

  const OPCODE_LABEL_ADVANCED = {
    // 이벤트
    'event_whenflagclicked':     '프로그램의 [시작 신호]를 받아 동작을 시작합니다.',
    'event_whenkeypressed':      '[{KEY} 키를 눌렀을 때] 작동을 시작합니다.',
    'event_whenthisspriteclicked': '이 스프라이트를 [클릭했을 때] 작동을 시작합니다.',
    'event_whenbroadcastreceived': '[{BROADCAST_OPTION} 신호를 받았을 때] 작동을 시작합니다.',
    'event_broadcast':           '다른 스프라이트에게 [{BROADCAST_INPUT} 신호를 보내는] 블록을 조립합니다.',
    'event_broadcastandwait':    '다른 스프라이트에게 [{BROADCAST_INPUT} 신호를 보내고, 처리될 때까지 기다리는] 블록을 조립합니다.',
    // 동작
    'motion_movesteps':          '캐릭터를 [앞으로 이동시키는] 블록을 조립합니다.',
    'motion_turnright':          '캐릭터를 [오른쪽으로 회전시키는] 블록을 조립합니다.',
    'motion_turnleft':           '캐릭터를 [왼쪽으로 회전시키는] 블록을 조립합니다.',
    'motion_gotoxy':             '캐릭터를 [x: {X}, y: {Y}] 위치로 이동시킵니다.',
    'motion_glidesecstoxy':      '캐릭터를 [{SECS}초 동안 x: {X}, y: {Y}] 위치로 부드럽게 이동시킵니다.',
    'motion_pointindirection':   '캐릭터가 [{DIRECTION}도 방향을 바라보게 하는] 블록을 조립합니다.',
    'motion_pointtowards':       '캐릭터가 [대상 쪽을 바라보게 하는] 블록을 조립합니다.',
    'motion_goto':               '캐릭터를 [대상 위치로 이동시키는] 블록을 조립합니다.',
    'motion_ifonedgebounce':     '캐릭터가 [화면 끝에 닿으면 튕기는] 블록을 조립합니다.',
    'motion_setx':               '캐릭터의 [x 좌표를 {X} (으)로 정하는] 블록을 조립합니다.',
    'motion_sety':               '캐릭터의 [y 좌표를 {Y} (으)로 정하는] 블록을 조립합니다.',
    'motion_changexby':          '캐릭터의 [가로 위치를 바꾸는] 블록을 조립합니다.',
    'motion_changeyby':          '캐릭터의 [세로 위치를 바꾸는] 블록을 조립합니다.',
    // 형태
    'looks_show':                '캐릭터를 [화면에 나타나게 하는] 블록을 조립합니다.',
    'looks_hide':                '캐릭터를 [화면에서 숨기는] 블록을 조립합니다.',
    'looks_sayforsecs':          '캐릭터가 [일정 시간 동안 말풍선을 표시하는] 블록을 조립합니다.',
    'looks_say':                 '캐릭터가 [말풍선을 표시하는] 블록을 조립합니다.',
    'looks_thinkforsecs':        '캐릭터가 [생각하는 말풍선을 표시하는] 블록을 조립합니다.',
    'looks_switchcostumeto':     '캐릭터의 [모양을 바꾸는] 블록을 조립합니다.',
    'looks_nextcostume':         '캐릭터의 [다음 모양으로 전환하는] 블록을 조립합니다.',
    'looks_setsizeto':           '캐릭터의 [크기를 {SIZE}% 로 정하는] 블록을 조립합니다.',
    'looks_changesizeby':        '캐릭터의 [크기를 변경하는] 블록을 조립합니다.',
    'looks_createclone':         '[복제본을 새로 만드는] 블록을 조립합니다.',
    'looks_deletethisclone':     '[현재 복제본을 삭제하는] 블록을 조립합니다.',
    // 소리
    'sound_play':                '[소리를 재생하는] 블록을 조립합니다.',
    'sound_playuntildone':       '[소리 재생이 끝날 때까지 기다리는] 블록을 조립합니다.',
    'sound_stopallsounds':       '[모든 소리를 끄는] 블록을 조립합니다.',
    // 제어
    'control_wait':              '[{DURATION}초 동안 기다리는] 블록을 조립합니다.',
    'control_repeat':            '[정해진 횟수만큼 반복하는] 블록을 조립하고, 반복할 내용을 설계합니다.',
    'control_forever':           '[계속 반복하는] 블록을 조립하고, 반복할 내용을 설계합니다.',
    'control_if':                '[특정 조건일 때만 실행하는] 구조를 설계합니다.',
    'control_if_else':           '[조건에 따라 두 가지로 분기하는] 구조를 설계합니다.',
    'control_repeat_until':      '[특정 조건이 될 때까지 계속 반복하는] 구조를 설계합니다.',
    'control_stop':              '[실행을 멈추는] 블록을 조립합니다.',
    'control_start_as_clone':    '[복제되었을 때] 실행할 동작을 설계합니다.',
    // 감지
    'sensing_touchingobject':    '[특정 물체에 닿았는지 감지하는] 조건 블록을 활용합니다.',
    'sensing_touchingcolor':     '[특정 색에 닿았는지 감지하는] 조건 블록을 활용합니다.',
    'sensing_keypressed':        '[키를 눌렀는지 감지하는] 조건 블록을 활용합니다.',
    'sensing_mousedown':         '[마우스 클릭 여부를 감지하는] 조건 블록을 활용합니다.',
    'sensing_distanceto':        '[대상까지의 거리를 측정하는] 블록을 활용합니다.',
    'sensing_askandwait':        '[질문을 하고 입력을 기다리는] 블록을 조립합니다.',
    // 연산
    'operator_add':              '[두 값을 더하는] 연산 블록을 활용합니다.',
    'operator_subtract':         '[두 값을 빼는] 연산 블록을 활용합니다.',
    'operator_multiply':         '[두 값을 곱하는] 연산 블록을 활용합니다.',
    'operator_divide':           '[두 값을 나누는] 연산 블록을 활용합니다.',
    'operator_equals':           '[두 값이 같은지 비교하는] 블록을 조건 칸에 활용합니다.',
    'operator_gt':               '[값이 더 큰지 비교하는] 블록을 조건 칸에 활용합니다.',
    'operator_lt':               '[값이 더 작은지 비교하는] 블록을 조건 칸에 활용합니다.',
    'operator_and':              '[두 조건이 모두 맞아야 하는] 논리 블록을 활용합니다.',
    'operator_or':               '[두 조건 중 하나라도 맞는] 논리 블록을 활용합니다.',
    'operator_not':              '[조건이 아닐 때 실행하는] 논리 블록을 활용합니다.',
    'operator_random':           '[무작위 숫자를 사용하는] 블록을 활용합니다.',
    // 변수·리스트
    'data_setvariableto':        '[{VARIABLE} 변수의 값을 {VALUE} (으)로 정하는] 블록을 조립합니다.',
    'data_changevariableby':     '[{VARIABLE} 변수의 값을 {VALUE} 만큼 변경하는] 블록을 조립합니다.',
    'data_addtolist':            '[목록에 항목을 추가하는] 블록을 조립합니다.',
    'data_deleteoflist':         '[목록에서 항목을 삭제하는] 블록을 조립합니다.',
    'data_deletealloflist':      '[목록의 모든 항목을 삭제하는] 블록을 조립합니다.',
  };

  // opcode의 fields/inputs에서 값을 추출하여 템플릿 {KEY} 치환
  function fillOpcodeTemplate(template, block) {
    if (!template) return null;
    let result = template;
    const fields = block.fields || {};
    const inputs = block.inputs || {};

    // fields 치환
    for (const [key, val] of Object.entries(fields)) {
      const strVal = (val && typeof val === 'object') ? (val.value || val) : val;
      result = result.replace('{' + key + '}', strVal);
    }
    // inputs 치환 (단순 원시값인 경우만)
    for (const [key, val] of Object.entries(inputs)) {
      if (val !== null && typeof val !== 'object') {
        result = result.replace('{' + key + '}', val);
      } else if (val && typeof val === 'object' && !Array.isArray(val) && val.fields) {
        // 중첩 블록의 첫번째 field 값 사용
        const nestedVals = Object.values(val.fields);
        if (nestedVals.length > 0) {
          const nv = nestedVals[0];
          const nvStr = (nv && typeof nv === 'object') ? (nv.value || nv) : nv;
          result = result.replace('{' + key + '}', nvStr);
        }
      }
      // 나머지 미치환 변수는 그대로 유지
    }
    return result;
  }

  // ─────────────────────────────────────────────
  // 9) [🚀 주석 가이드 생성] - 로컬 Mock AI 가이드 생성
  // ─────────────────────────────────────────────

  root.querySelector('#btn-generate-guide').addEventListener('click', function() {
    if (!lastParsedByTarget || Object.keys(lastParsedByTarget).length === 0) {
      showAiStatus('블록 데이터가 없습니다. 스크래치 화면에 블록을 추가하세요.', 'warning');
      return;
    }

    showAiStatus('⏳ 주석 가이드를 생성하는 중입니다...', 'info');

    setTimeout(function() {
      const selectEl = root.querySelector("#hud-comment-level-select");
      const level = selectEl ? selectEl.value : "basic";
      const labelMap = level === "basic" ? OPCODE_LABEL_BASIC : OPCODE_LABEL_ADVANCED;

      const lines = [];
      let stepIndex = 1;

      for (const [targetName, scripts] of Object.entries(lastParsedByTarget)) {
        if (!Array.isArray(scripts) || scripts.length === 0) continue;

        for (const script of scripts) {
          if (!Array.isArray(script) || script.length === 0) continue;

          const topBlock = script[0];
          const topOpcode = topBlock ? topBlock.opcode : '';

          // 단계 제목 결정
          let stepTitle = '[' + stepIndex + '단계]';
          if (topOpcode === 'event_whenflagclicked') {
            stepTitle = '[' + stepIndex + '단계: 시작 설정]';
          } else if (topOpcode === 'event_whenthisspriteclicked') {
            stepTitle = '[' + stepIndex + '단계: 클릭 동작]';
          } else if (topOpcode === 'event_whenbroadcastreceived') {
            const bName = (topBlock.fields && topBlock.fields.BROADCAST_OPTION)
              ? (topBlock.fields.BROADCAST_OPTION.value || topBlock.fields.BROADCAST_OPTION)
              : '신호';
            stepTitle = '[' + stepIndex + '단계: ' + bName + ' 신호 처리]';
          } else if (topOpcode === 'control_start_as_clone') {
            stepTitle = '[' + stepIndex + '단계: 복제본 동작]';
          }

          // 목표 한 줄 설명
          const goalLine = '목표: ' + targetName + ' 스프라이트의 ' + stepIndex + '번째 스크립트를 완성합니다.';

          lines.push(stepTitle);
          lines.push(goalLine);
          lines.push('');
          lines.push('■ ' + targetName);

          let itemIndex = 1;
          for (const block of script) {
            if (!block || !block.opcode) continue;
            const tmpl = labelMap[block.opcode];
            if (tmpl) {
              const filled = fillOpcodeTemplate(tmpl, block);
              lines.push(itemIndex + '. ' + filled);
              itemIndex++;
            }
          }

          lines.push('');
          lines.push('---');
          lines.push('');
          stepIndex++;
        }
      }

      const previewEl = root.querySelector('#guidebook-preview-view');
      if (previewEl) {
        previewEl.value = lines.length > 0
          ? lines.join('\n')
          : '분석할 스크립트를 찾을 수 없습니다.';
      }
      showAiStatus('✅ 주석 가이드가 생성되었습니다. 아래 미리보기 창을 확인하세요.', 'success');
    }, 500);
  });

  // ─────────────────────────────────────────────
  // 10) [📋 가이드 복사]
  // ─────────────────────────────────────────────

  root.querySelector('#btn-copy-guide').addEventListener('click', async function() {
    const previewEl = root.querySelector('#guidebook-preview-view');
    if (!previewEl || !previewEl.value.trim()) {
      showAiStatus('복사할 가이드 내용이 없습니다. 먼저 주석 가이드를 생성하세요.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(previewEl.value);
      showAiStatus('✅ 가이드가 클립보드에 복사되었습니다!', 'success');
    } catch (err) {
      showAiStatus('복사에 실패했습니다. 권한을 확인하세요.', 'error');
    }
  });

})();
