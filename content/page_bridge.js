// Injected in page context to hook into Scratch React VM and postMessage -> content script
(function () {
  const MAX_RETRY_MS = 15000;
  let startedAt = Date.now();
  let hackVm = null;
  let lastSnapshotJson = null;

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

  function refreshDynamicMenus(blockIds, ws) {
    if (!blockIds || blockIds.length === 0 || !ws) return;
    blockIds.forEach(bid => {
      const block = ws.getBlockById(bid);
      if (block) {
        const descendants = block.getDescendants(false);
        descendants.forEach(child => {
          if (child.type === 'sensing_of') {
            const propField = child.getField('PROPERTY');
            if (propField && typeof propField.setValue === 'function') {
              const val = propField.getValue();
              propField.setValue(val);
            }
          }
        });
      }
    });
  }

  let cachedWorkspace = null;
  let cachedScratchBlocks = null;

  function findBlocklyAndWorkspace() {
    // Check if cache is still valid and attached to the DOM
    if (cachedWorkspace && cachedScratchBlocks) {
      try {
        const svg = typeof cachedWorkspace.getParentSvg === 'function' ? cachedWorkspace.getParentSvg() : null;
        if (svg && document.body.contains(svg)) {
          return { workspace: cachedWorkspace, ScratchBlocks: cachedScratchBlocks };
        }
      } catch (e) {
        // Cache is invalid or errored, clear it
        cachedWorkspace = null;
        cachedScratchBlocks = null;
      }
    }

    // Check globals
    if (window.ScratchBlocks && typeof window.ScratchBlocks.getMainWorkspace === 'function') {
      const ws = window.ScratchBlocks.getMainWorkspace();
      if (ws) {
        return { workspace: ws, ScratchBlocks: window.ScratchBlocks };
      }
    }
    if (window.Blockly && typeof window.Blockly.getMainWorkspace === 'function') {
      const ws = window.Blockly.getMainWorkspace();
      if (ws) {
        return { workspace: ws, ScratchBlocks: window.Blockly };
      }
    }

    // React DOM tree traversal
    try {
      const allElems = document.querySelectorAll('*');
      for (let i = 0; i < allElems.length; i++) {
        const el = allElems[i];
        const fKey = Object.keys(el).find(k => k.startsWith('__reactInternalInstance$') || k.startsWith('__reactFiber$'));
        if (fKey) {
          let currentFiber = el[fKey];
          while (currentFiber) {
            const stateNode = currentFiber.stateNode;
            if (stateNode) {
              if (stateNode.workspace && stateNode.ScratchBlocks) {
                cachedWorkspace = stateNode.workspace;
                cachedScratchBlocks = stateNode.ScratchBlocks;
                return { workspace: cachedWorkspace, ScratchBlocks: cachedScratchBlocks };
              }
              if (stateNode.workspace) {
                cachedWorkspace = stateNode.workspace;
              }
              if (stateNode.ScratchBlocks) {
                cachedScratchBlocks = stateNode.ScratchBlocks;
              }
            }

            const props = currentFiber.pendingProps || currentFiber.memoizedProps;
            if (props) {
              if (props.workspace) {
                cachedWorkspace = props.workspace;
              }
              if (props.ScratchBlocks) {
                cachedScratchBlocks = props.ScratchBlocks;
              }
            }

            if (cachedWorkspace && cachedScratchBlocks) {
              return { workspace: cachedWorkspace, ScratchBlocks: cachedScratchBlocks };
            }
            currentFiber = currentFiber.return;
          }
        }
      }
    } catch (e) {
      console.warn('[HUD Coach] React DOM tree workspace search error:', e);
    }

    if (cachedWorkspace) {
      return {
        workspace: cachedWorkspace,
        ScratchBlocks: cachedScratchBlocks || window.ScratchBlocks || window.Blockly || null
      };
    }

    return { workspace: null, ScratchBlocks: null };
  }

  let lastQuickFingerprint = "";
  function checkQuickChanged(vm) {
    if (!vm || !vm.runtime) return false;
    let totalBlocks = 0;
    let totalComments = 0;
    const targetCount = vm.runtime.targets ? vm.runtime.targets.length : 0;
    
    let editingTargetName = "none";
    if (vm.editingTarget) {
      if (vm.editingTarget.isStage) editingTargetName = "stage";
      else if (vm.editingTarget.sprite && vm.editingTarget.sprite.name) editingTargetName = vm.editingTarget.sprite.name;
    }

    if (vm.runtime.targets) {
      vm.runtime.targets.forEach(t => {
        if (t.blocks && t.blocks._blocks) {
          totalBlocks += Object.keys(t.blocks._blocks).length;
        }
        if (t.comments) {
          totalComments += Object.keys(t.comments).length;
        }
      });
    }

    const currentFingerprint = `${targetCount}_${totalBlocks}_${totalComments}_${editingTargetName}`;
    if (currentFingerprint === lastQuickFingerprint) {
      return false;
    }
    lastQuickFingerprint = currentFingerprint;
    return true;
  }

  function publishSnapshot(force = false) {
    const vm = findScratchVM();
    if (!vm) return;

    tryBindChangeListener();

    if (force !== true) {
      const isChanged = checkQuickChanged(vm);
      if (!isChanged) return;
    }

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
      const cleanCommentsByTarget = {};
      let ghostCommentsCount = 0;
      let ghostCommentsTargets = new Set();

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
            
            // Pre-calculate clean comments and ghost count
            const texts = Object.values(target.comments)
              .filter(c => {
                if (c && c.blockId && !targetBlocks[c.blockId]) {
                  ghostCommentsCount++;
                  ghostCommentsTargets.add(targetName);
                  return false;
                }
                return true;
              })
              .map(c => c && c.text)
              .filter(t => typeof t === 'string' && t.trim().length > 0);
            if (texts.length > 0) {
              cleanCommentsByTarget[targetName] = texts;
            }
          }
        });
      }

      // Check snapshot cache
      const snapshotFingerprintObj = {
        blocks: rawBlocksByTarget,
        comments: rawCommentsByTarget,
        sprites: allSpriteNames,
        vars: [...allVariables],
        broadcasts: [...allBroadcasts],
        editingTarget: editingTargetName,
        ghostCommentsCount,
        ghostCommentsTargets: [...ghostCommentsTargets]
      };
      
      const snapshotJson = JSON.stringify(snapshotFingerprintObj);
      if (force !== true && snapshotJson === lastSnapshotJson) {
        return;
      }
      lastSnapshotJson = snapshotJson;

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
            cleanCommentsByTarget,
            ghostCommentsCount,
            ghostCommentsTargets: [...ghostCommentsTargets],
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
      const { workspace: ws, ScratchBlocks: SB } = findBlocklyAndWorkspace();
      if (ws) {
        try {
          const xmlStr = flatBlocksToXml(newBlocks);
          console.log('[HUD Coach] XML to inject:', xmlStr); // 디버그용

          let dom;
          if (SB && SB.Xml && typeof SB.Xml.textToDom === 'function') {
            dom = SB.Xml.textToDom(xmlStr);
          } else {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlStr, "text/xml");
            dom = doc.documentElement;
          }

          // domToWorkspace: 기존 블록 유지하면서 XML의 블록들을 추가
          let newBlockIds = [];
          if (SB && SB.Xml && typeof SB.Xml.domToWorkspace === 'function') {
            newBlockIds = SB.Xml.domToWorkspace(dom, ws);
          } else {
            throw new Error('domToWorkspace 함수를 찾을 수 없습니다.');
          }
          
          // 자동 스크롤 포커스 및 동적 메뉴 로컬라이즈 리프레시
          if (newBlockIds && newBlockIds.length > 0) {
            refreshDynamicMenus(newBlockIds, ws);
            const topBlock = ws.getBlockById(newBlockIds[0]);
            if (topBlock && typeof topBlock.select === 'function') {
              topBlock.select(); // 블록 선택 효과 및 자동 스크롤
            }
          }

          const nonShadowCount = Object.values(newBlocks).filter(b => b && !b.shadow).length;
          setTimeout(() => publishSnapshot(true), 300);
          return { ok: true, count: nonShadowCount, method: 'xml+domToWorkspace', fallback: payload.fallback, targetSprite: payload.targetSprite, currentSprite: payload.currentSprite };
        } catch (xmlErr) {
          console.warn('[HUD Coach] Strategy 1 (XML) 실패, Strategy 2로 폴백:', xmlErr);
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
        const { workspace: fallbackWs } = findBlocklyAndWorkspace();
        if (fallbackWs && typeof fallbackWs.render === 'function') {
          fallbackWs.render();
        }
      } catch (e) { /* ignore */ }

      setTimeout(() => publishSnapshot(true), 200);
      return { ok: true, count, method: 'direct+emitUpdate', fallback: payload.fallback, targetSprite: payload.targetSprite, currentSprite: payload.currentSprite };

    } catch (e) {
      console.error('[HUD Coach] applyBlocksToVM 오류:', e);
      return { ok: false, error: String(e) };
    }
  }

  let boundChangeListener = false;
  function tryBindChangeListener() {
    if (boundChangeListener) return;
    try {
      const { workspace: ws } = findBlocklyAndWorkspace();
      if (ws && typeof ws.addChangeListener === 'function') {
        ws.addChangeListener(() => {
          clearTimeout(window.__hud_snap_to);
          window.__hud_snap_to = setTimeout(() => publishSnapshot(), 300);
        });
        boundChangeListener = true;
        console.log('[HUD Coach] Blockly workspace change listener bound successfully.');
      }
    } catch (e) {
      // ignore
    }
  }

  function start() {
    const vm = findScratchVM();
    if (!vm) return;

    // Send initial snapshot
    publishSnapshot();

    // Try to bind change listener to the workspace
    tryBindChangeListener();

    // Fallback polling: just in case blockly listener misses something (e.g. variable renames)
    setInterval(() => publishSnapshot(), 1500);

    // Listen to HUD messages
    window.addEventListener("message", (ev) => {
      if (!ev.data || ev.data.source !== "scratch-hud-content") return;

      // ── 스냅샷 요청 ──────────────────────────────────────
      if (ev.data.type === "REQUEST_SNAPSHOT") {
        publishSnapshot(true);
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
        window.postMessage(
          { source: "scratch-hud", type: "APPLY_RESULT", payload: {
            ok: result.ok,
            message: result.ok ? `✅ 총 ${result.successCount}개의 스프라이트에 AI 코드가 주입되었습니다.` : undefined,
            error: result.ok ? undefined : result.errors.join(', ')
          } },
          "*"
        );
      }

      // ── 가이드 주석 전용 주입 ──────────────────────────────
      if (ev.data.type === "APPLY_COMMENTS_ONLY") {
        const result = applyCommentsOnlyToVM(ev.data.payload.commentsJson, ev.data.payload.overview, ev.data.payload.mission);
        window.postMessage(
          { source: "scratch-hud", type: "APPLY_RESULT", payload: result },
          "*"
        );
      }

      // ── 전체 스프라이트 코드 지우기 (부분 삭제 지원) ───────────
      if (ev.data.type === "CLEAR_WORKSPACE_PARTIAL") {
        const result = cleanupWorkspacePartial(ev.data.payload);
        window.postMessage(
          { source: "scratch-hud", type: "APPLY_RESULT", payload: result },
          "*"
        );
      }

      // ── 유령 주석 정리 ─────────────────────────────────────
      if (ev.data.type === "CLEANUP_ORPHANED_COMMENTS") {
        const result = cleanupOrphanedComments();
        window.postMessage(
          { source: "scratch-hud", type: "CLEANUP_RESULT", payload: result },
          "*"
        );
      }
    });
  }

  function cleanupWorkspacePartial({ clearBlocks, clearComments }) {
    const vm = findScratchVM();
    if (!vm || !vm.runtime || !vm.runtime.targets) return { ok: false, error: 'VM not found' };

    vm.runtime.targets.forEach(t => {
      // 1) 블록 삭제 처리
      if (clearBlocks) {
        if (t.blocks && t.blocks._blocks) {
          t.blocks._blocks = {};
        }
        // 주석은 지우지 않는 경우, 결합 주석들의 blockId 관계를 null로 풀어 독립 주석으로 생존시킴
        if (!clearComments && t.comments) {
          Object.values(t.comments).forEach(c => {
            if (c) {
              c.blockId = null;
            }
          });
        }
      }

      // 2) 주석 삭제 처리
      if (clearComments) {
        if (t.comments) {
          t.comments = {};
        }
      }
    });

    try {
      if (typeof vm.emitWorkspaceUpdate === 'function') {
        vm.emitWorkspaceUpdate();
      }

      // 블록과 주석 둘 다 완전히 지우는 경우에는 잔상 제거를 위해 Blockly 전체 클리어 실행
      if (clearBlocks && clearComments) {
        const { workspace: ws } = findBlocklyAndWorkspace();
        if (ws && typeof ws.clear === 'function') {
          ws.clear();
        }
      }
    } catch (e) {
      console.warn('[HUD Coach] emitWorkspaceUpdate or Blockly clear failed:', e);
    }
    
    setTimeout(() => publishSnapshot(true), 300);

    let msg = '✅ ';
    if (clearBlocks && clearComments) msg += '모든 블록 코드와 주석이 삭제되었습니다.';
    else if (clearBlocks) msg += '모든 블록 코드가 삭제되었습니다. (주석 보존)';
    else if (clearComments) msg += '모든 주석이 삭제되었습니다. (블록 코드 보존)';

    return { ok: true, message: msg };
  }

  function cleanupOrphanedComments() {
    const vm = findScratchVM();
    if (!vm || !vm.runtime || !vm.runtime.targets) return { ok: false, count: 0, error: 'VM not found' };
    
    let clearedCount = 0;
    vm.runtime.targets.forEach(t => {
      if (t.comments && Object.keys(t.comments).length > 0) {
        const blocksDict = (t.blocks && t.blocks._blocks) ? t.blocks._blocks : {};
        Object.entries(t.comments).forEach(([commentId, comment]) => {
          if (comment.blockId && !blocksDict[comment.blockId]) {
            delete t.comments[commentId];
            clearedCount++;
          }
        });
      }
    });
    
    if (clearedCount > 0) {
      try {
        if (typeof vm.emitWorkspaceUpdate === 'function') {
          vm.emitWorkspaceUpdate();
        }
      } catch (e) {}
      setTimeout(() => publishSnapshot(true), 300);
    }
    return { ok: true, count: clearedCount };
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
          const { workspace: ws, ScratchBlocks: SB } = findBlocklyAndWorkspace();
          if (ws) {
            try {
              const xmlStr = flatBlocksToXml(flatBlocks);
              let dom;
              if (SB && SB.Xml && typeof SB.Xml.textToDom === 'function') {
                dom = SB.Xml.textToDom(xmlStr);
              } else {
                const parser = new DOMParser();
                const doc = parser.parseFromString(xmlStr, "text/xml");
                dom = doc.documentElement;
              }

              let newIds = [];
              if (SB && SB.Xml && typeof SB.Xml.domToWorkspace === 'function') {
                newIds = SB.Xml.domToWorkspace(dom, ws);
              } else {
                throw new Error('domToWorkspace 함수를 찾을 수 없습니다.');
              }

              if (newIds && newIds.length > 0) {
                refreshDynamicMenus(newIds, ws);
                const topBlock = ws.getBlockById(newIds[0]);
                if (topBlock && typeof topBlock.select === 'function') topBlock.select();
              }
              successCount++;
              continue;
            } catch (e) {
              console.warn('[HUD Coach] Active sprite XML injection failed, falling back:', e);
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

    publishSnapshot(true);

    return { ok: successCount > 0, successCount, errors: errorMsgs };
  }

  function applyCommentsOnlyToVM(commentsJson, overview, mission) {
    const vm = findScratchVM();
    if (!vm || !vm.runtime || !vm.runtime.targets) return { ok: false, error: 'VM not found' };

    let successCount = 0;
    let errorMsgs = [];
    const targets = vm.runtime.targets;
    
    const targetsWithExistingGuide = [];
    let injectStage = false;
    let stageTarget = null;

    if (overview && mission) {
       stageTarget = targets.find(t => t.isStage);
       if (stageTarget) {
         injectStage = true;
         if (stageTarget.comments) {
           for (const cid of Object.keys(stageTarget.comments)) {
             if (cid.startsWith('overview_comment_')) {
               targetsWithExistingGuide.push("프로젝트 전반 가이드");
               break;
             }
           }
         }
       }
    }

    if (injectStage) {
      // 주입 차단 필터링: 최초 전체 JSON 주입 시 개별 스프라이트에는 가이드 주석이 들어가지 않도록 제어
    } else {
      for (const [targetName, commentText] of Object.entries(commentsJson)) {
      if (!commentText || typeof commentText !== 'string') continue;
      const target = targets.find(t => {
        if (t.isStage && targetName === "무대(배경)") return true;
        return t.sprite && t.sprite.name === targetName;
      });
      if (target && target.comments) {
        for (const cid of Object.keys(target.comments)) {
          if (cid.startsWith('guide_comment_')) {
            if (!targetsWithExistingGuide.includes(targetName)) {
               targetsWithExistingGuide.push(targetName);
            }
            break;
          }
        }
      }
    }
    }
    
    if (targetsWithExistingGuide.length > 0) {
      const confirmMsg = `${targetsWithExistingGuide.join(', ')}에 이미 가이드 주석이 존재합니다.\\n기존 주석을 지우고 새로 교체하시겠습니까?`;
      if (!window.confirm(confirmMsg)) {
        return { ok: false, error: '주석 덮어쓰기가 취소되었습니다.' };
      }
    }

    function cleanExistingOverviewComments(target) {
      if (!target || !target.comments) return;
      for (const cid of Object.keys(target.comments)) {
        if (cid.startsWith('overview_comment_')) {
          delete target.comments[cid];
        }
      }
    }

    function cleanExistingGuideComments(target) {
      if (!target || !target.comments) return;
      for (const cid of Object.keys(target.comments)) {
        if (cid.startsWith('guide_comment_')) {
          delete target.comments[cid];
        }
      }
    }
    
    function getDynamicPlacement(target) {
      let maxX = 50;
      let minY = 50;
      if (target.blocks && target.blocks._blocks) {
        Object.values(target.blocks._blocks).forEach(b => {
          if (b.topLevel && !b.shadow) {
            if (b.x > maxX) maxX = b.x;
          }
        });
      }
      if (target.comments) {
        Object.values(target.comments).forEach(c => {
          if (!c.id.startsWith('guide_comment_') && !c.id.startsWith('overview_comment_')) {
            const rightEdge = (c.x || 0) + (c.width || 200);
            if (rightEdge > maxX) maxX = rightEdge;
          }
        });
      }
      return { x: Math.max(400, maxX + 100), y: minY };
    }

    if (injectStage && stageTarget) {
      cleanExistingOverviewComments(stageTarget);
      
      const cleanOverview = (overview || '').replace(/\\n/g, '\n');
      const cleanMission = (mission || '').replace(/\\n/g, '\n');
      
      let masterText = `[프로젝트 개요]\n${cleanOverview}\n\n[전체 구현 단계 요약]\n`;
      for (const [tName, text] of Object.entries(commentsJson)) {
         const lines = text.split(/\r?\n|\\n/);
         let stepLine = lines[0] || '';
         let summaryLine = lines[1] && lines[1].startsWith('요약:') ? lines[1].replace('요약:', '').trim() : '';
         if (stepLine.startsWith('[')) stepLine = stepLine.substring(1, stepLine.length - 1);
         
         masterText += `- ${stepLine} (${tName}): ${summaryLine}\n`;
      }
      masterText += `\n[도전 미션]\n${cleanMission}`;
      
      const pos = getDynamicPlacement(stageTarget);
      const commentId = 'overview_comment_' + Date.now() + Math.random().toString(36).substr(2, 5);
      
      if (!stageTarget.comments) stageTarget.comments = {};
      stageTarget.comments[commentId] = {
        id: commentId,
        blockId: null, 
        x: pos.x,
        y: pos.y,
        width: 480,
        height: 350,
        minimized: false,
        text: masterText
      };
      successCount++;
    }

    if (injectStage) {
      // 주입 차단 필터링: 최초 전체 JSON 주입 시 개별 스프라이트에는 가이드 주석이 들어가지 않도록 제어
    } else {
      for (const [targetName, commentText] of Object.entries(commentsJson)) {
      if (!commentText || typeof commentText !== 'string') continue;

      const target = targets.find(t => {
        if (t.isStage && targetName === "무대(배경)") return true;
        return t.sprite && t.sprite.name === targetName;
      });

      if (!target) {
        errorMsgs.push(`스프라이트 [${targetName}]를 찾을 수 없습니다.`);
        continue;
      }
      
      if (target.isStage && injectStage) continue;

      try {
        cleanExistingGuideComments(target);
        
        const pos = getDynamicPlacement(target);
        if (!target.comments) target.comments = {};
        
        const commentId = 'guide_comment_' + Date.now() + Math.random().toString(36).substr(2, 5);
        const cleanCommentText = (commentText || '').replace(/\\n/g, '\n');
        
        target.comments[commentId] = {
          id: commentId,
          blockId: null, 
          x: pos.x,
          y: pos.y,
          width: 480,
          height: 350,
          minimized: false,
          text: cleanCommentText
        };
        successCount++;
      } catch (e) {
        errorMsgs.push(`[${targetName}] 에러: ${e.message}`);
      }
    }
    }

    try {
      if (typeof vm.emitWorkspaceUpdate === 'function') {
        vm.emitWorkspaceUpdate();
      }
    } catch (e) {}

    publishSnapshot(true);
    return { 
      ok: successCount > 0, 
      message: successCount > 0 ? `✅ 가이드 주석이 성공적으로 주입되었습니다.` : undefined,
      error: successCount > 0 ? undefined : errorMsgs.join(', ')
    };
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
