# Skill: Scratch Code Generation (JSON Schema)

이 스킬은 사용자의 자연어 요청을 Scratch 3.0 VM이 이해할 수 있는 정규화된 트리 구조의 JSON으로 변환하는 전문 능력을 제공합니다.

## 1. JSON 구조 (Schema)
모든 출력은 반드시 아래의 계층적 배열 구조를 따라야 합니다.

```json
[
  [
    {
      "opcode": "블록_명칭",
      "inputs": {
        "입력_이름": "값_또는_중첩_블록_배열"
      },
      "fields": {
        "필드_이름": "선택된_값"
      }
    }
  ]
]
```

## 2. 주요 규칙 (Core Rules)
1. **계층 구조**: 최상위는 스크립트(블록 뭉치)의 배열입니다. 하나의 스프라이트에 여러 스크립트가 있을 수 있습니다.
2. **Opcode 명칭**: 반드시 `motion_movesteps`, `control_forever` 등 정식 Scratch 3.0 Opcode만 사용합니다.
3. **Inputs 처리**:
   - `SUBSTACK`: 루프나 조건문 내부의 블록 배열을 넣습니다.
   - `CONDITION`: 조건식 블록을 넣습니다.
   - 단순 값: `inputs: { "STEPS": 10 }`과 같이 직접 값을 할당합니다.
4. **ID 생략**: 고유 ID(UUID)는 작성하지 않습니다. 주입기(Parser)가 자동으로 생성합니다.
5. **설명 금지**: 출력 결과에는 자연어 설명 없이 오직 순수한 JSON 코드만 포함합니다.

## 3. 예시 (Examples)

### 예시 1: 초록 깃발 클릭 시 무한 반복하며 10만큼 움직이기
**요청:** "깃발 누르면 계속 앞으로 가게 해줘"
**응답:**
```json
[
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
]
```

### 예시 2: 특정 위치로 이동하고 말하기
**요청:** "중앙으로 가서 안녕이라고 말해"
**응답:**
```json
[
  [
    { "opcode": "motion_gotoxy", "inputs": { "X": 0, "Y": 0 } },
    { "opcode": "looks_say", "inputs": { "MESSAGE": "안녕!" } }
  ]
]
```

## 4. 권장 작업 흐름
1. 사용자의 요청 분석
2. 필요한 Scratch Opcode 식별
3. 논리적 순서에 따라 트리 구조 생성
4. JSON 문법 유효성 검사 후 출력
