// content/parser.js
class ScratchParser {
  constructor(blocksDict) {
    this.blocks = blocksDict || {};
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

    while (currentId) {
      const block = this.blocks[currentId];
      if (!block) break;

      const normalizedBlock = this.normalizeBlock(block);
      sequence.push(normalizedBlock);

      currentId = block.next;
    }

    return sequence;
  }

  // 3. 단일 블록의 입력(inputs) 및 필드(fields) 정규화
  normalizeBlock(block) {
    const norm = {
      opcode: block.opcode
    };

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
            norm.inputs[key] = this.normalizeBlock(this.blocks[payloadId]);
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
  static _wrapShadow(value, flatBlocks, parentId) {
    const id = ScratchParser.generateId();
    const isNumber = (
      typeof value === 'number' ||
      (typeof value === 'string' && !isNaN(value) && value.trim() !== '')
    );
    const fields = {};
    if (isNumber) {
      fields['NUM'] = { name: 'NUM', value: String(value) };
    } else {
      fields['TEXT'] = { name: 'TEXT', value: String(value) };
    }
    flatBlocks[id] = {
      id,
      opcode: isNumber ? 'math_number' : 'text',
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
        const shadowId = ScratchParser._wrapShadow(val, flatBlocks, parentId);
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
      const id = ScratchParser.generateId();
      ids.push(id);

      // 기본 블록 골격
      flatBlocks[id] = {
        id,
        opcode: blockDef.opcode,
        next: null,
        parent: parentId,
        inputs: {},
        fields: {},
        shadow: false,
        topLevel: false, // 나중에 최상위 블록만 true로 교체
        x: 0,
        y: 0,
      };

      // fields 처리
      if (blockDef.fields) {
        for (const [fKey, fVal] of Object.entries(blockDef.fields)) {
          if (typeof fVal === 'object' && fVal !== null) {
            flatBlocks[id].fields[fKey] = fVal; // 이미 VM 포맷
          } else {
            flatBlocks[id].fields[fKey] = { name: fKey, value: String(fVal) };
          }
        }
      }

      // inputs 처리 (재귀)
      if (blockDef.inputs) {
        ScratchParser._processInputs(blockDef.inputs, id, flatBlocks);
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

    scripts.forEach((script, scriptIndex) => {
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
}

// 명시적으로 전역(window) 환경에 부착하여 content.js에서 사용할 수 있도록 합니다.
window.ScratchParser = ScratchParser;
