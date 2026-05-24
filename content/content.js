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
  root.innerHTML = window.HUD_HTML_TEMPLATE || '';
  document.body.appendChild(root);

  // 2.5) Resizing logic (Spatial Design Guideline)
  const resizeHandle = document.createElement("div");
  resizeHandle.id = "hud-resize-handle";
  root.appendChild(resizeHandle);

  let isResizing = false;
  let startWidth = 360;

  // Load saved width from Chrome storage
  chrome.storage.sync.get(['hud_panel_width'], (data) => {
    if (data.hud_panel_width) {
      const savedWidth = Math.max(280, Math.min(800, data.hud_panel_width));
      root.style.width = `${savedWidth}px`;
    }
  });

  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    startWidth = root.offsetWidth;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    // Temporarily disable panel opening/closing transitions during drag
    root.style.transition = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const rightMargin = 16;
    const newWidth = window.innerWidth - e.clientX - rightMargin;
    
    // Constraints: minimum 280px, maximum 800px or 70% of viewport width
    const minWidth = 280;
    const maxWidth = Math.min(800, window.innerWidth * 0.7);
    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    root.style.width = `${clampedWidth}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Re-enable transition by removing inline override
      root.style.transition = "";
      
      const finalWidth = root.offsetWidth;
      chrome.storage.sync.set({ hud_panel_width: finalWidth });
    }
  });


  // Toggle logic
  const openHUD = () => {
    root.classList.add("open");
    toggleBtn.textContent = "HUD 닫기";
  };
  const closeHUD = () => {
    root.classList.remove("open");
    toggleBtn.textContent = "HUD 열기";
  };
  if (window.HUDUiUtils && window.HUDUiUtils.initDraggableFAB) {
    window.HUDUiUtils.initDraggableFAB(toggleBtn, () => {
      root.classList.contains("open") ? closeHUD() : openHUD();
    });
  } else {
    toggleBtn.addEventListener("click", () =>
      root.classList.contains("open") ? closeHUD() : openHUD()
    );
  }
  
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

  const AI_PROMPT_BASE = `[시스템 지침]
당신은 스크래치 3.0 코딩 AI 어시스턴트입니다.
사용자가 제공하는 스프라이트 시나리오에 맞게 다음 JSON 스키마를 준수하여 코드 블록을 생성하세요.

[JSON 스키마 구조 및 대표 블록 가이드]
최상위 객체의 키는 스프라이트 이름이며, 값은 스크립트 시퀀스의 2차원 배열입니다.
{
  "스프라이트이름1": [
    [
      { "opcode": "event_whenflagclicked" },
      { "opcode": "motion_movesteps", "inputs": { "STEPS": 10 } }
    ]
  ]
}

- 시작 이벤트(깃발): { "opcode": "event_whenflagclicked" }
- 키 클릭 이벤트: { "opcode": "event_whenkeypressed", "fields": { "KEY_OPTION": "space" } }
- 신호 받았을 때: { "opcode": "event_whenbroadcastreceived", "fields": { "BROADCAST_OPTION": "신호명" } }
- 신호 보내기: { "opcode": "event_broadcast", "inputs": { "BROADCAST_INPUT": { "opcode": "event_broadcast_menu", "fields": { "BROADCAST_OPTION": "신호명" } } } }
- ~초 기다리기: { "opcode": "control_wait", "inputs": { "DURATION": 1 } }
- 10번 반복하기: { "opcode": "control_repeat", "inputs": { "TIMES": 10, "SUBSTACK": [ ... ] } }
- 무한 반복하기: { "opcode": "control_forever", "inputs": { "SUBSTACK": [ ... ] } }
- 만약 ~라면: { "opcode": "control_if", "inputs": { "CONDITION": [ ... ], "SUBSTACK": [ ... ] } }
- 만약 ~라면, 아니면: { "opcode": "control_if_else", "inputs": { "CONDITION": [ ... ], "SUBSTACK": [ ... ], "SUBSTACK2": [ ... ] } }
- 변수 정하기: { "opcode": "data_setvariableto", "fields": { "VARIABLE": "변수명" }, "inputs": { "VALUE": 0 } }
- 변수 바꾸기: { "opcode": "data_changevariableby", "fields": { "VARIABLE": "변수명" }, "inputs": { "VALUE": 1 } }
- 닿았는가 감지: { "opcode": "sensing_touchingobject", "inputs": { "TOUCHINGOBJECTMENU": { "opcode": "sensing_touchingobjectmenu", "fields": { "TOUCHINGOBJECTMENU": "_mouse_" } } } }
- x, y 좌표 이동: { "opcode": "motion_gotoxy", "inputs": { "X": 0, "Y": 0 } }
- 10만큼 움직이기: { "opcode": "motion_movesteps", "inputs": { "STEPS": 10 } }
- 모양 바꾸기: { "opcode": "looks_switchcostumeto", "inputs": { "COSTUME": { "opcode": "looks_costume", "fields": { "COSTUME": "모양명" } } } }
- ~의 ~좌표/값 감지: { "opcode": "sensing_of", "fields": { "PROPERTY": "x position" }, "inputs": { "OBJECT": { "opcode": "sensing_of_object_menu", "fields": { "OBJECT": "스프라이트명" } } } }

주의:
1. Scratch 3.0 공식 opcode만 사용하세요.
2. UUID는 부여하지 마세요.
3. inputs 필드에는 수식 블록 객체 혹은 단순 원시값(숫자/문자열)을 입력해야 합니다. 대괄호 형식의 내부 VM용 원시값 배열(예: [4, 10, "1"])은 절대 사용하지 마세요.
4. 순수한 JSON 텍스트만 출력하세요.`;

  const btnToggleAiGuide = root.querySelector('#btn-toggle-hud-ai-guide');
  const aiGuideContent = root.querySelector('#hud-ai-guide-content');
  const aiGuideArrow = root.querySelector('#hud-ai-guide-arrow');
  const aiPromptPreview = root.querySelector('#hud-ai-prompt-preview');
  
  btnToggleAiGuide.addEventListener('click', () => {
    const isHidden = aiGuideContent.style.display === "none";
    aiGuideContent.style.display = isHidden ? "block" : "none";
    aiGuideArrow.textContent = isHidden ? "▲" : "▼";
  });

  root.querySelector('#btn-hud-copy-ai-prompt').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(aiPromptPreview.value);
      showAiStatus('✅ AI 프롬프트 가이드가 클립보드에 복사되었습니다!', 'success');
    } catch(e) {
      showAiStatus('❌ 복사에 실패했습니다.', 'error');
    }
  });

  aiPromptPreview.value = AI_PROMPT_BASE;

  // ── 체크박스: 프로젝트 내 주석 포함 옵션 ──────────────────────────
  const cbIncludeComments = root.querySelector('#hud-cb-include-comments');
  let hudIncludeComments = true; // default

  // Load saved preference from storage
  chrome.storage.sync.get(['hud_include_comments'], (data) => {
    if (typeof data.hud_include_comments === 'boolean') {
      hudIncludeComments = data.hud_include_comments;
    }
    if (cbIncludeComments) cbIncludeComments.checked = hudIncludeComments;
  });

  if (cbIncludeComments) {
    cbIncludeComments.addEventListener('change', (e) => {
      hudIncludeComments = e.target.checked;
      chrome.storage.sync.set({ hud_include_comments: hudIncludeComments });
      // Regenerate prompt immediately
      rebuildAiPrompt();
      updateGuideUI();
    });
  }

  // Sync if storage changes from popup
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && typeof changes.hud_include_comments !== 'undefined') {
      hudIncludeComments = changes.hud_include_comments.newValue;
      if (cbIncludeComments) cbIncludeComments.checked = hudIncludeComments;
      rebuildAiPrompt();
      updateGuideUI();
    }
  });

  const btnCleanGhost = root.querySelector('#hud-btn-clean-ghost');
  if (btnCleanGhost) {
    btnCleanGhost.addEventListener('click', () => {
      window.postMessage({ source: "scratch-hud-content", type: "CLEANUP_ORPHANED_COMMENTS" }, "*");
    });
  }

  // ── 탭 2 이벤트 연동 ──────────────────────────────────────────────
  const btnInstantInject = root.querySelector('#btn-hud-instant-inject');
  if (btnInstantInject) {
    btnInstantInject.addEventListener('click', () => {
      const jsonStr = root.querySelector('#hud-custom-json-input').value;
      if (!jsonStr.trim()) {
        showAiStatus('JSON 코드를 입력해주세요.', 'warning');
        return;
      }
      try {
        const parsedJson = JSON.parse(jsonStr);
        let deparsedJson = {};
        if (window.ScratchParser) {
          for (const [targetName, sequences] of Object.entries(parsedJson)) {
            if (!Array.isArray(sequences) || sequences.length === 0) continue;
            let maxY = 80;
            if (lastSnapshot && lastSnapshot.rawBlocksByTarget && lastSnapshot.rawBlocksByTarget[targetName]) {
              const blocks = lastSnapshot.rawBlocksByTarget[targetName];
              let maxFoundY = null;
              Object.values(blocks).forEach(b => {
                if (b.topLevel && b.y !== undefined) {
                  if (maxFoundY === null || b.y > maxFoundY) maxFoundY = b.y;
                }
              });
              if (maxFoundY !== null) maxY = maxFoundY + 100;
            }
            deparsedJson[targetName] = window.ScratchParser.deparse(sequences, { x: 80, y: maxY });
          }
          window.postMessage({
            source: "scratch-hud-content",
            type: "APPLY_CUSTOM_BULK_UPDATE",
            payload: { deparsedJson: deparsedJson }
          }, "*");
          root.querySelector('#hud-custom-json-input').value = '';
        } else {
          showAiStatus('❌ ScratchParser를 불러올 수 없습니다.', 'error');
        }
      } catch (e) {
        showAiStatus('❌ JSON 파싱 오류: ' + e.message, 'error');
      }
    });
  }

  const cbClearBlocks = root.querySelector('#hud-clear-blocks-cb');
  const cbClearComments = root.querySelector('#hud-clear-comments-cb');
  const btnClearWorkspace = root.querySelector('#btn-hud-clear-workspace');
  const clearWarningDesc = root.querySelector('#hud-clear-warning-desc');

  function updateClearButtonState() {
    if (!cbClearBlocks || !cbClearComments || !btnClearWorkspace) return;
    const clearBlocks = cbClearBlocks.checked;
    const clearComments = cbClearComments.checked;

    if (!clearBlocks && !clearComments) {
      btnClearWorkspace.disabled = true;
      btnClearWorkspace.style.opacity = '0.5';
      btnClearWorkspace.style.cursor = 'not-allowed';
      if (clearWarningDesc) {
        clearWarningDesc.textContent = '지울 항목을 선택해 주세요.';
        clearWarningDesc.style.color = '#64748b';
      }
    } else {
      btnClearWorkspace.disabled = false;
      btnClearWorkspace.style.opacity = '1';
      btnClearWorkspace.style.cursor = 'pointer';
      if (clearWarningDesc) {
        clearWarningDesc.style.color = '#be123c';
        if (clearBlocks && clearComments) {
          clearWarningDesc.textContent = '선택한 요소가 모든 스프라이트에서 영구 삭제됩니다.';
        } else if (clearBlocks) {
          clearWarningDesc.textContent = '모든 블록이 영구 삭제되며, 주석은 보존됩니다.';
        } else if (clearComments) {
          clearWarningDesc.textContent = '모든 주석이 영구 삭제되며, 블록 코드는 보존됩니다.';
        }
      }
    }
  }

  if (cbClearBlocks) cbClearBlocks.addEventListener('change', updateClearButtonState);
  if (cbClearComments) cbClearComments.addEventListener('change', updateClearButtonState);

  if (btnClearWorkspace) {
    btnClearWorkspace.addEventListener('click', () => {
      const clearBlocks = cbClearBlocks ? cbClearBlocks.checked : false;
      const clearComments = cbClearComments ? cbClearComments.checked : false;
      if (!clearBlocks && !clearComments) return;

      let confirmMsg = '';
      if (clearBlocks && clearComments) {
        confirmMsg = "⚠️ 모든 스프라이트의 블록 코드와 주석을 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.";
      } else if (clearBlocks) {
        confirmMsg = "⚠️ 모든 스프라이트의 블록 코드를 삭제하시겠습니까?\n(주석은 독립 주석으로 변환되어 안전하게 보존됩니다.)";
      } else if (clearComments) {
        confirmMsg = "⚠️ 모든 스프라이트의 주석을 완전히 삭제하시겠습니까?\n(블록 코드는 안전하게 보존됩니다.)";
      }

      if (confirm(confirmMsg)) {
        window.postMessage({
          source: "scratch-hud-content",
          type: "CLEAR_WORKSPACE_PARTIAL",
          payload: { clearBlocks, clearComments }
        }, "*");
      }
    });
  }

  // ── 가이드북 탭 추가 바인딩 ──────────────────────────────────────
  const btnGuideInject = root.querySelector('#btn-hud-guide-inject');
  if (btnGuideInject) {
    btnGuideInject.addEventListener('click', () => {
      const jsonStr = root.querySelector('#hud-guide-json-input').value;
      if (!jsonStr.trim()) {
        showAiStatus('주석 JSON 코드를 입력해주세요.', 'warning');
        return;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const overview = parsed.개요;
        const mission = parsed.미션;
        const commentsJson = parsed.가이드 || parsed;
        
        window.postMessage({
          source: "scratch-hud-content",
          type: "APPLY_COMMENTS_ONLY",
          payload: { commentsJson, overview, mission }
        }, "*");
      } catch (e) {
        showAiStatus('❌ JSON 파싱 오류: ' + e.message, 'error');
      }
    });
  }

  const btnGuideTextCopy = root.querySelector('#btn-hud-guide-text-copy');
  if (btnGuideTextCopy) {
    btnGuideTextCopy.addEventListener('click', async () => {
      const jsonStr = root.querySelector('#hud-guide-json-input').value;
      if (!jsonStr.trim()) {
        showAiStatus('변환할 주석 JSON 코드가 없습니다.', 'warning');
        return;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        let formattedText = '';
        
        if (parsed.개요) {
          formattedText += `[프로젝트 개요]\n${parsed.개요}\n\n`;
        }
        
        const guides = parsed.가이드 || parsed;
        if (typeof guides === 'object') {
          formattedText += `[구현 가이드]\n`;
          for (const [spriteName, guideText] of Object.entries(guides)) {
            if (typeof guideText === 'string') {
              formattedText += `■ ${spriteName}\n${guideText}\n\n`;
            }
          }
        }
        
        if (parsed.미션) {
          formattedText += `[도전 미션]\n${parsed.미션}\n`;
        }

        if (!formattedText.trim()) {
          formattedText = jsonStr; // fallback to raw string if nothing matched
        }

        await navigator.clipboard.writeText(formattedText);
        showAiStatus('✅ 텍스트 가이드가 클립보드에 복사되었습니다!', 'success');
      } catch (e) {
        showAiStatus('❌ 텍스트 변환 실패: ' + e.message, 'error');
      }
    });
  }

  const btnClearCommentsOnly = root.querySelector('#btn-hud-clear-comments-only');
  if (btnClearCommentsOnly) {
    btnClearCommentsOnly.addEventListener('click', () => {
      if (confirm("⚠️ 모든 스프라이트의 가이드 주석을 완전히 삭제하시겠습니까?\n(블록 코드는 안전하게 보존됩니다.)")) {
        window.postMessage({
          source: "scratch-hud-content",
          type: "CLEAR_WORKSPACE_PARTIAL",
          payload: { clearBlocks: false, clearComments: true }
        }, "*");
      }
    });
  }

  // UI Utilities 초기화
  if (window.HUDUiUtils) {
    window.HUDUiUtils.initJsonFormatterAndValidator(root, showAiStatus);
    window.HUDUiUtils.initAccordions(root);
  }

  // ── 프롬프트 재생성 함수 ──────────────────────────────────────────
  
  function updateGuideUI() {
    if (!lastSnapshot || !lastParsedByTarget) return;

    const rawComments = lastSnapshot.rawCommentsByTarget || {};
    const cleanComments = lastSnapshot.cleanCommentsByTarget || {};
    let hasStageGuide = false;
    
    // 1. ID 접두사로 검사
    for (const targetName of Object.keys(rawComments)) {
      const targetComments = rawComments[targetName] || {};
      for (const cid of Object.keys(targetComments)) {
        if (cid.startsWith('overview_comment_')) {
          hasStageGuide = true;
          break;
        }
      }
      if (hasStageGuide) break;
    }
    
    // 2. 하위 호환성을 위해 텍스트 키워드로도 검사
    if (!hasStageGuide) {
      for (const [targetName, texts] of Object.entries(cleanComments)) {
        for (const text of texts) {
          if (text.includes("개요") && text.includes("미션")) {
            hasStageGuide = true;
            break;
          }
        }
        if (hasStageGuide) break;
      }
    }
    
    const banner = root.querySelector('#hud-prompt-guide-banner');
    const checklist = root.querySelector('#hud-sprite-checklist');
    const copyBtn = root.querySelector('#btn-copy-prompt');
    const placeholder = root.querySelector('#hud-sprite-checklist-placeholder');
    const progressContainer = root.querySelector('#hud-guide-progress-container');
    const progressStatus = root.querySelector('#hud-guide-progress-status');
    const progressList = root.querySelector('#hud-guide-progress-list');
    
    if (hasStageGuide) {
      if (banner) {
        banner.innerHTML = "✅ <b>설계도 분석 완료!</b> 이제 세부 코딩 지침을 생성하고 싶은 대상 스프라이트를 아래에서 복수 선택하여 프롬프트를 복사하세요.";
        banner.style.backgroundColor = "#dcfce7";
        banner.style.color = "#166534";
      }
      if (copyBtn) {
        copyBtn.innerHTML = "📋 선택한 스프라이트 상세 가이드 프롬프트 복사";
      }
      if (placeholder) {
        placeholder.style.display = "none";
      }
      
      if (checklist && !checklist.hasAttribute('data-populated')) {
        checklist.innerHTML = "";
        for (const targetName of Object.keys(lastParsedByTarget)) {
          const label = document.createElement("label");
          label.style.fontSize = "11px";
          label.style.color = "#475569";
          label.style.display = "flex";
          label.style.alignItems = "center";
          label.style.gap = "4px";
          
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "sprite-checkbox";
          cb.value = targetName;
          cb.style.accentColor = "#6366f1";
          
          label.appendChild(cb);
          label.appendChild(document.createTextNode(targetName));
          checklist.appendChild(label);
        }
        checklist.setAttribute('data-populated', 'true');
      }

      // Update comment injection progress checklist
      if (progressContainer && progressStatus && progressList) {
        progressContainer.style.display = 'block';
        progressList.innerHTML = '';
        
        const rawComments = lastSnapshot.rawCommentsByTarget || {};
        const targets = Object.keys(lastParsedByTarget);
        let completedCount = 0;
        let totalCount = 0;
        
        // 1. 프로젝트 전반 가이드 (Master Overview) 체크
        totalCount++;
        let isOverviewCompleted = false;
        for (const targetName of Object.keys(rawComments)) {
          const targetComments = rawComments[targetName] || {};
          for (const cid of Object.keys(targetComments)) {
            if (cid.startsWith('overview_comment_')) {
              isOverviewCompleted = true;
              break;
            }
          }
          if (isOverviewCompleted) break;
        }
        if (isOverviewCompleted) {
          completedCount++;
        }
        
        const overviewItem = document.createElement('div');
        overviewItem.style.display = 'flex';
        overviewItem.style.justifyContent = 'space-between';
        overviewItem.style.alignItems = 'center';
        overviewItem.style.padding = '4px 0';
        overviewItem.style.borderBottom = '1px solid #e2e8f0';
        
        const overviewNameSpan = document.createElement('span');
        overviewNameSpan.textContent = '📋 프로젝트 전반 가이드';
        overviewNameSpan.style.fontWeight = '600';
        overviewNameSpan.style.color = '#312e81';
        
        const overviewStatusSpan = document.createElement('span');
        overviewStatusSpan.innerHTML = isOverviewCompleted 
          ? '<span style="color:#166534; font-weight:bold;">✅ 주입 완료</span>' 
          : '<span style="color:#b91c1c; font-weight:bold;">❌ 미주입</span>';
        
        overviewItem.appendChild(overviewNameSpan);
        overviewItem.appendChild(overviewStatusSpan);
        progressList.appendChild(overviewItem);

        // 2. 개별 스프라이트 가이드 체크
        for (const targetName of targets) {
          totalCount++;
          let isCompleted = false;
          
          // Check if there is any comment with id starting with 'guide_comment_'
          const targetComments = rawComments[targetName] || {};
          for (const cid of Object.keys(targetComments)) {
            if (cid.startsWith('guide_comment_')) {
              isCompleted = true;
              break;
            }
          }
          
          if (isCompleted) {
            completedCount++;
          }
          
          const item = document.createElement('div');
          item.style.display = 'flex';
          item.style.justifyContent = 'space-between';
          item.style.alignItems = 'center';
          item.style.padding = '4px 0';
          item.style.borderBottom = '1px solid #e2e8f0';
          
          const nameSpan = document.createElement('span');
          nameSpan.textContent = targetName === "무대(배경)" ? "🎬 무대(배경) 코드 가이드" : `👾 ${targetName}`;
          nameSpan.style.fontWeight = '500';
          
          const statusSpan = document.createElement('span');
          statusSpan.innerHTML = isCompleted 
            ? '<span style="color:#166534; font-weight:bold;">✅ 주입 완료</span>' 
            : '<span style="color:#b91c1c; font-weight:bold;">❌ 미주입</span>';
          
          item.appendChild(nameSpan);
          item.appendChild(statusSpan);
          progressList.appendChild(item);
        }
        
        progressStatus.textContent = `${completedCount}/${totalCount} 완료`;
      }

    } else {
      if (banner) {
        banner.innerHTML = "⚠️ <b>프로젝트 전체 요약(뼈대)을 설계하기 위한 프롬프트입니다.</b> AI가 전체 개요 및 단계별 요약 JSON을 출력하도록 구성됩니다.";
        banner.style.backgroundColor = "#e0e7ff";
        banner.style.color = "#3730a3";
      }
      if (copyBtn) {
        copyBtn.innerHTML = "📋 프로젝트 전체 뼈대 프롬프트 복사";
      }
      if (checklist) {
        checklist.innerHTML = `
          <label style="font-size:11px; color:#475569; display:flex; align-items:center; gap:4px; font-weight:bold;">
            <input type="checkbox" id="hud-cb-stage-overview" value="STAGE_AND_OVERVIEW" checked disabled style="accent-color:#6366f1;">
            무대(배경) 및 개요 (기본 포함)
          </label>
          <div id="hud-sprite-checklist-placeholder" style="font-size:10px; color:#ef4444; margin-top:4px; padding-left: 4px;">
            ⚠️ 무대에 가이드 주석이 먼저 주입되어야 개별 스프라이트 선택이 가능해집니다.
          </div>
        `;
        checklist.removeAttribute('data-populated');
      }
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    }
  }

  function rebuildAiPrompt() {
    const preview = root.querySelector('#hud-ai-prompt-preview');
    if (!preview || !lastSnapshot) return;

    const sprites = lastSnapshot.allSpriteNames || [];
    const vars = lastSnapshot.allVariables || [];
    const broadcasts = lastSnapshot.allBroadcasts || [];

    let envText = '';
    if (sprites.length > 0 || vars.length > 0 || broadcasts.length > 0) {
      envText = `\n\n[현재 프로젝트 환경 정보]\n`;
      envText += `- 스프라이트 목록: ${sprites.length > 0 ? sprites.join(', ') : '없음'}\n`;
      envText += `- 변수/리스트 목록: ${vars.length > 0 ? vars.join(', ') : '없음'}\n`;
      envText += `- 방송 신호 목록: ${broadcasts.length > 0 ? broadcasts.join(', ') : '없음'}\n\n`;
      envText += `주의: 위 목록에 명시된 스프라이트 이름, 변수 이름, 방송 신호만 사용해 코드를 생성하고 절대 임의의 이름을 새로 만들지 마십시오.`;
    }

    let commentsText = '';
    const ghostCommentsCount = lastSnapshot.ghostCommentsCount || 0;
    const cleanCommentsByTarget = lastSnapshot.cleanCommentsByTarget || {};
    const commentEntries = [];

    for (const [targetName, texts] of Object.entries(cleanCommentsByTarget)) {
      if (texts && texts.length > 0) {
        commentEntries.push(`- ${targetName}:\n${texts.map(t => `    * ${t.trim()}`).join('\n')}`);
      }
    }

    if (hudIncludeComments && commentEntries.length > 0) {
      commentsText = `\n\n[스프라이트별 구현 지침 (작성된 주석)]\n${commentEntries.join('\n')}`;
    }

    const ghostContainer = root.querySelector('#hud-ghost-cleanup-container');
    const ghostCountEl = root.querySelector('#hud-ghost-count');
    if (ghostContainer && ghostCountEl) {
      if (ghostCommentsCount > 0) {
        ghostCountEl.textContent = ghostCommentsCount;
        ghostContainer.style.display = 'flex';
      } else {
        ghostContainer.style.display = 'none';
      }
    }

    preview.value = AI_PROMPT_BASE + envText + commentsText;
  }


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
      
      // Update AI Prompt Guide with environment variables and optional comments
      rebuildAiPrompt();
      updateGuideUI();
    }

    if (data.type === "CLEANUP_RESULT") {
      const res = data.payload;
      if (res.ok) {
        showAiStatus(`✅ 유령 주석 ${res.count}개를 성공적으로 정리했습니다!`, 'success');
      } else {
        showAiStatus(`❌ 유령 주석 정리 실패: ${res.error || '알 수 없는 오류'}`, 'error');
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
    if (msg.type === "CLEANUP_ORPHANED_COMMENTS") {
      window.postMessage({ source: "scratch-hud-content", type: "CLEANUP_ORPHANED_COMMENTS" }, "*");
    }
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

  const PROMPT_TEMPLATE_INITIAL =
`당신은 스크래치 3.0(Scratch 3.0) 전문 코칭 AI이자 교육 자료 제작자입니다.
전달받은 [정답 프로젝트 JSON]은 완성된 스크래치 과제의 논리 구조입니다.
이 정답 코드를 분석하여, 프로젝트의 전체 개요 및 각 스프라이트별 단계 요약을 포함하는 "최초 뼈대 가이드북"을 작성해 주세요.

### 🗣 작성 규칙
- 개별 스프라이트의 구체적인 블록 조립 지침(예: "1. 🚩 클릭했을 때...")은 절대 포함하지 않습니다. 오직 '요약' 정보만 제공합니다.
- 대상 독자는 초등학교 저학년입니다.
- 각 단계의 요약은 무조건 1줄 이내로 매우 간결하게 핵심 요약 정보만 제공하도록 규칙을 엄격하게 조정합니다.

### 📄 전체 출력 구조 (반드시 이 순서와 규칙을 지켜주세요)
가이드북은 아래 구조를 가지는 **단일 JSON 객체**로만 출력합니다. Markdown 기호(\`\`\`)나 다른 설명은 일절 추가하지 마세요.
또한 JSON 문자열 값 내부에 줄바꿈을 표현할 때는 반드시 이스케이프된 문자열인 "\\n" 만을 사용하고, 절대 실제 줄바꿈을 넣지 마세요.

{
  "개요": "이 프로젝트가 무엇을 만드는 것인지, 어떤 동작을 하는지를 초등학생이 이해할 수 있도록 2~3문장으로 설명합니다.",
  "가이드": {
    "스프라이트이름1": "[N단계: 단계 제목]\\n요약: [단 1줄의 핵심 요약]",
    "스프라이트이름2": "[N단계: 단계 제목]\\n요약: [단 1줄의 핵심 요약]"
  },
  "미션": "완성된 프로젝트를 발전시킬 도전 과제 2~3가지를 의문문 형태로 작성합니다.\\n1. ...\\n2. ..."
}

---

[정답 프로젝트 JSON]
{JSON_DATA}`;

  const PROMPT_TEMPLATE_DETAIL =
`당신은 스크래치 3.0(Scratch 3.0) 전문 코칭 AI이자 교육 자료 제작자입니다.
전달받은 [정답 프로젝트 JSON]은 완성된 스크래치 과제의 논리 구조입니다.
이 정답 코드를 분석하여, 사용자가 선택한 특정 스프라이트들에 대한 "상세 블록 조립 가이드"를 작성해 주세요.

### 🗣 작성 규칙
- 이미 프로젝트 개요와 미션은 작성되었으므로, **오직 "가이드" 객체만 반환**합니다. (최상위 "개요"와 "미션" 키는 제외하세요)
- 대상 독자: 초등학교 저학년
- 간결성: 각 번호 항목은 1~2줄 이내로 끝냅니다.
- 문장 스타일 구분: 난이도에 따라 지정된 문장 스타일을 준수합니다.

### 📄 전체 출력 구조 (반드시 이 순서와 규칙을 지켜주세요)
가이드북은 아래 구조를 가지는 **단일 JSON 객체**로만 출력합니다. Markdown 기호(\`\`\`)나 다른 설명은 일절 추가하지 마세요.

{
  "가이드": {
    "선택된스프라이트1": "[N단계: 단계 제목]\n요약: [이 단계에서 수행하는 핵심 작업 요약]\n1. 구현 가이드...\n2. 구현 가이드...",
    "선택된스프라이트2": "[N단계: 단계 제목]\n요약: [이 단계에서 수행하는 핵심 작업 요약]\n1. 구현 가이드...\n2. 구현 가이드..."
  }
}

---

### 🛠 난이도별 블록 설명 작성 규칙: [주석 난이도 레벨: {USER_SELECTED_LEVEL}]

{LEVEL_SPECIFIC_INSTRUCTION}

---

### 💡 실제 적용 예시 (고기굽기 프로젝트 기준 전체 출력 구조)

{
  "가이드": {
    "고기접시": "[2단계: 불판에 고기 올리기]\n요약: 접시를 클릭하여 불판에 고기 복제본을 생성하고 신호를 보냅니다.\n1. 마우스 포인터에 닿았는지와 마우스를 클릭했는지를 계속해서 감시하도록 구조를 설계해 보세요.\n2. 조건이 만족되면 다른 스프라이트들이 알 수 있도록 [고기] 신호를 보냅니다."
  }
}

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

    const cleanComments = lastSnapshot.cleanCommentsByTarget || {};
    let hasStageGuide = false;
    for (const [targetName, texts] of Object.entries(cleanComments)) {
      for (const text of texts) {
        if (text.includes("개요") && text.includes("미션")) {
          hasStageGuide = true;
          break;
        }
      }
      if (hasStageGuide) break;
    }

    let promptStr = "";

    if (!hasStageGuide) {
      // INITIAL MODE
      promptStr = PROMPT_TEMPLATE_INITIAL.replace('{JSON_DATA}', JSON.stringify(lastParsedByTarget, null, 2));
      
      try {
        await navigator.clipboard.writeText(promptStr);
        showAiStatus('✅ 프로젝트 전체 뼈대 설계 프롬프트가 복사되었습니다.', 'success');
      } catch (err) {
        showAiStatus('복사에 실패했습니다. 권한을 확인하세요.', 'error');
      }

    } else {
      // DETAIL MODE
      const checkedBoxes = Array.from(root.querySelectorAll('.sprite-checkbox:checked'));
      if (checkedBoxes.length === 0) {
        showAiStatus('상세 가이드를 생성할 스프라이트를 하나 이상 선택해주세요.', 'warning');
        return;
      }

      const selectedSpriteNames = checkedBoxes.map(cb => cb.value);
      const filteredData = {};
      for (const [key, value] of Object.entries(lastParsedByTarget)) {
        if (selectedSpriteNames.includes(key)) {
          filteredData[key] = value;
        }
      }

      const selectEl = root.querySelector("#hud-comment-level-select");
      const level = selectEl ? selectEl.value : "basic";

      const selectStyleEl = root.querySelector("#hud-comment-style-select");
      const style = selectStyleEl ? selectStyleEl.value : "text";

      let levelStr = "";
      let levelInst = "";

      if (style === "pseudoblock") {
        levelStr = level === "basic" ? "기초 단계 (직접 지시형 - 유사 블록 구조)" : "심화 단계 (간접 미션형 - 유사 블록 구조)";
        levelInst = level === "basic" ? BASIC_LEVEL_INSTRUCTION_PSEUDO : ADVANCED_LEVEL_INSTRUCTION_PSEUDO;
      } else {
        levelStr = level === "basic" ? "기초 단계 (직접 지시형)" : "심화 단계 (간접 미션형)";
        levelInst = level === "basic" ? BASIC_LEVEL_INSTRUCTION : ADVANCED_LEVEL_INSTRUCTION;
      }

      promptStr = PROMPT_TEMPLATE_DETAIL
        .replace('{USER_SELECTED_LEVEL}', levelStr)
        .replace('{LEVEL_SPECIFIC_INSTRUCTION}', levelInst)
        .replace('{JSON_DATA}', JSON.stringify(filteredData, null, 2));

      try {
        await navigator.clipboard.writeText(promptStr);
        showAiStatus(`✅ 선택된 ${selectedSpriteNames.length}개 스프라이트의 상세 가이드 프롬프트가 복사되었습니다.`, 'success');
      } catch (err) {
        showAiStatus('복사에 실패했습니다. 권한을 확인하세요.', 'error');
      }
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

      const resultText = lines.length > 0
        ? lines.join('\n')
        : '분석할 스크립트를 찾을 수 없습니다.';
      
      navigator.clipboard.writeText(resultText).then(() => {
        showAiStatus('✅ 로컬 가이드가 생성되어 클립보드에 복사되었습니다!', 'success');
      }).catch(err => {
        showAiStatus('❌ 복사에 실패했습니다.', 'error');
      });
    }, 500);
  });

})();
