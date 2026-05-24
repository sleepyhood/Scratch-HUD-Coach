// content/parser.js
class ScratchParser {
  constructor(blocksDict, commentsDict) {
    this.blocks = blocksDict || {};
    this.comments = commentsDict || {};
    
    this.commentsByBlock = {};
    for (const [id, comment] of Object.entries(this.comments)) {
      if (comment.blockId) {
        this.commentsByBlock[comment.blockId] = comment;
      }
    }
  }

  // =========================================================
  // [정파서(Forward Parser)] Scratch 평면 딕셔너리 → 계층 JSON
  // =========================================================

  // 1. 최상위 블록(스크립트 시작점) 찾기
  getTopLevelBlocks() {
    return Object.keys(this.blocks).filter(id => {
      const block = this.blocks[id];
      // topLevel 속성은 boolean 값이며, 그림자(shadow) 블록은 무시합니다.
      return block.topLevel === true && !block.shadow;
    });
  }

  // 2. 특정 최상위 블록부터 next를 따라가며 스크립트 흐름을 배열 형태로 재구성
  traverseScript(startBlockId) {
    const sequence = [];
    let currentId = startBlockId;
    const visited = new Set();

    while (currentId) {
      if (visited.has(currentId)) {
        console.warn(`[HUD Coach Parser] Circular reference detected in script chain at block: ${currentId}`);
        break; // Circular reference protection
      }
      visited.add(currentId);

      const block = this.blocks[currentId];
      if (!block) break;

      const normalizedBlock = this.normalizeBlock(block);
      if (normalizedBlock) {
        sequence.push(normalizedBlock);
      }

      currentId = block.next;
    }

    return sequence;
  }

  // 3. 단일 블록의 입력(inputs) 및 필드(fields) 정규화
  normalizeBlock(block, visited = new Set()) {
    if (!block || !block.opcode) return null;

    // 순환 참조 방지
    const blockRef = block.id || block;
    if (visited.has(blockRef)) {
      console.warn(`[HUD Coach Parser] Circular input block reference detected: ${blockRef}`);
      return { opcode: block.opcode, error: "Circular reference" };
    }
    const nextVisited = new Set(visited);
    nextVisited.add(blockRef);

    const norm = {
      opcode: block.opcode
    };

    const associatedComment = this.commentsByBlock[block.id];
    if (associatedComment) {
      norm.comment = associatedComment.text;
    }

    // 필드 파싱 (예: 변수 이름, 드롭다운 값 등)
    if (block.fields && Object.keys(block.fields).length > 0) {
      norm.fields = {};
      for (const [key, obj] of Object.entries(block.fields)) {
        // VM의 fields 구조는 { name, value, id } 형태이므로 value를 추출합니다.
        norm.fields[key] = (obj && obj.value !== undefined) ? obj.value : obj;
      }
    }

    // 입력 파싱 (예: SUBSTACK, 숫자 입력 블록 연결 등)
    if (block.inputs && Object.keys(block.inputs).length > 0) {
      norm.inputs = {};
      for (const [key, inputObj] of Object.entries(block.inputs)) {
        if (!inputObj) continue;
        
        // inputObj는 자체적인 블록 ID를 가리킵니다. (안 보이거나 가려진 shadow 블록 포함)
        const payloadId = inputObj.block || inputObj.shadow;

        if (typeof payloadId === 'string' && this.blocks[payloadId]) {
          if (key.includes('SUBSTACK') || key.includes('CONDITION')) {
            // 루프나 조건문 내부 스크립트(C자형 블록 내부)인 경우, 재귀적으로 순회
            norm.inputs[key] = this.traverseScript(payloadId);
          } else {
            // 단순 값 반환 블록이나 단일 연산자 블록인 경우
            const nested = this.normalizeBlock(this.blocks[payloadId], nextVisited);
            if (nested) {
              norm.inputs[key] = nested;
            }
          }
        } else {
           // 값 자체가 배열이거나 원시값일 경우 (안전망)
           norm.inputs[key] = payloadId;
        }
      }
    }

    return norm;
  }

  // 4. 프로젝트 내 모든 스크립트 추출 및 정규화
  parseAllScripts() {
    const topLevelIds = this.getTopLevelBlocks();
    const scripts = [];

    for (const id of topLevelIds) {
      scripts.push(this.traverseScript(id));
    }

    // 구조화된 스크립트 2차원 배열 형태로 반환
    return scripts;
  }

  // =========================================================
  // [역파서(Inverse Parser)] 계층 JSON → Scratch 평면 딕셔너리
  // =========================================================

  /**
   * 단순 UUID v4 생성기 (crypto.randomUUID 미지원 환경 대비)
   */
  static generateId() {
    try {
      return crypto.randomUUID();
    } catch (_) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  }

  /**
   * 단일 값(숫자 또는 문자열)을 Scratch 그림자 블록으로 래핑합니다.
   * @param {string|number} value - 래핑할 원시값
   * @param {Object} flatBlocks   - 출력 블록 딕셔너리 (in-place 수정)
   * @param {string} parentId     - 이 그림자의 부모 블록 ID
   * @returns {string} 새로 생성된 그림자 블록 ID
   */
  static _wrapShadow(value, flatBlocks, parentId, inputKey, parentOpcode) {
    const id = ScratchParser.generateId();
    const safeVal = (value !== null && value !== undefined) ? String(value) : '';
    
    // 색상 코드 감지 규칙
    const isColorPattern = (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value));
    const isColorInput = (
      inputKey === 'TOUCHINGCOLOR' || 
      inputKey === 'COLOR' || 
      inputKey === 'COLOR2'
    );
    
    const fields = {};
    let opcode = '';
    
    if (isColorPattern || isColorInput) {
      opcode = 'colour_picker';
      fields['COLOUR'] = { name: 'COLOUR', value: safeVal };
    } else {
      const isNumber = (
        typeof value === 'number' ||
        (typeof value === 'string' && !isNaN(value) && value.trim() !== '')
      );
      if (isNumber) {
        opcode = 'math_number';
        fields['NUM'] = { name: 'NUM', value: safeVal };
      } else {
        opcode = 'text';
        fields['TEXT'] = { name: 'TEXT', value: safeVal };
      }
    }
    
    flatBlocks[id] = {
      id,
      opcode,
      next: null,
      parent: parentId,
      inputs: {},
      fields,
      shadow: true,
      topLevel: false,
    };
    return id;
  }

  /**
   * inputs 딕셔너리를 평면화합니다.
   * 값이 배열(SUBSTACK)이면 재귀 직렬화, 객체면 단일 블록, 원시값이면 그림자 래핑.
   */
  static _processInputs(inputsObj, parentId, flatBlocks) {
    if (!inputsObj) return;
    const parentOpcode = flatBlocks[parentId] ? flatBlocks[parentId].opcode : '';

    for (const [key, val] of Object.entries(inputsObj)) {
      if (val === null || val === undefined) continue;

      if (Array.isArray(val)) {
        // SUBSTACK / 중첩 스크립트: 재귀 직렬화 후 첫 번째 블록 ID 연결
        const childIds = ScratchParser._deparseSequence(val, flatBlocks, null);
        if (childIds.length > 0) {
          flatBlocks[parentId].inputs[key] = { shadow: null, block: childIds[0] };
          // 첫 번째 자식의 parent를 현재 블록으로 설정
          flatBlocks[childIds[0]].parent = parentId;
        }
      } else if (typeof val === 'object' && val !== null && val.opcode) {
        // 단일 중첩 블록 (리포터/연산자 등)
        const childIds = ScratchParser._deparseSequence([val], flatBlocks, parentId);
        if (childIds.length > 0) {
          flatBlocks[parentId].inputs[key] = { shadow: null, block: childIds[0] };
        }
      } else {
        // 원시값 → 그림자 블록으로 래핑
        const shadowId = ScratchParser._wrapShadow(val, flatBlocks, parentId, key, parentOpcode);
        flatBlocks[parentId].inputs[key] = { shadow: shadowId, block: shadowId };
      }
    }
  }

  /**
   * 블록 배열(시퀀스)을 평면화하고 next/parent 포인터를 연결합니다.
   * @param {Array}  sequence   - 계층 블록 배열
   * @param {Object} flatBlocks - 출력 딕셔너리 (in-place 수정)
   * @param {string|null} parentId - 이 시퀀스 전체의 부모 ID (null = top-level)
   * @returns {string[]} 생성된 블록 ID 배열 (순서 보존)
   */
  static _deparseSequence(sequence, flatBlocks, parentId) {
    const ids = [];

    for (const blockDef of sequence) {
      if (!blockDef || !blockDef.opcode) continue;
      const healedBlockDef = ScratchParser._healBlock(blockDef);
      const id = ScratchParser.generateId();
      ids.push(id);

      // 기본 블록 골격
      flatBlocks[id] = {
        id,
        opcode: healedBlockDef.opcode,
        next: null,
        parent: parentId,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: false, // 나중에 최상위 블록만 true로 교체
        x: 0,
        y: 0,
      };

      // comment 처리
      if (healedBlockDef.comment) {
        flatBlocks[id].comment = healedBlockDef.comment;
      }

      // fields 처리
      if (healedBlockDef.fields) {
        for (const [fKey, fVal] of Object.entries(healedBlockDef.fields)) {
          if (typeof fVal === 'object' && fVal !== null) {
            flatBlocks[id].fields[fKey] = fVal; // 이미 VM 포맷
          } else {
            flatBlocks[id].fields[fKey] = { name: fKey, value: String(fVal) };
          }
        }
      }

      // inputs 처리 (재귀)
      if (healedBlockDef.inputs) {
        ScratchParser._processInputs(healedBlockDef.inputs, id, flatBlocks);
      }
    }

    // next / parent 포인터 연결
    for (let i = 0; i < ids.length; i++) {
      if (i + 1 < ids.length) {
        flatBlocks[ids[i]].next = ids[i + 1];
        flatBlocks[ids[i + 1]].parent = ids[i];
      }
    }

    return ids;
  }

  /**
   * 계층형 스크립트 배열 → Scratch 평면 블록 딕셔너리
   *
   * 입력 형식 (scripts): Array of scripts, 각 script는 블록 배열.
   * [
   *   [ { opcode: 'event_whenflagclicked' }, { opcode: 'motion_movesteps', inputs: { STEPS: 10 } } ],
   *   [
   *     {
   *       opcode: 'control_forever',
   *       inputs: {
   *         SUBSTACK: [{ opcode: 'motion_movesteps', inputs: { STEPS: 10 } }]
   *       }
   *     }
   *   ]
   * ]
   *
   * @param {Array} scripts - 계층적 블록 스크립트 배열
   * @param {{ x?: number, y?: number, yGap?: number }} options
   * @returns {Object} Scratch VM 호환 평면 블록 딕셔너리
   */
  static deparse(scripts, options = {}) {
    const flatBlocks = {};
    const baseX = options.x !== undefined ? options.x : 80;
    const baseY = options.y !== undefined ? options.y : 80;
    const yGap  = options.yGap !== undefined ? options.yGap : 220;

    let scriptsArray = scripts;
    if (!Array.isArray(scriptsArray)) {
      if (scriptsArray && typeof scriptsArray === 'object') {
        scriptsArray = [scriptsArray];
      } else {
        return {};
      }
    }

    scriptsArray.forEach((script, scriptIndex) => {
      // script는 배열일 수도, 단일 객체(next 필드 포함)일 수도 있음
      let sequence = Array.isArray(script) ? script : [script];

      // next 필드를 사용하는 중첩 구조를 배열로 평탄화
      sequence = ScratchParser._flattenNextChain(sequence);

      const ids = ScratchParser._deparseSequence(sequence, flatBlocks, null);
      if (ids.length > 0) {
        const topId = ids[0];
        flatBlocks[topId].topLevel = true;
        flatBlocks[topId].parent = null;
        flatBlocks[topId].x = baseX;
        flatBlocks[topId].y = baseY + scriptIndex * yGap;
      }
    });

    return flatBlocks;
  }

  /**
   * `next` 필드 방식의 중첩 구조를 단순 배열로 변환합니다.
   * { opcode: '...', next: [{...}, ...] } → [{opcode:'...'}, {...}, ...]
   */
  static _flattenNextChain(sequence) {
    const result = [];
    for (const block of sequence) {
      if (!block) continue;
      const { next, ...rest } = block;
      result.push(rest);
      if (next && Array.isArray(next) && next.length > 0) {
        result.push(...ScratchParser._flattenNextChain(next));
      }
    }
    return result;
  }

  /**
   * AI 생성 JSON 유효성 검사.
   * @param {any} parsed - JSON.parse 결과
   * @returns {{ ok: boolean, error?: string }}
   */
  static validate(parsed) {
    if (!Array.isArray(parsed)) {
      return { ok: false, error: '최상위가 배열이어야 합니다. (스크립트 목록)' };
    }
    for (let si = 0; si < parsed.length; si++) {
      const script = parsed[si];
      const sequence = Array.isArray(script) ? script : [script];
      for (let bi = 0; bi < sequence.length; bi++) {
        const b = sequence[bi];
        if (!b || typeof b !== 'object') {
          return { ok: false, error: `스크립트 ${si}, 블록 ${bi}: 객체여야 합니다.` };
        }
        if (typeof b.opcode !== 'string' || !b.opcode.trim()) {
          return { ok: false, error: `스크립트 ${si}, 블록 ${bi}: "opcode" 문자열 필드가 필요합니다.` };
        }
      }
    }
    return { ok: true };
  }

  static _healBlock(blockDef) {
    if (!blockDef || !blockDef.opcode) return blockDef;

    // Shallow copy blockDef to avoid mutating original source if cached
    const healed = {
      ...blockDef,
      inputs: blockDef.inputs ? { ...blockDef.inputs } : {},
      fields: blockDef.fields ? { ...blockDef.fields } : {}
    };

    const menuRules = {
      'sensing_of': {
        inputName: 'OBJECT',
        menuOpcode: 'sensing_of_object_menu',
        menuField: 'OBJECT'
      },
      'sensing_touchingobject': {
        inputName: 'TOUCHINGOBJECTMENU',
        menuOpcode: 'sensing_touchingobjectmenu',
        menuField: 'TOUCHINGOBJECTMENU'
      },
      'sensing_distanceto': {
        inputName: 'DISTANCETOMENU',
        menuOpcode: 'sensing_distancetomenu',
        menuField: 'DISTANCETOMENU'
      },
      'control_create_clone_of': {
        inputName: 'CLONE_OPTION',
        menuOpcode: 'control_create_clone_of_menu',
        menuField: 'CLONE_OPTION'
      },
      'looks_switchcostumeto': {
        inputName: 'COSTUME',
        menuOpcode: 'looks_costume',
        menuField: 'COSTUME'
      },
      'looks_switchbackdropto': {
        inputName: 'BACKDROP',
        menuOpcode: 'looks_backdrops',
        menuField: 'BACKDROP'
      },
      'sound_play': {
        inputName: 'SOUND_MENU',
        menuOpcode: 'sound_sounds_menu',
        menuField: 'SOUND_MENU'
      },
      'sound_playuntildone': {
        inputName: 'SOUND_MENU',
        menuOpcode: 'sound_sounds_menu',
        menuField: 'SOUND_MENU'
      },
      'event_broadcast': {
        inputName: 'BROADCAST_INPUT',
        menuOpcode: 'event_broadcast_menu',
        menuField: 'BROADCAST_OPTION'
      },
      'event_broadcastandwait': {
        inputName: 'BROADCAST_INPUT',
        menuOpcode: 'event_broadcast_menu',
        menuField: 'BROADCAST_OPTION'
      }
    };

    const rule = menuRules[healed.opcode];
    if (rule) {
      // 1. Check if the value was mistakenly placed in fields
      let rawValue = null;
      if (healed.fields[rule.inputName] !== undefined) {
        rawValue = healed.fields[rule.inputName];
        delete healed.fields[rule.inputName];
      } else if (healed.fields[rule.menuField] !== undefined) {
        rawValue = healed.fields[rule.menuField];
        delete healed.fields[rule.menuField];
      }

      // 2. Check if the value was placed directly as a primitive in inputs
      if (rawValue === null && healed.inputs[rule.inputName] !== undefined) {
        const inputVal = healed.inputs[rule.inputName];
        if (typeof inputVal === 'string' || typeof inputVal === 'number') {
          rawValue = inputVal;
        }
      }

      // If we found a raw value that needs to be nested in a menu block
      if (rawValue !== null) {
        healed.inputs[rule.inputName] = {
          opcode: rule.menuOpcode,
          fields: {
            [rule.menuField]: String(rawValue)
          }
        };
      }
    }

    // Recursively heal blocks inside inputs (SUBSTACKs and nested condition blocks)
    for (const [key, val] of Object.entries(healed.inputs)) {
      if (Array.isArray(val)) {
        // SUBSTACK / block sequence: map recursively
        healed.inputs[key] = val.map(b => ScratchParser._healBlock(b));
      } else if (typeof val === 'object' && val !== null && val.opcode) {
        // Nested block object: heal recursively
        healed.inputs[key] = ScratchParser._healBlock(val);
      }
    }

    return healed;
  }
}

// 스크래치 3.0 공식 지원 Opcode 목록 (Set 상수)
ScratchParser.OFFICIAL_OPCODES = new Set([
  // 동작 (motion)
  "motion_movesteps", "motion_turnright", "motion_turnleft", "motion_goto", "motion_gotoxy",
  "motion_glideto", "motion_glidesecstoxy", "motion_pointindirection", "motion_pointtowards",
  "motion_changexby", "motion_setx", "motion_changeyby", "motion_sety",
  "motion_ifonedgebounce", "motion_setrotationstyle", "motion_xposition", "motion_yposition", "motion_direction",

  // 형태 (looks)
  "looks_sayforsecs", "looks_say", "looks_thinkforsecs", "looks_think",
  "looks_show", "looks_hide", "looks_switchcostumeto", "looks_nextcostume",
  "looks_switchbackdropto", "looks_nextbackdrop", "looks_changesizeby", "looks_setsizeto",
  "looks_changeeffectby", "looks_seteffectto", "looks_clearentheffects",
  "looks_goforwardbackwardlayers", "looks_gotofrontback", "looks_costumenumbername",
  "looks_backdropnumbername", "looks_size",

  // 소리 (sound)
  "sound_playuntildone", "sound_play", "sound_stopallsounds",
  "sound_changeeffectby", "sound_seteffectto", "sound_cleareffects",
  "sound_changevolumeby", "sound_setvolumeto", "sound_volume",

  // 이벤트 (event)
  "event_whenflagclicked", "event_whenkeypressed", "event_whenthisspriteclicked",
  "event_whenbackdropswitchesto", "event_whengreaterthan", "event_whenbroadcastreceived",
  "event_broadcast", "event_broadcastandwait",

  // 제어 (control)
  "control_wait", "control_repeat", "control_forever", "control_if", "control_if_else",
  "control_wait_until", "control_repeat_until", "control_stop",
  "control_start_as_clone", "control_create_clone_of", "control_delete_this_clone",

  // 감지 (sensing)
  "sensing_touchingobject", "sensing_touchingcolor", "sensing_coloristouchingcolor",
  "sensing_distanceto", "sensing_askandwait", "sensing_answer",
  "sensing_keypressed", "sensing_mousedown", "sensing_mousex", "sensing_mousey",
  "sensing_loudness", "sensing_timer", "sensing_resettimer", "sensing_of",
  "sensing_current", "sensing_dayssince2000", "sensing_username",

  // 연산 (operator)
  "operator_add", "operator_subtract", "operator_multiply", "operator_divide",
  "operator_random", "operator_gt", "operator_lt", "operator_equals",
  "operator_and", "operator_or", "operator_not", "operator_join",
  "operator_letter_of", "operator_length", "operator_contains",
  "operator_mod", "operator_round", "operator_mathop",

  // 변수/리스트 (data)
  "data_variable", "data_setvariableto", "data_changevariableby", "data_showvariable", "data_hidevariable",
  "data_listcontents", "data_addtolist", "data_deleteoflist", "data_deletealloflist", "data_insertatlist",
  "data_replaceitemoflist", "data_itemoflist", "data_itemnumoflist", "data_lengthoflist",
  "data_listcontainsitem", "data_showlist", "data_hidelist",

  // 내블록 (procedures)
  "procedures_definition", "procedures_call", "procedures_prototype",

  // 펜 (pen)
  "pen_clear", "pen_stamp", "pen_penDown", "pen_penUp",
  "pen_setPenColorToColor", "pen_changePenSizeBy", "pen_setPenSizeTo",
  "pen_changePenShadeBy", "pen_setPenShadeToNumber", "pen_changePenColorBy",
  "pen_setPenColorToNumber", "pen_changePenHueBy", "pen_setPenHueToNumber",
  "pen_setPenColorToColor", "pen_changePenBrightnessBy", "pen_setPenBrightnessToNumber",
  "pen_changePenSaturationBy", "pen_setPenSaturationToNumber",

  // 서브 메뉴 블록들 (shadow 블록)
  "event_broadcast_menu", "control_create_clone_of_menu", "looks_costume", "looks_backdrops",
  "sound_sounds_menu", "sensing_touchingobjectmenu", "sensing_distancetomenu",
  "sensing_of_object_menu", "pen_menu_colorParam", "math_number", "text", "math_integer",
  "math_whole_number", "math_positive_number", "math_angle", "note"
]);

// 주입 전 정밀 에러/경고 화이트리스트 사전 검사기
ScratchParser.validateStrict = function (parsedJson, envData) {
  const errors = [];
  const warnings = [];

  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    return { ok: false, errors: ['올바른 JSON 객체 형식이 아닙니다.'], warnings: [] };
  }

  const sprites = envData && Array.isArray(envData.sprites) ? envData.sprites : [];
  const variables = envData && Array.isArray(envData.variables) ? envData.variables : [];
  const broadcasts = envData && Array.isArray(envData.broadcasts) ? envData.broadcasts : [];

  for (const [targetName, scripts] of Object.entries(parsedJson)) {
    // 1. 대상 스프라이트가 현재 프로젝트에 있는지 검사
    const targetExists = sprites.includes(targetName) || targetName === "무대(배경)" || targetName === "Stage";
    if (!targetExists) {
      errors.push(`존재하지 않는 스프라이트 대상 [${targetName}]이 지정되었습니다.`);
      continue;
    }

    if (!Array.isArray(scripts)) {
      errors.push(`[${targetName}]의 스크립트는 배열 형식이어야 합니다.`);
      continue;
    }

    scripts.forEach((script, scriptIdx) => {
      const sequence = Array.isArray(script) ? script : [script];
      
      sequence.forEach((block, blockIdx) => {
        if (!block || typeof block !== 'object') {
          errors.push(`스프라이트 [${targetName}] -> ${scriptIdx}번째 스크립트 -> ${blockIdx}번째 요소: 올바른 블록 객체가 아닙니다.`);
          return;
        }
        if (!block.opcode) {
          errors.push(`스프라이트 [${targetName}] -> ${scriptIdx}번째 스크립트 -> ${blockIdx}번째 요소: "opcode"가 정의되어 있지 않습니다.`);
          return;
        }

        const opcode = block.opcode;
        // 2. Opcode의 화이트리스트 존재 검사
        if (!ScratchParser.OFFICIAL_OPCODES.has(opcode)) {
          errors.push(`지원하지 않는 블록 opcode [${opcode}]이(가) 감지되었습니다. (스프라이트: [${targetName}], 스크립트: ${scriptIdx})`);
        }

        // 3. 변수/신호 존재 확인 (경고 레벨)
        if (opcode === "data_setvariableto" || opcode === "data_changevariableby" || opcode === "data_showvariable" || opcode === "data_hidevariable") {
          const varName = block.fields && block.fields.VARIABLE;
          if (varName) {
            const varStr = (typeof varName === 'object') ? (varName.value || '') : String(varName);
            if (varStr && !variables.includes(varStr)) {
              warnings.push(`프로젝트에 존재하지 않는 변수 [${varStr}]을(를) 사용하고 있습니다. (스프라이트: [${targetName}])`);
            }
          }
        }
        if (opcode.startsWith("data_") && (opcode.includes("list") || opcode.includes("oflist"))) {
          const listName = block.fields && block.fields.LIST;
          if (listName) {
            const listStr = (typeof listName === 'object') ? (listName.value || '') : String(listName);
            const listKey = listStr + " (리스트)";
            if (listStr && !variables.includes(listStr) && !variables.includes(listKey)) {
              warnings.push(`프로젝트에 존재하지 않는 리스트 [${listStr}]을(를) 사용하고 있습니다. (스프라이트: [${targetName}])`);
            }
          }
        }
        if (opcode === "event_whenbroadcastreceived") {
          const bName = block.fields && block.fields.BROADCAST_OPTION;
          if (bName) {
            const bStr = (typeof bName === 'object') ? (bName.value || '') : String(bName);
            if (bStr && !broadcasts.includes(bStr)) {
              warnings.push(`프로젝트에 존재하지 않는 방송 신호 [${bStr}]을(를) 수신하고 있습니다. (스프라이트: [${targetName}])`);
            }
          }
        }
        if (opcode === "event_broadcast" || opcode === "event_broadcastandwait") {
          const inputVal = block.inputs && block.inputs.BROADCAST_INPUT;
          let bStr = "";
          if (typeof inputVal === 'string') {
            bStr = inputVal;
          } else if (inputVal && typeof inputVal === 'object') {
            if (inputVal.opcode === "event_broadcast_menu" && inputVal.fields) {
              const bOption = inputVal.fields.BROADCAST_OPTION;
              bStr = (typeof bOption === 'object') ? (bOption.value || '') : String(bOption);
            } else if (inputVal.fields && inputVal.fields.BROADCAST_OPTION) {
              const bOption = inputVal.fields.BROADCAST_OPTION;
              bStr = (typeof bOption === 'object') ? (bOption.value || '') : String(bOption);
            }
          }
          if (bStr && !broadcasts.includes(bStr)) {
            warnings.push(`프로젝트에 존재하지 않는 방송 신호 [${bStr}]을(를) 전송하고 있습니다. (스프라이트: [${targetName}])`);
          }
        }

        // 4. 감지 블록의 스프라이트 타겟 존재 검사
        if (opcode === "sensing_of") {
          let objStr = "";
          const inputVal = block.inputs && block.inputs.OBJECT;
          if (typeof inputVal === 'string') {
            objStr = inputVal;
          } else if (inputVal && typeof inputVal === 'object') {
            if (inputVal.opcode === "sensing_of_object_menu" && inputVal.fields) {
              const bObj = inputVal.fields.OBJECT;
              objStr = (typeof bObj === 'object') ? (bObj.value || '') : String(bObj);
            } else if (inputVal.fields && inputVal.fields.OBJECT) {
              const bObj = inputVal.fields.OBJECT;
              objStr = (typeof bObj === 'object') ? (bObj.value || '') : String(bObj);
            }
          } else if (block.fields && block.fields.OBJECT) {
            const bObj = block.fields.OBJECT;
            objStr = (typeof bObj === 'object') ? (bObj.value || '') : String(bObj);
          }
          
          if (objStr) {
            const objExists = sprites.includes(objStr) || objStr === "_stage_" || objStr === "Stage" || objStr === "무대(배경)";
            if (!objExists) {
              errors.push(`[의 x좌표/y좌표/크기...] 감지 블록의 대상 스프라이트 [${objStr}]이(가) 프로젝트에 존재하지 않습니다.`);
            }
          }
        }

        if (opcode === "sensing_touchingobject") {
          let objStr = "";
          const inputVal = block.inputs && block.inputs.TOUCHINGOBJECTMENU;
          if (typeof inputVal === 'string') {
            objStr = inputVal;
          } else if (inputVal && typeof inputVal === 'object') {
            if (inputVal.opcode === "sensing_touchingobjectmenu" && inputVal.fields) {
              const bObj = inputVal.fields.TOUCHINGOBJECTMENU;
              objStr = (typeof bObj === 'object') ? (bObj.value || '') : String(bObj);
            } else if (inputVal.fields && inputVal.fields.TOUCHINGOBJECTMENU) {
              const bObj = inputVal.fields.TOUCHINGOBJECTMENU;
              objStr = (typeof bObj === 'object') ? (bObj.value || '') : String(bObj);
            }
          }
          if (objStr) {
            const specialTargets = ["_mouse_", "_edge_", "_any_", "Stage", "무대(배경)"];
            const objExists = sprites.includes(objStr) || specialTargets.includes(objStr);
            if (!objExists) {
              errors.push(`[~에 닿았는가] 감지 블록의 대상 스프라이트 [${objStr}]이(가) 프로젝트에 존재하지 않습니다.`);
            }
          }
        }

        // C자 블록 내부 검사 헬퍼
        const checkSubStack = (substackVal) => {
          if (Array.isArray(substackVal)) {
            substackVal.forEach(subBlock => {
              const res = ScratchParser.validateStrict({ [targetName]: [[subBlock]] }, envData);
              errors.push(...res.errors);
              warnings.push(...res.warnings);
            });
          }
        };

        if (block.inputs) {
          Object.values(block.inputs).forEach(inVal => {
            if (Array.isArray(inVal)) {
              checkSubStack(inVal);
            } else if (typeof inVal === 'object' && inVal !== null) {
              if (inVal.opcode) {
                const res = ScratchParser.validateStrict({ [targetName]: [[inVal]] }, envData);
                errors.push(...res.errors);
                warnings.push(...res.warnings);
              } else if (Array.isArray(inVal.SUBSTACK)) {
                checkSubStack(inVal.SUBSTACK);
              } else if (Array.isArray(inVal.SUBSTACK2)) {
                checkSubStack(inVal.SUBSTACK2);
              }
            }
          });
        }

      });
    });
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)]
  };
};

// 명시적으로 전역(window) 환경에 부착하여 content.js에서 사용할 수 있도록 합니다.
window.ScratchParser = ScratchParser;
