// content/injector.js
(function () {
  const CATEGORIES = [
    { file: '01_동작.json', name: '동작' },
    { file: '02_형태.json', name: '형태' },
    { file: '03_소리.json', name: '소리' },
    { file: '04_이벤트.json', name: '이벤트' },
    { file: '05_제어.json', name: '제어' },
    { file: '06_감지.json', name: '감지' },
    { file: '07_연산.json', name: '연산' },
    { file: '08_변수.json', name: '변수' },
    { file: '09_내블록.json', name: '내블록' },
    { file: '10_펜.json', name: '펜' }
  ];

  let templatesData = {};
  let currentSnapshot = null;
  let customInjectFired = false;

  let lastSavedSprites = [];
  let lastSavedVariables = [];
  let lastSavedBroadcasts = [];

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Listen to workspace snapshot to keep track of current target and its blocks
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.source === "scratch-hud" && ev.data.type === "WORKSPACE_SNAPSHOT") {
      currentSnapshot = ev.data.payload;
      
      // Save environment data for the popup UI and AI Guide
      if (currentSnapshot) {
        const newSprites = currentSnapshot.allSpriteNames || [];
        const newVars = currentSnapshot.allVariables || [];
        const newBroadcasts = currentSnapshot.allBroadcasts || [];

        if (!arraysEqual(lastSavedSprites, newSprites) ||
            !arraysEqual(lastSavedVariables, newVars) ||
            !arraysEqual(lastSavedBroadcasts, newBroadcasts)) {
          
          lastSavedSprites = newSprites;
          lastSavedVariables = newVars;
          lastSavedBroadcasts = newBroadcasts;

          chrome.storage.local.set({
            custom_sprites_list: newSprites,
            custom_variables_list: newVars,
            custom_broadcasts_list: newBroadcasts
          });
        }
      }

      // AI Custom JSON Auto-Inject Check
      if (!customInjectFired) {
        customInjectFired = true; // Lock synchronously to prevent multiple rapid triggers
        chrome.storage.local.get(["custom_inject_pending", "custom_inject_json"], (res) => {
          if (res.custom_inject_pending && res.custom_inject_json) {
            try {
              const parsedJson = JSON.parse(res.custom_inject_json);
              
              // Deparse sequences to flat blocks in content script where ScratchParser is available
              const deparsedJson = {};
              if (window.ScratchParser) {
                for (const [targetName, sequences] of Object.entries(parsedJson)) {
                  if (!Array.isArray(sequences) || sequences.length === 0) continue;
                  
                  let maxY = 80;
                  if (currentSnapshot && currentSnapshot.rawBlocksByTarget && currentSnapshot.rawBlocksByTarget[targetName]) {
                    const blocks = currentSnapshot.rawBlocksByTarget[targetName];
                    let maxFoundY = null;
                    Object.values(blocks).forEach(b => {
                      if (b.topLevel && b.y !== undefined) {
                        if (maxFoundY === null || b.y > maxFoundY) maxFoundY = b.y;
                      }
                    });
                    if (maxFoundY !== null) {
                      maxY = maxFoundY + 100;
                    }
                  }
                  
                  deparsedJson[targetName] = window.ScratchParser.deparse(sequences, { x: 80, y: maxY });
                }
              }

              // 1회성 주입을 위해 플래그 즉시 초기화
              chrome.storage.local.set({ custom_inject_pending: false }, () => {
                // Bulk Update 메시지 전송
                window.postMessage({
                  source: "scratch-hud-content",
                  type: "APPLY_CUSTOM_BULK_UPDATE",
                  payload: { deparsedJson: deparsedJson }
                }, "*");
              });
            } catch (e) {
              console.error("[HUD Coach] Custom Inject JSON parse error:", e);
            }
          } else {
            // No pending injection found, release the lock
            customInjectFired = false;
          }
        });
      }
    }
  });

  function getCategoryClass(opcode) {
    if (!opcode) return 'motion';
    if (opcode.startsWith('motion_')) return 'motion';
    if (opcode.startsWith('looks_')) return 'looks';
    if (opcode.startsWith('sound_')) return 'sound';
    if (opcode.startsWith('event_')) return 'events';
    if (opcode.startsWith('control_')) return 'control';
    if (opcode.startsWith('sensing_')) return 'sensing';
    if (opcode.startsWith('operator_')) return 'operators';
    if (opcode.startsWith('data_')) return 'data';
    if (opcode.startsWith('procedures_')) return 'myBlocks';
    if (opcode.startsWith('pen_')) return 'pen';
    return 'motion';
  }

  function getOpcodeLabel(opcode) {
    const map = {
      'motion_movesteps': '만큼 움직이기',
      'motion_turnright': '오른쪽 회전',
      'motion_turnleft': '왼쪽 회전',
      'motion_goto': '위치로 이동하기',
      'motion_gotoxy': 'x, y 이동',
      'motion_glideto': '부드럽게 이동',
      'motion_pointindirection': '방향 보기',
      'looks_sayforsecs': '말하기',
      'looks_say': '말하기',
      'looks_switchcostumeto': '모양으로 바꾸기',
      'looks_nextcostume': '다음 모양',
      'looks_hide': '숨기기',
      'looks_show': '보이기',
      'event_whenflagclicked': '[시작] 깃발 클릭 시',
      'event_whenkeypressed': '키를 눌렀을 때',
      'event_broadcast': '신호 보내기',
      'event_whenbroadcastreceived': '신호를 받았을 때',
      'control_wait': '초 기다리기',
      'control_repeat': '번 반복하기',
      'control_forever': '무한 반복하기',
      'control_if': '만약 ~ 라면',
      'control_if_else': '만약 ~ 라면 아니면',
      'control_stop': '멈추기',
      'control_create_clone_of': '복제하기',
      'control_start_as_clone': '복제되었을 때',
      'data_setvariableto': '변수 정하기',
      'data_changevariableby': '변수 바꾸기',
      'sensing_touchingobject': '닿았는가?'
    };
    return map[opcode] || opcode;
  }

  function renderBlockPreview(sequence) {
    let html = '';
    // Limit to first 3 blocks to avoid massive previews
    const maxPreview = Math.min(sequence.length, 3);
    for (let i = 0; i < maxPreview; i++) {
      const block = sequence[i];
      const cssClass = getCategoryClass(block.opcode);
      const label = getOpcodeLabel(block.opcode);
      
      let inputsHtml = '';
      if (block.inputs) {
        Object.keys(block.inputs).forEach(key => {
          const val = block.inputs[key];
          // Extracted value heuristic for simple primitive values
          let displayVal = '?';
          if (val && val.fields && val.fields.NUM) displayVal = val.fields.NUM;
          else if (val && val.fields && val.fields.TEXT) displayVal = val.fields.TEXT;
          else if (val && val.fields && val.fields.TO) displayVal = val.fields.TO;
          else if (val && val.fields && val.fields.COSTUME) displayVal = val.fields.COSTUME;
          else if (val && val.fields && val.fields.BROADCAST_OPTION) displayVal = val.fields.BROADCAST_OPTION;
          
          if (displayVal !== '?') {
            inputsHtml += `<span class="scratch-mini-input">${displayVal}</span>`;
          }
        });
      }
      
      html += `<div class="scratch-mini-block ${cssClass}">${inputsHtml} ${label}</div>`;
    }
    if (sequence.length > 3) {
      html += `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">+ ${sequence.length - 3}개 블록 더보기</div>`;
    }
    return html;
  }

  function showToast(message, type = 'warning') {
    let toast = document.getElementById('hud-toast-container');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'hud-toast-container';
      toast.className = 'hud-toast-banner';
      
      const content = document.createElement('div');
      content.className = 'hud-toast-banner-content';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'hud-toast-banner-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = () => {
        toast.classList.remove('show');
      };
      
      toast.appendChild(content);
      toast.appendChild(closeBtn);
      
      const body = document.getElementById('hud-coach-body');
      if (body) {
        body.style.position = 'relative';
        body.insertBefore(toast, body.firstChild);
      }
    }
    
    // Setup message and style
    toast.querySelector('.hud-toast-banner-content').innerHTML = message;
    if (type === 'success') {
      toast.classList.add('success');
    } else {
      toast.classList.remove('success');
    }
    
    // Trigger animation
    toast.classList.remove('show');
    // force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    
    // Auto hide after 8s
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 8000);
  }

  async function loadCategories() {
    const select = document.getElementById('hud-injector-category');
    if (!select) return;
    
    select.innerHTML = '<option value="">카테고리 선택...</option>';
    
    for (const cat of CATEGORIES) {
      try {
        const url = chrome.runtime.getURL('resource/' + cat.file);
        const res = await fetch(url);
        const data = await res.json();
        templatesData[cat.name] = data;
        
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        select.appendChild(option);
      } catch (e) {
        console.warn('Failed to load template:', cat.file, e);
      }
    }
    
    select.addEventListener('change', (e) => {
      renderTemplateList(e.target.value);
    });
  }

  function renderTemplateList(categoryName) {
    const listContainer = document.getElementById('hud-injector-list');
    listContainer.innerHTML = '';
    
    if (!categoryName || !templatesData[categoryName]) return;
    
    const categoryData = templatesData[categoryName];
    // Usually there is one target key like "Sprite1" or "접시"
    for (const targetSprite in categoryData) {
      const sequences = categoryData[targetSprite];
      
      sequences.forEach((sequence, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'injector-block-item';
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'injector-block-preview';
        previewDiv.innerHTML = renderBlockPreview(sequence);
        
        const btn = document.createElement('button');
        btn.className = 'injector-btn';
        btn.textContent = '주입하기';
        btn.onclick = () => {
          injectSequence(sequence, targetSprite);
        };
        
        itemDiv.appendChild(previewDiv);
        itemDiv.appendChild(btn);
        listContainer.appendChild(itemDiv);
      });
    }
  }

  function injectSequence(sequence, templateTargetName) {
    if (!window.ScratchParser) {
      showToast('❌ ScratchParser를 불러올 수 없습니다.', 'warning');
      return;
    }
    
    let currentTargetName = "Unknown";
    let maxY = 80; // default y
    
    if (currentSnapshot) {
      currentTargetName = currentSnapshot.editingTargetName || "Unknown";
      
      // Calculate maxY from current target's blocks
      if (currentSnapshot.rawBlocksByTarget && currentSnapshot.rawBlocksByTarget[currentTargetName]) {
        const blocks = currentSnapshot.rawBlocksByTarget[currentTargetName];
        let maxFoundY = null;
        Object.values(blocks).forEach(b => {
          if (b.topLevel && b.y !== undefined) {
            if (maxFoundY === null || b.y > maxFoundY) maxFoundY = b.y;
          }
        });
        if (maxFoundY !== null) {
          maxY = maxFoundY + 100;
        }
      }
    }
    
    const isFallback = (currentTargetName !== templateTargetName);
    
    const flatBlocks = window.ScratchParser.deparse([sequence], { x: 80, y: maxY });
    
    window.postMessage({
      source: "scratch-hud-content",
      type: "APPLY_WORKSPACE_UPDATE",
      payload: { 
        blocks: flatBlocks, 
        fallback: isFallback, 
        targetSprite: templateTargetName, 
        currentSprite: currentTargetName 
      }
    }, "*");
  }

  // Listen for apply result
  window.addEventListener("message", (ev) => {
    if (ev.data && ev.data.source === "scratch-hud" && ev.data.type === "APPLY_RESULT") {
      const res = ev.data.payload;
      if (res.ok) {
        if (res.fallback) {
          showToast(`⚠️ <b>대체 주입 안내</b><br>원래 <b>[${res.targetSprite}]</b> 전용 블록이지만, 현재 <b>[${res.currentSprite}]</b>에 강제 주입되었습니다.`, 'warning');
        } else {
          showToast(`✅ 블록이 성공적으로 주입되었습니다.`, 'success');
        }
      } else {
        showToast(`❌ 오류: ${res.error}`, 'warning');
      }
    }
  });

  // Listen for storage changes to allow multiple injections without reloading
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.custom_inject_pending && changes.custom_inject_pending.newValue === true) {
      customInjectFired = false;
      // Request a snapshot immediately to trigger injection
      window.postMessage({
        source: "scratch-hud-content",
        type: "REQUEST_SNAPSHOT"
      }, "*");
    }
  });

  // Initialize
  setTimeout(() => {
    loadCategories();
  }, 1000); // Give HUD some time to mount

})();
