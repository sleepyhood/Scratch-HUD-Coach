# 과제 검증 시스템 (Mission Validation System) 설계안

본 문서는 Scratch HUD Coach에 실시간으로 학생의 블록 조립 상태를 채점하고 피드백을 주기 위한 **과제 검증 시스템(Mission Validation System)**의 구체적인 아키텍처 및 구현 방식 제안서입니다.

---

## 1. 시스템 개념 (Concept)

학생이 Scratch 에디터 화면에서 블록을 조립하거나 수정하는 즉시, 확장 프로그램 내 **검증 엔진(Validation Engine)**이 조립된 블록의 계층 트리를 분석합니다. 이 구조를 미리 정의된 **과제 규격 JSON(Mission Rules JSON)**과 실시간으로 매칭하여 미션 성공/실패 여부를 판단하고 HUD에 진행 상황을 시각적으로 안내합니다.

```
[학생 블록 조립] ──> [Scratch Parser] ──> [검증 엔진] <── [과제 규칙 JSON]
                                              │
                                              └──> [실시간 피드백 HUD (🟢 / 🔴)]
```

---

## 2. 데이터 흐름 아키텍처 (Data Flow)

1. **상태 감지 (page_bridge.js)**:
   - Blockly 메인 워크스페이스의 `addChangeListener`를 통해 블록 드래그, 삭제, 값 변경, 변수 추가 등의 모든 변경을 실시간 감지(Debounce 처리 포함)합니다.
   - 변경 감지 즉시 `window.postMessage`를 통해 가공되지 않은 스냅샷(`rawBlocksByTarget`)을 콘텐츠 스크립트(`content.js`)로 전송합니다.
2. **트리 정규화 (parser.js)**:
   - `content.js`에 주입된 `ScratchParser`가 수신된 평면 데이터를 분석하여 트리 구조의 정규화된 JSON 구조로 정렬합니다.
3. **규칙 대조 검증 (content.js - Validation Engine)**:
   - 로컬 스토리지 또는 외부 API에서 로드된 **과제 규칙 JSON**을 검증 엔진에 입력합니다.
   - 학생의 정규화 트리와 규칙 트리를 비교하는 매칭 알고리즘을 수행하여 결과를 반환합니다.
4. **결과 시각화 (content.js - HUD UI)**:
   - 검증 엔진이 계산한 미션별 성공 여부(`true`/`false`)에 기반해 HUD 내 체크리스트 요소를 실시간 갱신합니다.

---

## 3. 검증 규칙 JSON 규격안 (Mission Rule Schema)

검증 규칙 JSON은 검사의 난이도를 조절할 수 있도록 단계별(체크리스트, 구조 비교, 값 비교) 필터를 포함합니다.

```json
{
  "missionId": "burger_game_step1",
  "title": "햄버거 만들기 1단계: 접시 클릭",
  "criteria": [
    {
      "id": "c1",
      "description": "접시를 클릭했을 때 동작하도록 이벤트를 만드세요.",
      "type": "STRUCTURE",
      "targetSprite": "접시",
      "rule": {
        "opcode": "event_whenthisspriteclicked",
        "next": {
          "opcode": "event_broadcast",
          "fields": {
            "BROADCAST_OPTION": "고기생성"
          }
        }
      }
    },
    {
      "id": "c2",
      "description": "불판 스프라이트가 신호를 받으면 계속 반복하도록 하세요.",
      "type": "STRUCTURE",
      "targetSprite": "불판",
      "rule": {
        "opcode": "event_whenbroadcastreceived",
        "fields": {
          "BROADCAST_OPTION": "고기생성"
        },
        "inputs": {
          "SUBSTACK": [
            {
              "opcode": "control_forever"
            }
          ]
        }
      }
    },
    {
      "id": "c3",
      "description": "초기 위치 좌표 x는 -100, y는 50으로 지정하세요.",
      "type": "VALUE_RANGE",
      "targetSprite": "불판",
      "rule": {
        "opcode": "motion_gotoxy",
        "fields": {
          "X": { "min": -110, "max": -90 },
          "Y": { "min": 40, "max": 60 }
        }
      }
    }
  ]
}
```

---

## 4. 매칭 알고리즘 설계 (Matching Algorithm)

매칭 알고리즘은 학생이 조립한 블록 트리 내부에서 규칙에 지정된 블록 구조(Subtree)가 **올바른 부모-자식 순서**로 조작해 있는지 재귀적으로 검색합니다.

### 유사 코드 (Pseudo-code)

```javascript
/**
 * 학생의 단일 블록 트리와 규칙 블록 노드를 매칭합니다.
 */
function matchBlockNode(studentNode, ruleNode) {
  if (!studentNode) return false;
  
  // 1. Opcode 대조
  if (studentNode.opcode !== ruleNode.opcode) return false;
  
  // 2. Fields 대조 (예: 특정 변수명, 신호명 등)
  if (ruleNode.fields) {
    for (const [key, expectedVal] of Object.entries(ruleNode.fields)) {
      const actualVal = studentNode.fields?.[key];
      if (typeof expectedVal === 'object' && expectedVal.min !== undefined) {
        // 값 범위 비교 (Value Range)
        const numVal = Number(actualVal);
        if (numVal < expectedVal.min || numVal > expectedVal.max) return false;
      } else {
        // 단순 값 일치 비교
        if (actualVal !== expectedVal) return false;
      }
    }
  }

  // 3. Inputs 대조 (예: SUBSTACK 루프 내부, CONDITION 조건문 내부 재귀 비교)
  if (ruleNode.inputs) {
    for (const [key, ruleChildren] of Object.entries(ruleNode.inputs)) {
      const studentChildren = studentNode.inputs?.[key];
      if (!Array.isArray(studentChildren)) return false;
      
      // 하위 배열 내에 규칙 노드들이 올바르게 조립되어 있는지 검사
      for (const ruleChild of ruleChildren) {
        let foundMatch = studentChildren.some(sc => matchBlockNode(sc, ruleChild));
        if (!foundMatch) return false; // 하나라도 만족하지 못하면 실패
      }
    }
  }

  // 4. Next 체인 대조 (순차 실행 대조)
  if (ruleNode.next) {
    // 학생 트리의 다음 실행 블록들 중 규칙에 부합하는 블록이 바로 이어지는지 대조
    return matchBlockNode(studentNode.next, ruleNode.next);
  }

  return true;
}

/**
 * 특정 스프라이트의 모든 스크립트 중 규칙 노드를 찾아 매칭하는 루트 함수
 */
function validateSpriteScript(studentScripts, ruleNode) {
  // studentScripts는 [ [BlockNode, BlockNode], [BlockNode, BlockNode] ] 2차원 시퀀스
  for (const scriptSeq of studentScripts) {
    for (const blockNode of scriptSeq) {
      // 트리 전체를 전위 순회(Pre-order Traversal)하며 검사 시작점이 매칭되는지 탐색
      if (matchBlockNode(blockNode, ruleNode)) {
        return true;
      }
    }
  }
  return false;
}
```

---

## 5. 경량 패키징을 위한 정답 JSON 배포/연동 전략 (Distribution)

확장 프로그램의 용량을 가볍게 유지하면서 수백 개의 학습 프로젝트를 검증하기 위한 3가지 로드 모델입니다.

### 전략 A. 에디터 URL/프로젝트 ID 연동 (REST API 모델)
1. 학생이 특정 스크래치 URL(`https://scratch.mit.edu/projects/12345678/editor`)로 접속합니다.
2. 확장 프로그램이 로딩 시 프로젝트 ID `12345678`을 추출합니다.
3. 원격 CDN 또는 서버(`https://api.coach-academy.com/missions/12345678.json`)로 규칙 JSON을 요청(Fetch)합니다.
4. 다운로드된 규칙을 로컬 세션에 임시 적재하여 실시간 채점기를 구동합니다.
* **장점**: 무제한에 가까운 프로젝트 수용량, 규칙 수정 시 실시간 갱신 가능.

### 전략 B. 스크래치 시작 템플릿 메타데이터 파싱 (Embedded Metadata 모델)
1. 교사가 정답 규칙 JSON을 직렬화/암호화(Base64 등)하여 템플릿 프로젝트의 **"설명(Notes & Credits)"** 영역 또는 **"내부 블록 주석(Comment)"**에 숨겨 둡니다.
2. 학생이 프로젝트를 복사(Remix)하여 작업할 때, `page_bridge.js`가 이 메타데이터를 추출해 해독합니다.
3. 별도의 외부 서버 연결 없이도 HUD가 즉석에서 맞춤형 미션 검증 모드로 자동 세팅됩니다.
* **장점**: 서버 인프라 불필요, 완벽한 오프라인 작동, 교사가 원하는 대로 자유로운 커스텀 규칙 구성 가능.

### 전략 C. 교사용 웹 도구 기반 클립보드 주입 (Instructor Dashboard 모델)
1. 교사용 관리 웹페이지에서 과제 규칙을 설계한 후 "HUD 규칙 내보내기" 버튼을 누르면 클립보드에 특수 포맷의 규칙 텍스트가 복사됩니다.
2. 교사가 옵션 페이지의 "과제 JSON" 필드에 붙여넣어 활성화합니다.
* **장점**: 학생들은 설정에 전혀 손대지 않아도 되며, 교사가 수업 현장에서 손쉽게 검증 주제를 전환할 수 있습니다.
