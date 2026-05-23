// Injected in page context to hook into Scratch React VM and postMessage -> content script
(function () {
  const MAX_RETRY_MS = 15000;
  let startedAt = Date.now();
  let hackVm = null;

  // Attempt to scrape the VM from the React DOM tree
  function findScratchVM() {
    if (hackVm) return hackVm;
    
    // 1. Harder search: inspect all elements to find the GUI wrapper component 
    const allElems = document.querySelectorAll('*');
    for (let i = 0; i < allElems.length; i++) {
      const el = allElems[i];
      const fKey = Object.keys(el).find(k => k.startsWith('__reactInternalInstance$') || k.startsWith('__reactFiber$'));
      if (fKey) {
        let currentFiber = el[fKey];
        while (currentFiber) {
          const props = currentFiber.pendingProps || currentFiber.memoizedProps;
          if (props && props.vm) {
            hackVm = props.vm;
            return hackVm;
          }
          currentFiber = currentFiber.return;
        }
      }
    }
    return null;
  }

  function publishSnapshot() {
    const vm = findScratchVM();
    if (!vm) return;

    try {
      let opcodes = new Set();
      let broadcastSends = new Set();
      let broadcastReceives = new Set();
      let usesVariableOp = false;
      let variablesCount = 0;
      let hasLoop = false;
      let hasMotion = false;
      const rawBlocksByTarget = {};
      const rawCommentsByTarget = {};

      const allSpriteNames = [];
      const allVariables = new Set();
      const allBroadcasts = new Set();

      let editingTargetName = null;
      if (vm.editingTarget) {
        if (vm.editingTarget.isStage) editingTargetName = "무대(배경)";
        else if (vm.editingTarget.sprite && vm.editingTarget.sprite.name) editingTargetName = vm.editingTarget.sprite.name;
        else if (vm.editingTarget.getName && typeof vm.editingTarget.getName === 'function') editingTargetName = vm.editingTarget.getName();
      }

      if (vm.runtime && vm.runtime.targets) {
        vm.runtime.targets.forEach(target => {
          let targetName = "Unknown";
          if (target.isStage) {
            targetName = "무대(배경)";
          } else if (target.sprite && target.sprite.name) {
            targetName = target.sprite.name;
          } else if (target.getName && typeof target.getName === 'function') {
            targetName = target.getName();
          }

          const targetBlocks = {};

          if (target.isOriginal) {
            allSpriteNames.push(targetName);
          }

          // count variables
          if (target.variables) {
             variablesCount += Object.keys(target.variables).length;
             Object.values(target.variables).forEach(v => {
               if (v.type === 'broadcast_msg') {
                 allBroadcasts.add(v.name);
               } else if (v.type === '') {
                 allVariables.add(v.name);
               } else if (v.type === 'list') {
                 allVariables.add(v.name + " (리스트)");
               }
             });
          }

          // scrape blocks
          if (target.blocks && target.blocks._blocks) {
            const blocksObj = target.blocks._blocks;
            Object.keys(blocksObj).forEach(blockId => {
              const b = blocksObj[blockId];
              // Some elements could be arrays if it's a top-level primitive (like [4, "10"])
              // We only collect structural blocks into dictionary
              targetBlocks[blockId] = b;
              
              if (b && typeof b === 'object' && b.opcode) {
                opcodes.add(b.opcode);
                if (b.opcode.startsWith("motion_")) hasMotion = true;
                if (b.opcode.startsWith("data_")) usesVariableOp = true;
                if (
                  b.opcode === "control_forever" ||
                  b.opcode === "control_repeat" ||
                  b.opcode === "control_repeat_until"
                ) {
                  hasLoop = true;
                }
              }
            });
          }
          
          if (Object.keys(targetBlocks).length > 0) {
            rawBlocksByTarget[targetName] = targetBlocks;
          }
          if (target.comments && Object.keys(target.comments).length > 0) {
            rawCommentsByTarget[targetName] = { ...target.comments };
          }
        });
      }

      window.postMessage(
        {
          source: "scratch-hud",
          type: "WORKSPACE_SNAPSHOT",
          payload: {
            opcodes: [...opcodes],
            broadcastSends: [...broadcastSends],
            broadcastReceives: [...broadcastReceives],
            variablesCount,
            usesVariableOp,
            hasLoop,
            hasMotion,
            rawBlocksByTarget,
            rawCommentsByTarget,
            editingTargetName,
            allSpriteNames,
            allVariables: [...allVariables],
            allBroadcasts: [...allBroadcasts]
          },
        },
        "*"
      );

    } catch (e) {
      console.error("Scratch HUD Coach: Error generating snapshot from VM:", e);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // XML 헬퍼: 평면 블록 딕셔너리 → Blockly/ScratchBlocks XML 문자열
  // ─────────────────────────────────────────────────────────────────

  function _escXml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 그림자 블록 → XML 문자열
   */
  function _shadowToXml(id, flatBlocks) {
    const b = flatBlocks[id];
    if (!b) return '';
    let xml = `<shadow type="${_escXml(b.opcode)}" id="${_escXml(id)}">`;
    for (const [fn, fobj] of Object.entries(b.fields || {})) {
      const val = (fobj && typeof fobj === 'object') ? (fobj.value ?? '') : (fobj ?? '');
      xml += `<field name="${_escXml(fn)}">${_escXml(val)}</field>`;
    }
    xml += '</shadow>';
    return xml;
  }

  /**
   * 일반 블록(+ next 체인) → XML 문자열 (재귀)
   * visited: 순환 참조 방지
   */
  function _blockToXml(id, flatBlocks, visited) {
    if (!id || visited.has(id)) return '';
    const b = flatBlocks[id];
    if (!b || b.shadow) return '';
    visited.add(id);

    let xml = `<block type="${_escXml(b.opcode)}" id="${_escXml(id)}"`;
    if (b.topLevel) xml += ` x="${b.x || 0}" y="${b.y || 0}"`;
    xml += '>';

    if (b.comment) {
      xml += `<comment pinned="false" w="250" h="120">${_escXml(b.comment)}</comment>`;
    }

    // fields
    for (const [fn, fobj] of Object.entries(b.fields || {})) {
      const val = (fobj && typeof fobj === 'object') ? (fobj.value ?? '') : (fobj ?? '');
      xml += `<field name="${_escXml(fn)}">${_escXml(val)}</field>`;
    }

    // inputs
    for (const [iname, iobj] of Object.entries(b.inputs || {})) {
      if (!iobj) continue;
      const blockId  = iobj.block;
      const shadowId = iobj.shadow;

      // SUBSTACK / CONDITION → <statement>
      const isStatement =
        iname === 'SUBSTACK' || iname === 'SUBSTACK2' ||
        iname === 'CONDITION' || iname === 'CONDITION2';

      if (isStatement) {
        // block 포인터가 가리키는 대상이 비-그림자 블록이어야 함
        if (blockId && flatBlocks[blockId] && !flatBlocks[blockId].shadow) {
          xml += `<statement name="${_escXml(iname)}">`;
          xml += _blockToXml(blockId, flatBlocks, new Set(visited));
          xml += '</statement>';
        }
      } else {
        // value input
        xml += `<value name="${_escXml(iname)}">`;
        // 그림자(slot 배경)가 있으면 먼저 렌더
        if (shadowId && flatBlocks[shadowId] && flatBlocks[shadowId].shadow) {
          xml += _shadowToXml(shadowId, flatBlocks);
        }
        // foreground 블록이 shadow와 다를 경우(= 실제 리포터가 꽂혀있는 경우)
        if (blockId && blockId !== shadowId && flatBlocks[blockId]) {
          if (flatBlocks[blockId].shadow) {
            // shadow==block 동일ID인데 아직 안 렌더된 경우 (안전망)
            if (!shadowId || shadowId !== blockId) {
              xml += _shadowToXml(blockId, flatBlocks);
            }
          } else {
            xml += _blockToXml(blockId, flatBlocks, new Set(visited));
          }
        }
        xml += '</value>';
      }
    }

    // next (시퀀스 연결)
    if (b.next && flatBlocks[b.next]) {
      xml += `<next>${_blockToXml(b.next, flatBlocks, new Set(visited))}</next>`;
    }

    xml += '</block>';
    return xml;
  }

  /**
   * 평면 블록 딕셔너리 → 완전한 Blockly XML 문자열
   */
  function flatBlocksToXml(flatBlocks) {
    const topIds = Object.keys(flatBlocks).filter(
      id => flatBlocks[id] && flatBlocks[id].topLevel && !flatBlocks[id].shadow
    );
    const parts = topIds.map(id => _blockToXml(id, flatBlocks, new Set()));
    return `<xml xmlns="https://developers.google.com/blockly/xml">${parts.join('')}</xml>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // VM 주입: 2-전략 구조
  // ─────────────────────────────────────────────────────────────────

  /**
   * AI가 생성한 평면 블록 딕셔너리를 현재 editingTarget에 주입합니다.
   *
   * Strategy 1 (정공법): XML → ScratchBlocks.Xml.domToWorkspace()
   *   Blockly 이벤트 시스템을 통해 GUI와 VM이 동시에 동기화됩니다.
   *   새로고침 없이 블록이 즉시 화면에 나타납니다.
   *
   * Strategy 2 (폴백): _blocks 직접 수정 + emitWorkspaceUpdate()
   *   ScratchBlocks 객체를 확보할 수 없는 환경에서만 사용합니다.
   *
   * @param {{ blocks: Object }} payload
   * @returns {{ ok: boolean, count?: number, method?: string, error?: string }}
   */
  function applyBlocksToVM(payload) {
    try {
      const vm = findScratchVM();
      if (!vm) {
        return { ok: false, error: 'Scratch VM을 찾을 수 없습니다. 페이지를 새로고침하세요.' };
      }

      const target = vm.editingTarget;
      if (!target || !target.blocks) {
        return { ok: false, error: '편집 중인 스프라이트가 없습니다. 스프라이트를 선택하세요.' };
      }

      const newBlocks = payload && payload.blocks;
      if (!newBlocks || typeof newBlocks !== 'object' || Object.keys(newBlocks).length === 0) {
        return { ok: false, error: '주입할 블록 데이터가 비어 있습니다.' };
      }

      // ── Strategy 1: XML → domToWorkspace ────────────────────────
      const SB = window.ScratchBlocks || window.Blockly;
      if (SB && typeof SB.getMainWorkspace === 'function' && SB.Xml) {
        const ws = SB.getMainWorkspace();
        if (ws) {
          try {
            const xmlStr = flatBlocksToXml(newBlocks);
            console.log('[HUD Coach] XML to inject:', xmlStr); // 디버그용

            const dom = SB.Xml.textToDom(xmlStr);

            // domToWorkspace: 기존 블록 유지하면서 XML의 블록들을 추가
            const newBlockIds = SB.Xml.domToWorkspace(dom, ws);
            
            // 자동 스크롤 포커스
            if (newBlockIds && newBlockIds.length > 0) {
              const topBlock = ws.getBlockById(newBlockIds[0]);
              if (topBlock) {
                topBlock.select(); // 블록 선택 효과 및 자동 스크롤
              }
            }

            const nonShadowCount = Object.values(newBlocks).filter(b => b && !b.shadow).length;
            setTimeout(() => publishSnapshot(), 300);
            return { ok: true, count: nonShadowCount, method: 'xml+domToWorkspace', fallback: payload.fallback, targetSprite: payload.targetSprite, currentSprite: payload.currentSprite };
          } catch (xmlErr) {
            console.warn('[HUD Coach] Strategy 1 (XML) 실패, Strategy 2로 폴백:', xmlErr);
          }
        }
      }

      // ── Strategy 2: 직접 _blocks 수정 + emitWorkspaceUpdate ─────
      console.warn('[HUD Coach] ScratchBlocks 미확보 → _blocks 직접 수정 모드');
      const existingBlocks = target.blocks._blocks;
      let count = 0;
      for (const [id, block] of Object.entries(newBlocks)) {
        existingBlocks[id] = block;
        if (block.comment && target.comments) {
          const commentId = id + '_comment';
          target.comments[commentId] = {
            id: commentId,
            blockId: id,
            x: (block.x || 0) + 200,
            y: block.y || 0,
            width: 250,
            height: 120,
            minimized: false,
            text: block.comment
          };
        }
        count++;
      }

      // 1) VM 내부 이벤트 발생
      try {
        if (typeof vm.emitWorkspaceUpdate === 'function') vm.emitWorkspaceUpdate();
      } catch (e) {
        console.warn('[HUD Coach] emitWorkspaceUpdate 실패:', e);
      }

      // 2) Blockly 강제 렌더 (있으면 시도)
      try {
        if (SB && typeof SB.getMainWorkspace === 'function') {
          const ws = SB.getMainWorkspace();
          if (ws && typeof ws.render === 'function') ws.render();
        }
      } catch (e) { /* ignore */ }

      setTimeout(() => publishSnapshot(), 200);
      return { ok: true, count, method: 'direct+emitUpdate', fallback: payload.fallback, targetSprite: payload.targetSprite, currentSprite: payload.currentSprite };

    } catch (e) {
      console.error('[HUD Coach] applyBlocksToVM 오류:', e);
      return { ok: false, error: String(e) };
    }
  }

  function start() {
    const vm = findScratchVM();
    if (!vm) return;

    // Send initial snapshot
    publishSnapshot();

    // Attach to the Blockly workspace as a trigger to run publishSnapshot
    // This provides the fastest feeling of UI responsiveness when dropping blocks
    try {
      if (window.ScratchBlocks && typeof window.ScratchBlocks.getMainWorkspace === 'function') {
         const ws = window.ScratchBlocks.getMainWorkspace();
         if (ws) {
            ws.addChangeListener(() => {
               clearTimeout(window.__hud_snap_to);
               window.__hud_snap_to = setTimeout(() => publishSnapshot(), 300);
            });
         }
      } else if (window.Blockly && typeof window.Blockly.getMainWorkspace === 'function') {
         const ws = window.Blockly.getMainWorkspace();
         if (ws) {
            ws.addChangeListener(() => {
               clearTimeout(window.__hud_snap_to);
               window.__hud_snap_to = setTimeout(() => publishSnapshot(), 300);
            });
         }
      }
    } catch (e) {
      // ignore blockly bind error
    }

    // Fallback polling: just in case blockly listener misses something (e.g. variable renames)
    setInterval(() => publishSnapshot(), 1500);

    // Listen to HUD messages
    window.addEventListener("message", (ev) => {
      if (!ev.data || ev.data.source !== "scratch-hud-content") return;

      // ── 스냅샷 요청 ──────────────────────────────────────
      if (ev.data.type === "REQUEST_SNAPSHOT") {
        publishSnapshot();
      }

      // ── AI 블록 주입 ──────────────────────────────────────
      if (ev.data.type === "APPLY_WORKSPACE_UPDATE") {
        const result = applyBlocksToVM(ev.data.payload);
        window.postMessage(
          { source: "scratch-hud", type: "APPLY_RESULT", payload: result },
          "*"
        );
      }

      // ── 다중 스프라이트 벌크 주입 ──────────────────────────
      if (ev.data.type === "APPLY_CUSTOM_BULK_UPDATE") {
        const result = applyBulkBlocksToVM(ev.data.payload.deparsedJson || ev.data.payload.customJson);
        console.log("[HUD Coach] Bulk update result:", result);
      }
    });
  }

  function applyBulkBlocksToVM(deparsedJson) {
    const vm = findScratchVM();
    if (!vm || !vm.runtime || !vm.runtime.targets) return { ok: false, error: 'VM not found' };

    let successCount = 0;
    let errorMsgs = [];
    const targets = vm.runtime.targets;

    for (const [targetName, flatBlocks] of Object.entries(deparsedJson)) {
      if (!flatBlocks || Object.keys(flatBlocks).length === 0) continue;

      const target = targets.find(t => {
        if (t.isStage && targetName === "무대(배경)") return true;
        return t.sprite && t.sprite.name === targetName;
      });

      if (!target) {
        errorMsgs.push(`스프라이트 [${targetName}]를 찾을 수 없습니다.`);
        continue;
      }

      try {
        const isActive = (vm.editingTarget === target);

        if (isActive) {
          const SB = window.ScratchBlocks || window.Blockly;
          if (SB && typeof SB.getMainWorkspace === 'function' && SB.Xml) {
            const ws = SB.getMainWorkspace();
            if (ws) {
              try {
                const xmlStr = flatBlocksToXml(flatBlocks);
                const dom = SB.Xml.textToDom(xmlStr);
                const newIds = SB.Xml.domToWorkspace(dom, ws);
                if (newIds && newIds.length > 0) {
                  const topBlock = ws.getBlockById(newIds[0]);
                  if (topBlock) topBlock.select();
                }
                successCount++;
                continue;
              } catch (e) {
                console.warn('[HUD Coach] Active sprite XML injection failed, falling back:', e);
              }
            }
          }
        }

        // Direct mutation
        const existingBlocks = target.blocks._blocks;
        for (const [id, block] of Object.entries(flatBlocks)) {
          existingBlocks[id] = block;
          if (block.comment && target.comments) {
            const commentId = id + '_comment';
            target.comments[commentId] = {
              id: commentId,
              blockId: id,
              x: (block.x || 0) + 200,
              y: block.y || 0,
              width: 250,
              height: 120,
              minimized: false,
              text: block.comment
            };
          }
        }
        successCount++;
      } catch(e) {
        errorMsgs.push(`[${targetName}] 에러: ${e.message}`);
      }
    }

    try {
      if (typeof vm.emitWorkspaceUpdate === 'function') {
        vm.emitWorkspaceUpdate();
      }
    } catch (e) {}

    publishSnapshot();

    return { ok: successCount > 0, successCount, errors: errorMsgs };
  }

  // Poll DOM until React is loaded and VM is found
  (function waitUntilReady() {
    if (findScratchVM()) {
      start();
    } else if (Date.now() - startedAt < MAX_RETRY_MS) {
      setTimeout(waitUntilReady, 500);
    } else {
      console.warn("Scratch HUD Coach: Could not hook into the Scratch VM after 15 seconds.");
    }
  })();
})();
