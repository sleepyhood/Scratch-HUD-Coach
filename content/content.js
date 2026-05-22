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
      <button class="hud-close-btn" id="btn-hud-close" title="HUD 닫기">&times;</button>
    </div>
    <div id="hud-tab-nav">
      <button class="hud-tab-btn active" data-tab="guidebook">📋 가이드북</button>
      <button class="hud-tab-btn" data-tab="injector">⚡ 블록 주입기</button>
    </div>
    <div id="hud-coach-body">

      <!-- Tab 1: 가이드북 생성기 -->
      <div id="hud-tab-content-guidebook" class="hud-tab-content active">

      <div class="hud-section" style="margin-top: 4px;">
        <h4>🔍 1단계: 원본 JSON (사전형)</h4>
        <div class="hud-card">
          <textarea id="live-json-view" readonly placeholder="현재 화면에 배치된 스크래치 블록의 원본 구조"></textarea>
        </div>
      </div>

      <div class="hud-section">
        <h4>⚡ 2단계: 정규화 파싱(배열형)</h4>
        <div class="hud-card">
          <textarea id="live-parsed-view" readonly placeholder="정규화된 논리적 시퀀스 및 주석(comment)이 나타납니다."></textarea>
        </div>
      </div>

      <div class="hud-section">
        <h4 style="color: #4f46e5;">
          <span>📝 3단계: AI 주석 가이드 생성기</span>
        </h4>
        <div class="hud-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.06);">
            <span style="font-size: 12px; font-weight: 600; color: #475569;">가이드북 난이도</span>
            <select id="hud-comment-level-select" class="hud-select">
              <option value="basic">기초 단계 (직접 지시)</option>
              <option value="advanced">심화 단계 (간접 미션)</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.06);">
            <span style="font-size: 12px; font-weight: 600; color: #475569;">가이드북 스타일</span>
            <select id="hud-comment-style-select" class="hud-select">
              <option value="text">텍스트 리스트 (기본형)</option>
              <option value="pseudoblock">유사 블록 구조 (시각화형)</option>
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
          <div id="ai-status"></div>
        </div>
      </div>

      <div class="hud-section">
        <h4 style="color: #065f46; margin-bottom: 6px;">📄 4단계: 주석 가이드 미리보기</h4>
        <div class="hud-card">
          <div style="font-size:11px; color:#065f46; margin-bottom:6px; line-height:1.5; font-weight: 500;">
            생성된 가이드를 확인하고, 학생용 자료로 복사하세요.
          </div>
          <textarea
            id="guidebook-preview-view"
            placeholder="🚀 주석 가이드 생성 버튼을 누르면 여기에 결과가 표시됩니다."
            readonly
          ></textarea>
          <div style="margin-top:8px;">
            <button class="ai-btn ai-btn-guide-copy" id="btn-copy-guide">
              📋 가이드 복사
            </button>
          </div>
        </div>
      </div>

      </div> <!-- end of hud-tab-content-guidebook -->

      <!-- Tab 2: 블록 주입기 -->
      <div id="hud-tab-content-injector" class="hud-tab-content">
        <div class="hud-section" style="margin-top: 4px;">
          <h4 style="color: #4f46e5; margin-bottom: 8px;">🧩 레퍼런스 블록 템플릿</h4>
          <div class="hud-card" style="padding: 12px;">
            <div style="margin-bottom: 12px;">
              <select id="hud-injector-category" class="hud-select" style="width: 100%;">
                <option value="">카테고리 로딩 중...</option>
              </select>
            </div>
            <div id="hud-injector-list" style="max-height: 250px; overflow-y: auto; padding-right: 4px; display: flex; flex-direction: column; gap: 8px;">
              <!-- 블록 리스트 렌더링 영역 -->
            </div>
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
  
  root.querySelector('#btn-hud-close').addEventListener('click', closeHUD);

  // Tab switching logic
  const tabBtns = root.querySelectorAll('.hud-tab-btn');
  const tabContents = root.querySelectorAll('.hud-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      root.querySelector(`#hud-tab-content-${tabId}`).classList.add('active');
    });
  });


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

  // Load initial settings & bind change events
  (async function initDifficultySettings() {
    try {
      const data = await chrome.storage.sync.get(["hud_comment_level", "hud_comment_style"]);
      const selectLevel = root.querySelector("#hud-comment-level-select");
      if (selectLevel && data.hud_comment_level) {
        selectLevel.value = data.hud_comment_level;
      }
      const selectStyle = root.querySelector("#hud-comment-style-select");
      if (selectStyle && data.hud_comment_style) {
        selectStyle.value = data.hud_comment_style;
      }
    } catch (e) {
      console.warn("Scratch HUD Coach: Failed to load settings from storage", e);
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

  const styleSelect = root.querySelector("#hud-comment-style-select");
  if (styleSelect) {
    styleSelect.addEventListener("change", async (e) => {
      try {
        await chrome.storage.sync.set({ hud_comment_style: e.target.value });
      } catch (err) {
        console.error("Scratch HUD Coach: Failed to save style settings", err);
      }
    });
  }

  // Sync when storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      if (changes.hud_comment_level) {
        const selectEl = root.querySelector("#hud-comment-level-select");
        if (selectEl) {
          selectEl.value = changes.hud_comment_level.newValue;
        }
      }
      if (changes.hud_comment_style) {
        const selectEl = root.querySelector("#hud-comment-style-select");
        if (selectEl) {
          selectEl.value = changes.hud_comment_style.newValue;
        }
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
  // ─────────────────────────────────────────────

  const BASIC_LEVEL_INSTRUCTION =
`기초 단계 (직접 지시형)
- 각 번호는 1~2줄 이내로 간결하게 작성합니다.
- 블록 이름은 [ ] 안에 스크래치 화면 텍스트 그대로 씁니다.
- 블록 설명은 "[블록이름] + 짧은 동작어" 형태의 나열형으로 작성합니다. (문장형 종결어 ❌)
  예) 1. 🚩 [클릭했을 때] 가져오기   2. 📍 [x: 0 y: 0 (으)로 이동하기] 연결하기
- 반복문이나 조건문(제어 블록)의 내부에 들어가는 하위 블록들은 평면적으로 나열하지 말고, **반드시 줄바꿈 후 들여쓰기(Space 2칸)와 하위 불릿 기호(-)**를 사용하여 시각적인 계층(depth)을 나타냅니다.
  예)
  3. 🔁 [무한 반복하기] 연결하기
    - ❓ [만약 <위쪽 화살표 키를 눌렀는가?> 라면] 안쪽에 넣기
      - 🔄 [왼쪽으로 10 도 돌기] 안쪽에 넣기
- 이모지로 블록 종류를 시각적으로 구분해도 됩니다. (예: 🚩 이벤트, 📍 위치, 🔁 반복, ❓ 조건, 📢 신호)
- 위치·초기값·신호명 같은 핵심 숫자와 텍스트는 반드시 명시합니다.`;

  const BASIC_LEVEL_EXAMPLE =
`[1단계: 고양이 출발 준비]
목표: 🚩 깃발을 누르면 고양이가 정해진 자리에 서고 움직입니다.

■ 고양이
1. 🚩 [클릭했을 때] 가져오기
2. 📍 [x: (-150) y: (-100) (으)로 이동하기] 연결하기
3. 🔁 [무한 반복하기] 연결하기
  - ➡ [50 만큼 움직이기] 안쪽에 넣기
  - ❓ [만약 <벽에 닿았는가?> 라면] 아래에 붙이기
    - 📍 [벽에 닿으면 튕기기] 안쪽에 넣기`;

  const ADVANCED_LEVEL_INSTRUCTION =
`심화 단계 (간접 미션형)
- 블록 이름을 직접적으로 지시하지 않고, 목적이나 기능 중심의 **자연스러운 문장형 종결어(~해보세요, ~합니다, ~만듭니다 등)**로 작성합니다. 나열형 종결어는 사용하지 마세요.
- 반복문이나 조건문(제어 블록) 등 복잡한 논리 구조는 학생이 스스로 설계하도록 유도합니다.
- 하위 블록들은 평면적으로 나열하지 말고, **반드시 줄바꿈 후 들여쓰기(Space 2칸)와 하위 불릿 기호(-)**를 사용하여 시각적인 계층(depth)을 나타냅니다.
  예)
  3. 아래의 조건과 행동들이 게임이 끝날 때까지 멈추지 않고 계속 작동하게 해보세요.
    - 키보드의 위쪽 화살표 키를 눌렀는지 확인하는 조건을 만듭니다.
      - 조건이 맞으면 마법봉이 왼쪽으로 10도씩 돌도록 만들어 보세요.
- 이모지로 블록 기능을 시각적으로 구분해도 됩니다. (예: 🚩 이벤트, 📍 위치, 🔁 반복, ❓ 조건, 📢 신호)
- 단, 아래 항목은 심화 단계에서도 구체적인 숫자·텍스트를 반드시 명시합니다:
  · 초기 위치 (x, y 좌표) / 초기 크기·방향 / 대기 시간
  · 조작 키 이름 / 신호명 / 변수 초기화 값`;

  const ADVANCED_LEVEL_EXAMPLE =
`[3단계: 불판에 고기 올리기]
목표: 접시를 클릭하면 불판 위에 고기가 새로 생겨나도록 합니다.

■ 고기접시
1. 마우스 포인터에 닿았는지와 마우스를 클릭했는지를 계속해서 감시하도록 구조를 설계해 보세요.
2. 조건이 만족되면 다른 스프라이트들이 알 수 있도록 [고기] 신호를 보냅니다.

---

[3단계: 불판에 고기 올리기]
목표: 불판이 신호를 받아 고기 복제본을 만듭니다.

■ 불판
1. 📥 [고기] 신호를 받았을 때 동작을 시작하도록 만듭니다.
2. 🖱 마우스를 클릭하면 [고기 복제본]을 새로 만들고 실행을 멈추도록 합니다.`;

  const BASIC_LEVEL_INSTRUCTION_PSEUDO =
`기초 단계 (직접 지시형 - 유사 블록 구조)
- 각 번호는 1~2줄 이내로 간결하게 작성합니다.
- 블록 이름은 [ ] 안에 스크래치 화면 텍스트 그대로 씁니다.
- 블록 설명은 "[블록이름] + 짧은 동작어" 형태의 나열형으로 작성합니다. (문장형 종결어 ❌)
  예) 1. 🚩 [클릭했을 때] 가져오기   2. 📍 [x: 0 y: 0 (으)로 이동하기] 연결하기
- 반복문이나 조건문(제어 블록)의 내부에 들어가는 하위 블록들은 평면적으로 나열하지 말고, **반드시 줄바꿈 후 상자 그리기 문자(┌─, ├─, └─, │)를 사용하여 실제 블록 조립 형태의 시각적 계층(depth)을 표현**합니다.
  예)
  ┌─ 🔁 [무한 반복하기]
  │    │
  │    ├─ ❓ [만약 <위쪽 화살표 키를 눌렀는가?> 라면]
  │    │    │
  │    │    └─ 🔄 [왼쪽으로 10 도 돌기]
  │    └─ ...
- 이모지로 블록 종류를 시각적으로 구분해도 됩니다. (예: 🚩 이벤트, 📍 위치, 🔁 반복, ❓ 조건, 📢 신호)
- 위치·초기값·신호명 같은 핵심 숫자와 텍스트는 반드시 명시합니다.`;

  const BASIC_LEVEL_EXAMPLE_PSEUDO =
`[1단계: 고양이 출발 준비]
목표: 🚩 깃발을 누르면 고양이가 정해진 자리에 서고 움직입니다.

■ 고양이
┌─ 🚩 [클릭했을 때]
├─ 📍 [x: (-150) y: (-100) (으)로 이동하기]
└─ 🔁 [무한 반복하기]
     │
     ├─ ➡ [50 만큼 움직이기]
     └─ ❓ [만약 <벽에 닿았는가?> 라면]
          │
          └─ 📍 [벽에 닿으면 튕기기]`;

  const ADVANCED_LEVEL_INSTRUCTION_PSEUDO =
`심화 단계 (간접 미션형 - 유사 블록 구조)
- 블록 이름을 직접적으로 지시하지 않고, 목적이나 기능 중심의 **자연스러운 문장형 종결어(~해보세요, ~합니다, ~만듭니다 등)**로 작성합니다. 나열형 종결어는 사용하지 마세요.
- 반복문이나 조건문(제어 블록) 등 복잡한 논리 구조는 학생이 스스로 설계하도록 유도합니다.
- 하위 블록들은 평면적으로 나열하지 말고, **반드시 줄바꿈 후 상자 그리기 문자(┌─, ├─, └─, │)를 사용하여 실제 블록 조립 형태의 시각적 계층(depth)을 표현**합니다.
  예)
  ┌─ 🔁 아래의 조건과 행동들이 게임이 끝날 때까지 멈추지 않고 계속 작동하게 해보세요.
  │    │
  │    └─ ❓ 키보드의 위쪽 화살표 키를 눌렀는지 확인하는 조건을 만듭니다.
  │         │
  │         └─ 조건이 맞으면 마법봉이 왼쪽으로 10도씩 돌도록 만들어 보세요.
- 이모지로 블록 기능을 시각적으로 구분해도 됩니다. (예: 🚩 이벤트, 📍 위치, 🔁 반복, ❓ 조건, 📢 신호)
- 단, 아래 항목은 심화 단계에서도 구체적인 숫자·텍스트를 반드시 명시합니다:
  · 초기 위치 (x, y 좌표) / 초기 크기·방향 / 대기 시간
  · 조작 키 이름 / 신호명 / 변수 초기화 값`;

  const ADVANCED_LEVEL_EXAMPLE_PSEUDO =
`[3단계: 불판에 고기 올리기]
목표: 접시를 클릭하면 불판 위에 고기가 새로 생겨나도록 합니다.

■ 고기접시
┌─ 🔁 마우스 포인터에 닿았는지와 마우스를 클릭했는지를 계속해서 감시하도록 구조를 설계해 보세요.
│    │
│    └─ 조건이 만족되면 다른 스프라이트들이 알 수 있도록 [고기] 신호를 보냅니다.

---

[3단계: 불판에 고기 올리기]
목표: 불판이 신호를 받아 고기 복제본을 만듭니다.

■ 불판
┌─ 📥 [고기] 신호를 받았을 때 동작을 시작하도록 만듭니다.
└─ 🖱 마우스를 클릭하면 [고기 복제본]을 새로 만들고 실행을 멈추도록 합니다.`;

  const PROMPT_TEMPLATE =
`당신은 스크래치 3.0(Scratch 3.0) 전문 코칭 AI이자 교육 자료 제작자입니다.
전달받은 [정답 프로젝트 JSON]은 완성된 스크래치 과제의 논리 구조입니다.
이 정답 코드를 분석하여, 학생들이 단계별로 따라 하며 스스로 이 프로젝트를 완성할 수 있도록 돕는 "스캐폴딩 주석 가이드북"을 작성해 주세요.

### 🗣 작성 규칙

- **대상 독자:** 초등학교 저학년도 읽을 수 있도록, 짧고 쉬운 말로 씁니다.
- **간결성:** 각 번호 항목은 **1~2줄 이내**로 끝냅니다. 불필요한 수식어나 설명은 과감히 생략합니다.
- **문장 스타일 구분:** 난이도에 따라 지정된 문장 스타일을 준수합니다.
  - 기초 단계: 명시적인 [블록이름] + 짧은 동작어의 나열형 (문장형 종결어 ❌). 예: "🚩 [클릭했을 때] 가져오기"
  - 심화 단계: 간접적인 목적 중심의 문장형 종결어 (~합니다, ~해보세요). 예: "🚩 초록색 깃발을 클릭하면 작동하도록 만듭니다."
- **이모지 활용:** 이모지로 블록 종류를 시각적으로 구분해도 됩니다. (예: 🚩 이벤트, 📍 위치, 🔁 반복, ❓ 조건, 📢 신호 송신, 📥 신호 수신, 🖱 마우스 클릭)
- **금지:** 과도하게 기계적이거나 딱딱한 번역체 표현은 절대 쓰지 마세요.
  - ❌ 나쁜 예: "전체 스크립트 최종 최하단 마무리 지점에 동작 블록을 완벽 도킹하여 수평 정방향 축을 유지시킵니다."
  - ❌ 금지어: 완벽 도킹, 수평 정방향 축, 메모리 적재, 루프 내부 분기, 세션 시작 등

### 📄 전체 출력 구조 (반드시 이 순서와 규칙을 지켜주세요)

가이드북은 아래 3개 영역을 순서대로 출력합니다. Markdown 백틱 기호 없이 순수 텍스트로만 반환합니다.

#### [영역 1] 프로젝트 개요 — 맨 위에 1회만 작성

[프로젝트 개요]
이 프로젝트가 무엇을 만드는 것인지, 어떤 동작을 하는지를 초등학생이 이해할 수 있도록 2~3문장으로 설명합니다.
등장하는 스프라이트 이름, 주요 기능, 플레이 방법(게임인 경우)을 간략히 포함합니다.

---

#### [영역 2] 스프라이트별 단계 안내 — 핵심 본문

아래 규칙을 반드시 준수합니다:

규칙 A — 1섹션 = 1스프라이트: 하나의 섹션 안에 ■ 스프라이트 이름은 반드시 하나만 등장합니다. 같은 단계에 여러 스프라이트가 있더라도 절대 한 섹션에 묶지 마세요.

규칙 B — 단계 제목 반복: 동일한 단계(예: "1단계")에 여러 스프라이트가 속하면 [단계 제목]과 목표:를 각 스프라이트 섹션마다 똑같이 반복 작성합니다.

규칙 C — 섹션 구분: 각 섹션은 --- 구분선으로 분리합니다.

규칙 D — 단계 묶음 기준: 논리적으로 같은 시점에 이루어지는 여러 스프라이트의 스크립트는 같은 단계 번호를 공유합니다. 단계 번호는 스프라이트 수가 아닌 "구현 시점의 논리 단위"로 결정합니다.

출력 포맷 (섹션 반복 단위):

[N단계: 단계 제목]
목표: 이 단계에서 이 스프라이트가 완성할 동작을 한 줄로 요약합니다.

■ 스프라이트 이름
1. 구현 가이드 (난이도별 차등 적용, 나열형으로 작성)
2. 구현 가이드

---

#### [영역 3] 응용 미션 — 맨 아래에 1회만 작성

[🏆 응용 미션 / 도전 과제]
완성된 프로젝트를 더 발전시킬 수 있는 도전 과제를 2~3가지 제시합니다.
항목은 반드시 학생 스스로 생각하도록 유도하는 의문문(~할 수 있을까요? / ~하려면 어떻게 해야 할까요?) 형태로 작성합니다.
1. 미션 내용 (의문문)
2. 미션 내용 (의문문)

---

### 🛠 난이도별 블록 설명 작성 규칙: [주석 난이도 레벨: {USER_SELECTED_LEVEL}]

{LEVEL_SPECIFIC_INSTRUCTION}

---

### 💡 실제 적용 예시 (고기굽기 프로젝트 기준 전체 출력 구조)

[프로젝트 개요]
이 프로젝트는 접시를 클릭해서 불판에 고기를 올리고, 고기가 다 구워지면 점수를 얻는 요리 게임입니다. 고기접시, 불판, 고기 스프라이트가 서로 신호를 주고받으며 함께 작동합니다. 초록 깃발을 눌러 시작해 보세요!

---

{LEVEL_EXAMPLE}

---

[🏆 응용 미션 / 도전 과제]
1. 고기를 3번 이상 올렸을 때 "오늘의 요리사!"라고 말하게 만들 수 있을까요?
2. 고기가 너무 오래 불판에 있으면 탄 모양으로 바뀌도록 하려면 어떻게 코드를 짜야 할까요?

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

    const selectStyleEl = root.querySelector("#hud-comment-style-select");
    const style = selectStyleEl ? selectStyleEl.value : "text";

    let levelStr = "";
    let levelInst = "";
    let levelExample = "";

    if (style === "pseudoblock") {
      levelStr = level === "basic" ? "기초 단계 (직접 지시형 - 유사 블록 구조)" : "심화 단계 (간접 미션형 - 유사 블록 구조)";
      levelInst = level === "basic" ? BASIC_LEVEL_INSTRUCTION_PSEUDO : ADVANCED_LEVEL_INSTRUCTION_PSEUDO;
      levelExample = level === "basic" ? BASIC_LEVEL_EXAMPLE_PSEUDO : ADVANCED_LEVEL_EXAMPLE_PSEUDO;
    } else {
      levelStr = level === "basic" ? "기초 단계 (직접 지시형)" : "심화 단계 (간접 미션형)";
      levelInst = level === "basic" ? BASIC_LEVEL_INSTRUCTION : ADVANCED_LEVEL_INSTRUCTION;
      levelExample = level === "basic" ? BASIC_LEVEL_EXAMPLE : ADVANCED_LEVEL_EXAMPLE;
    }

    const promptStr = PROMPT_TEMPLATE
      .replace('{USER_SELECTED_LEVEL}', levelStr)
      .replace('{LEVEL_SPECIFIC_INSTRUCTION}', levelInst)
      .replace('{LEVEL_EXAMPLE}', levelExample)
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
    'event_whenflagclicked':     '🚩 [클릭했을 때] 가져오기',
    'event_whenkeypressed':      '🚩 [{KEY} 키를 눌렀을 때] 가져오기',
    'event_whenthisspriteclicked': '🚩 [이 스프라이트를 클릭했을 때] 가져오기',
    'event_whenbroadcastreceived': '📥 [{BROADCAST_OPTION} 신호를 받았을 때] 가져오기',
    'event_broadcast':           '📢 [{BROADCAST_INPUT} 신호 보내기] 연결하기',
    'event_broadcastandwait':    '📢 [{BROADCAST_INPUT} 신호 보내고 기다리기] 연결하기',
    // 동작
    'motion_movesteps':          '➡ [{STEPS} 만큼 움직이기] 연결하기',
    'motion_turnright':          '↩ [{DEGREES} 도 돌기(오른쪽)] 연결하기',
    'motion_turnleft':           '↪ [{DEGREES} 도 돌기(왼쪽)] 연결하기',
    'motion_gotoxy':             '📍 [x: {X} y: {Y} (으)로 이동하기] 연결하기',
    'motion_glidesecstoxy':      '📍 [{SECS}초 동안 x: {X} y: {Y} (으)로 이동하기] 연결하기',
    'motion_pointindirection':   '📍 [{DIRECTION} 도 방향 보기] 연결하기',
    'motion_pointtowards':       '📍 [{TOWARDS} 쪽 보기] 연결하기',
    'motion_goto':               '📍 [{TO} (으)로 이동하기] 연결하기',
    'motion_ifonedgebounce':     '📍 [벽에 닿으면 튕기기] 연결하기',
    'motion_setx':               '📍 [x 좌표를 {X} (으)로 정하기] 연결하기',
    'motion_sety':               '📍 [y 좌표를 {Y} (으)로 정하기] 연결하기',
    'motion_changexby':          '📍 [x 좌표를 {DX} 만큼 바꾸기] 연결하기',
    'motion_changeyby':          '📍 [y 좌표를 {DY} 만큼 바꾸기] 연결하기',
    // 형태
    'looks_show':                '👁 [보이기] 연결하기',
    'looks_hide':                '👁 [숨기기] 연결하기',
    'looks_sayforsecs':          '💬 [{MESSAGE} 라고 {SECS}초 동안 말하기] 연결하기',
    'looks_say':                 '💬 [{MESSAGE} 라고 말하기] 연결하기',
    'looks_thinkforsecs':        '💬 [{MESSAGE} 라고 {SECS}초 동안 생각하기] 연결하기',
    'looks_switchcostumeto':     '🎨 [{COSTUME} 모양으로 바꾸기] 연결하기',
    'looks_nextcostume':         '🎨 [다음 모양으로 바꾸기] 연결하기',
    'looks_setsizeto':           '🔎 [크기를 {SIZE} 로 정하기] 연결하기',
    'looks_changesizeby':        '🔎 [크기를 {CHANGE} 만큼 바꾸기] 연결하기',
    'looks_createclone':         '📋 [{CLONE_OPTION} 의 복제본 만들기] 연결하기',
    'looks_deletethisclone':     '📋 [이 복제본 삭제하기] 연결하기',
    // 소리
    'sound_play':                '🔊 [{SOUND_MENU} 소리 재생하기] 연결하기',
    'sound_playuntildone':       '🔊 [{SOUND_MENU} 소리 재생이 끝날 때까지 기다리기] 연결하기',
    'sound_stopallsounds':       '🔇 [모든 소리 끄기] 연결하기',
    // 제어
    'control_wait':              '⏱ [{DURATION}초 기다리기] 연결하기',
    'control_repeat':            '🔁 [{TIMES}번 반복하기] 연결하고 안쪽 채우기',
    'control_forever':           '🔁 [계속 반복하기] 연결하고 안쪽 채우기',
    'control_if':                '❓ [만약 (조건) 이라면] 연결하고 안쪽 채우기',
    'control_if_else':           '❓ [만약 (조건) 이라면 / 아니면] 연결하고 안쪽 채우기',
    'control_repeat_until':      '🔁 [(조건) 이 될 때까지 반복하기] 연결하기',
    'control_stop':              '⛔ [{STOP_OPTION} 멈추기] 연결하기',
    'control_start_as_clone':    '📋 [복제되었을 때] 가져오기',
    // 감지
    'sensing_touchingobject':    '👆 [(물체)에 닿았는가?] 조건 칸에 넣기',
    'sensing_touchingcolor':     '👆 [(색)에 닿았는가?] 조건 칸에 넣기',
    'sensing_keypressed':        '⌨ [{KEY_OPTION} 키를 눌렀는가?] 조건 칸에 넣기',
    'sensing_mousedown':         '🖱 [마우스를 클릭했는가?] 조건 칸에 넣기',
    'sensing_distanceto':        '📏 [{DISTANCETOMENU} 까지의 거리] 값 칸에 넣기',
    'sensing_askandwait':        '❓ [{QUESTION} 라고 묻고 기다리기] 연결하기',
    // 연산
    'operator_add':              '➕ [{NUM1} + {NUM2}] 값 칸에 넣기',
    'operator_subtract':         '➖ [{NUM1} - {NUM2}] 값 칸에 넣기',
    'operator_multiply':         '✖ [{NUM1} * {NUM2}] 값 칸에 넣기',
    'operator_divide':           '➗ [{NUM1} / {NUM2}] 값 칸에 넣기',
    'operator_equals':           '🟰 [{OPERAND1} = {OPERAND2}] 조건 칸에 넣기',
    'operator_gt':               '🔼 [{OPERAND1} > {OPERAND2}] 조건 칸에 넣기',
    'operator_lt':               '🔽 [{OPERAND1} < {OPERAND2}] 조건 칸에 넣기',
    'operator_and':              '🔗 [{OPERAND1} 그리고 {OPERAND2}] 조건 칸에 넣기',
    'operator_or':               '🔗 [{OPERAND1} 또는 {OPERAND2}] 조건 칸에 넣기',
    'operator_not':              '🚫 [{OPERAND} 이(가) 아님] 조건 칸에 넣기',
    'operator_random':           '🎲 [{FROM} 부터 {TO} 사이의 난수] 값 칸에 넣기',
    // 변수·리스트
    'data_setvariableto':        '📦 [{VARIABLE} 을(를) {VALUE} 로 정하기] 연결하기',
    'data_changevariableby':     '📦 [{VARIABLE} 을(를) {VALUE} 만큼 바꾸기] 연결하기',
    'data_addtolist':            '📋 [{ITEM} 을(를) {LIST} 에 추가하기] 연결하기',
    'data_deleteoflist':         '📋 [{LIST} 의 {INDEX} 번째 항목 삭제하기] 연결하기',
    'data_deletealloflist':      '📋 [{LIST} 의 모든 항목 삭제하기] 연결하기',
  };

  const OPCODE_LABEL_ADVANCED = {
    // 이벤트
    'event_whenflagclicked':     '🚩 초록색 깃발을 클릭했을 때 작동을 시작하도록 만듭니다.',
    'event_whenkeypressed':      '🚩 [{KEY}] 키를 눌렀을 때 작동을 시작하도록 합니다.',
    'event_whenthisspriteclicked': '🚩 이 스프라이트를 클릭했을 때 동작이 시작되게 만듭니다.',
    'event_whenbroadcastreceived': '📥 [{BROADCAST_OPTION}] 신호를 받았을 때 작동하도록 시작점을 만듭니다.',
    'event_broadcast':           '📢 다른 모든 스프라이트에게 [{BROADCAST_INPUT}] 신호를 보내도록 만듭니다.',
    'event_broadcastandwait':    '📢 [{BROADCAST_INPUT}] 신호를 보내고 그 일이 끝날 때까지 기다리도록 설계합니다.',
    // 동작
    'motion_movesteps':          '➡ 앞으로 [{STEPS}] 만큼 움직이게 해보세요.',
    'motion_turnright':          '↩ 오른쪽으로 [{DEGREES}] 도 돌게 만들어 보세요.',
    'motion_turnleft':           '↪ 왼쪽으로 [{DEGREES}] 도 돌게 만들어 보세요.',
    'motion_gotoxy':             '📍 처음 위치를 x: {X}, y: {Y} (으)로 지정해 줍니다.',
    'motion_glidesecstoxy':      '📍 {SECS}초 동안 x: {X}, y: {Y} 위치로 부드럽게 미끄러지며 이동하도록 합니다.',
    'motion_pointindirection':   '📍 {DIRECTION}도 방향을 바라보게 설정해 보세요.',
    'motion_pointtowards':       '📍 지정된 대상을 향해 바라보게 만듭니다.',
    'motion_goto':               '📍 대상의 위치로 바로 이동하게 해보세요.',
    'motion_ifonedgebounce':     '📍 화면의 끝부분(벽)에 닿으면 튕겨 나오도록 만듭니다.',
    'motion_setx':               '📍 가로(x) 위치를 {X} (으)로 고정합니다.',
    'motion_sety':               '📍 세로(y) 위치를 {Y} (으)로 고정합니다.',
    'motion_changexby':          '📍 가로(x) 위치를 일정량만큼 바꿔줍니다.',
    'motion_changeyby':          '📍 세로(y) 위치를 일정량만큼 바꿔줍니다.',
    // 형태
    'looks_show':                '👁 화면에 다시 나타나도록 만듭니다.',
    'looks_hide':                '👁 화면에서 보이지 않도록 숨겨줍니다.',
    'looks_sayforsecs':          '💬 정해진 시간 동안 말풍선을 띄우게 해보세요.',
    'looks_say':                 '💬 계속해서 말풍선을 띄워줍니다.',
    'looks_thinkforsecs':        '💬 속으로 생각하는 말풍선을 보여주도록 만듭니다.',
    'looks_switchcostumeto':     '🎨 모양을 다른 것으로 바꾸어 줍니다.',
    'looks_nextcostume':         '🎨 다음 모양으로 넘어가게 해보세요.',
    'looks_setsizeto':           '🔎 크기를 {SIZE}% 로 설정합니다.',
    'looks_changesizeby':        '🔎 크기를 점점 키우거나 줄이게 만듭니다.',
    'looks_createclone':         '📋 자기 자신이나 다른 대상의 복제본을 생성해 보세요.',
    'looks_deletethisclone':     '📋 사용이 끝난 복제본을 삭제하도록 설계합니다.',
    // 소리
    'sound_play':                '🔊 소리를 재생하도록 만듭니다.',
    'sound_playuntildone':       '🔊 소리가 끝날 때까지 기다리도록 설정합니다.',
    'sound_stopallsounds':       '🔇 나고 있는 모든 소리를 끄게 해보세요.',
    // 제어
    'control_wait':              '⏱ {DURATION}초 동안 잠시 기다리게 만듭니다.',
    'control_repeat':            '🔁 정해진 횟수만큼 안쪽의 동작들을 반복하도록 설계해 보세요.',
    'control_forever':           '🔁 멈추지 않고 안쪽의 동작들을 계속해서 반복하도록 구조를 짭니다.',
    'control_if':                '❓ 특정한 조건이 만족되었을 때만 안쪽의 동작이 실행되도록 조건을 만들어 보세요.',
    'control_if_else':           '❓ 조건이 만족될 때와 아닐 때, 두 가지 길로 나누어 실행되도록 설계합니다.',
    'control_repeat_until':      '🔁 특정한 조건이 이루어질 때까지 반복해서 동작하도록 만듭니다.',
    'control_stop':              '⛔ 실행되고 있는 동작이나 스크립트를 멈추게 합니다.',
    'control_start_as_clone':    '📋 복제본으로 처음 만들어졌을 때 해야 할 행동을 설계합니다.',
    // 감지
    'sensing_touchingobject':    '👆 특정 물체에 닿았는지 감지하는 조건을 활용해 보세요.',
    'sensing_touchingcolor':     '👆 특정 색상에 닿았는지 감지하는 조건을 활용해 보세요.',
    'sensing_keypressed':        '⌨ 키보드의 키가 눌렸는지 감지하는 조건을 넣습니다.',
    'sensing_mousedown':         '🖱 마우스가 클릭되었는지 확인하는 조건을 사용해 보세요.',
    'sensing_distanceto':        '📏 대상까지의 거리가 얼마나 되는지 측정하여 활용합니다.',
    'sensing_askandwait':        '❓ 질문을 화면에 띄우고 사용자의 대답을 기다리게 만듭니다.',
    // 연산
    'operator_add':              '➕ 두 숫자를 더한 값을 활용하도록 식을 만듭니다.',
    'operator_subtract':         '➖ 두 숫자를 뺀 값을 활용하도록 식을 만듭니다.',
    'operator_multiply':         '✖ 두 숫자를 곱한 값을 활용하도록 식을 만듭니다.',
    'operator_divide':           '➗ 두 숫자를 나눈 값을 활용하도록 식을 만듭니다.',
    'operator_equals':           '🟰 두 값이 똑같은지 비교하는 조건을 만들어 줍니다.',
    'operator_gt':               '🔼 앞의 값이 뒤의 값보다 큰지 비교하는 조건을 넣습니다.',
    'operator_lt':               '🔽 앞의 값이 뒤의 값보다 작은지 비교하는 조건을 넣습니다.',
    'operator_and':              '🔗 두 가지 조건이 모두 맞아야 하는 복합 조건을 설계해 보세요.',
    'operator_or':               '🔗 두 가지 조건 중 하나라도 맞으면 되는 조건을 설계해 보세요.',
    'operator_not':              '🚫 그 조건이 아닐 때 실행되도록 반대 조건을 설정합니다.',
    'operator_random':           '🎲 무작위로 숫자를 뽑아서 사용하도록 만들어 봅니다.',
    // 변수·리스트
    'data_setvariableto':        '📦 {VARIABLE} 변수의 값을 {VALUE} (으)로 정해줍니다.',
    'data_changevariableby':     '📦 {VARIABLE} 변수의 값을 {VALUE} 만큼 늘리거나 줄이게 만듭니다.',
    'data_addtolist':            '📋 리스트에 새로운 항목을 추가하도록 합니다.',
    'data_deleteoflist':         '📋 리스트에서 불필요해진 항목을 삭제하도록 합니다.',
    'data_deletealloflist':      '📋 리스트의 모든 항목을 싹 비우도록 만듭니다.',
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

          // 재귀적으로 블록 시퀀스와 중첩 블록(SUBSTACK 등)을 파싱하는 함수 (텍스트 스타일용)
          function renderBlockSequenceText(seq, depth) {
            if (!Array.isArray(seq)) return;
            let indentStr = '';
            for(let i=0; i<depth; i++) indentStr += '  ';
            
            for (const block of seq) {
              if (!block || !block.opcode) continue;
              const tmpl = labelMap[block.opcode];
              if (tmpl) {
                const filled = fillOpcodeTemplate(tmpl, block);
                let lineStr = '';
                if (depth === 0) {
                  lineStr = stepIndex + '. ' + filled;
                  stepIndex++;
                } else {
                  lineStr = indentStr + '- ' + filled;
                }
                lines.push(lineStr);
              }
              
              // 중첩된 SUBSTACK이나 CONDITION 파싱
              if (block.inputs) {
                if (block.inputs.CONDITION) {
                  renderBlockSequenceText(block.inputs.CONDITION, depth + 1);
                }
                if (block.inputs.SUBSTACK) {
                  renderBlockSequenceText(block.inputs.SUBSTACK, depth + 1);
                }
                if (block.inputs.SUBSTACK2) {
                  renderBlockSequenceText(block.inputs.SUBSTACK2, depth + 1);
                }
              }
            }
          }

          let itemIndex = 1;
          function renderRootSequenceText(seq) {
            for (const block of seq) {
              if (!block || !block.opcode) continue;
              const tmpl = labelMap[block.opcode];
              if (tmpl) {
                const filled = fillOpcodeTemplate(tmpl, block);
                lines.push(itemIndex + '. ' + filled);
                itemIndex++;
              }
              if (block.inputs) {
                if (block.inputs.CONDITION) renderBlockSequenceText(block.inputs.CONDITION, 1);
                if (block.inputs.SUBSTACK) renderBlockSequenceText(block.inputs.SUBSTACK, 1);
                if (block.inputs.SUBSTACK2) renderBlockSequenceText(block.inputs.SUBSTACK2, 1);
              }
            }
          }

          // 유사 블록 형태 렌더링 함수
          function renderBlockSequencePseudo(seq, depth, parentHasNextList) {
            if (!Array.isArray(seq)) return;
            
            const validItems = seq.filter(item => item && item.block && item.block.opcode && labelMap[item.block.opcode]);
            
            for (let i = 0; i < validItems.length; i++) {
              const item = validItems[i];
              const block = item.block;
              const typeLabel = item.typeLabel || '';
              const tmpl = labelMap[block.opcode];
              const filled = fillOpcodeTemplate(tmpl, block);
              
              const isLast = (i === validItems.length - 1);
              
              // Build indentation prefix
              let indent = '';
              for (let d = 0; d < depth; d++) {
                indent += parentHasNextList[d] ? '│    ' : '     ';
              }
              indent += isLast ? '└─ ' : '├─ ';
              
              if (depth === 0) {
                const rootPrefix = (validItems.length === 1) ? '└─ ' : (i === 0 ? '┌─ ' : (isLast ? '└─ ' : '├─ '));
                lines.push(rootPrefix + typeLabel + filled);
              } else {
                lines.push(indent + typeLabel + filled);
              }
              
              // Collect all children for this block
              const children = [];
              if (block.inputs) {
                const cond = block.inputs.CONDITION;
                if (Array.isArray(cond)) {
                  cond.filter(b => b && b.opcode && labelMap[b.opcode]).forEach(b => {
                    children.push({ block: b, typeLabel: '[조건] ' });
                  });
                }
                
                const sub = block.inputs.SUBSTACK;
                const sub2 = block.inputs.SUBSTACK2;
                const hasSub2 = Array.isArray(sub2) && sub2.some(b => b && b.opcode && labelMap[b.opcode]);
                
                if (Array.isArray(sub)) {
                  sub.filter(b => b && b.opcode && labelMap[b.opcode]).forEach(b => {
                    const label = hasSub2 ? '[참일 때] ' : '[실행] ';
                    children.push({ block: b, typeLabel: label });
                  });
                }
                
                if (Array.isArray(sub2)) {
                  sub2.filter(b => b && b.opcode && labelMap[b.opcode]).forEach(b => {
                    children.push({ block: b, typeLabel: '[아니면] ' });
                  });
                }
              }
              
              if (children.length > 0) {
                let nextLineIndent = '';
                for (let d = 0; d < depth; d++) {
                  nextLineIndent += parentHasNextList[d] ? '│    ' : '     ';
                }
                if (depth === 0) {
                  nextLineIndent += (validItems.length > 1 && !isLast) ? '│    ' : '     ';
                } else {
                  nextLineIndent += isLast ? '     ' : '│    ';
                }
                
                lines.push(nextLineIndent + '│');
                
                const nextHasNextList = [...parentHasNextList];
                if (depth === 0) {
                  nextHasNextList.push(validItems.length > 1 && !isLast);
                } else {
                  nextHasNextList.push(!isLast);
                }
                
                renderBlockSequencePseudo(children, depth + 1, nextHasNextList);
              }
            }
          }

          const selectStyleEl = root.querySelector("#hud-comment-style-select");
          const style = selectStyleEl ? selectStyleEl.value : "text";

          if (style === "pseudoblock") {
            renderBlockSequencePseudo(script.map(b => ({ block: b, typeLabel: '' })), 0, []);
          } else {
            renderRootSequenceText(script);
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
