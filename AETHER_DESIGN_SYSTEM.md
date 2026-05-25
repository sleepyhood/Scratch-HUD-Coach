# AETHER HUD Design System (v1.0.0)
> **Apple HIG 기반의 프리미엄 글래스모피즘(Glassmorphism) 디자인 시스템**
>
> 본 문서는 **Scratch HUD Coach** 프로젝트(브랜드명: **AETHER HUD**)를 관통하는 통합 디자인 시스템 가이드북입니다. 본 시스템은 웹 브라우저 오버레이 인터페이스에 특화되어 있으며, Apple의 디자인 철학인 **Clarity(명확성)**, **Deference(존중)**, **Depth(시각적 깊이)**를 Windows 웹 앱 및 크롬 익스텐션 환경에 완벽하게 녹여냅니다.

---

## 1. DESIGN PRINCIPLES (디자인 원칙)

1. **Clarity (명확성)**
   - 텍스트는 어느 화면에서도 읽기 쉬워야 합니다. 최적의 자간과 행간을 적용하고, 배경과의 대비를 최소 4.5:1(WCAG AA) 이상으로 유지합니다.
2. **Deference (존중/콘텐츠 우선)**
   - HUD는 원래의 콘텐츠(스크래치 에디터)를 가리거나 방해하지 않아야 합니다. 투명도와 블러(Acrylic Blur) 효과를 사용하여 HUD 아래의 화면 흐름이 은은하게 드러나도록 제안합니다.
3. **Depth (시각적 깊이)**
   - 3차원 축(Z-index)과 미세한 내부 테두리(Inner border), 그림자(Drop Shadow)를 활용하여 레이어 간의 물리적 위계를 명확히 분리합니다.

---

## 2. FOUNDATIONS (스타일 가이드 및 기반 설계)

### 🎨 Color System (색상 체계)
AETHER 디자인 시스템은 라이트 모드와 다크 모드의 유기적인 색상 전환을 지원합니다. 모든 의미적 색상(Semantic Color)은 WCAG AA 이상 대비 기준을 충족합니다.

| 분류 | 토큰명 | Light Mode (값 / 투명도) | Dark Mode (값 / 투명도) | 용도 및 대조 가이드 |
| :--- | :--- | :--- | :--- | :--- |
| **Brand** | `--hud-color-primary` | `#5E5CE6` (Indigo) | `#5E5CE6` (Indigo) | 주 버튼, 활성 상태 강조 (대비 5.1:1) |
| **Brand** | `--hud-color-accent` | `#0A84FF` (System Blue) | `#0A84FF` (System Blue) | 서브 액션, 링크, 포커스 아웃라인 |
| **Semantic**| `--hud-color-success` | `#34C759` (System Green) | `#30D158` (System Green) | 블록 주입 성공, 정상 상태 배지 |
| **Semantic**| `--hud-color-warning` | `#FF9500` (System Orange)| `#FF9F0A` (System Orange)| 데이터 누락, 주의 문구 배지 |
| **Semantic**| `--hud-color-danger` | `#FF3B30` (System Red) | `#FF453A` (System Red) | 유령 주석 오류, 삭제 버튼 |
| **Material**| `--hud-material-bg-1` | `rgba(255, 255, 255, 0.72)` | `rgba(28, 28, 30, 0.75)` | HUD 메인 윈도우 배경 (Blur: 20px) |
| **Material**| `--hud-material-bg-2` | `rgba(255, 255, 255, 0.40)` | `rgba(44, 44, 46, 0.45)` | 내부 카드 및 아코디언 컨테이너 |
| **Material**| `--hud-border-glass` | `rgba(255, 255, 255, 0.45)` | `rgba(255, 255, 255, 0.15)` | 글래스 경계 테두리 (1px Solid) |
| **Text** | `--hud-text-label` | `#0F172A` (Slate 900) | `#FFFFFF` (White) | 중요 헤드라인, 메인 텍스트 |
| **Text** | `--hud-text-secondary`| `#475569` (Slate 600) | `#AEAEB2` (System Gray 2) | 본문 설명, 비활성 탭 텍스트 |
| **Text** | `--hud-text-tertiary` | `#94A3B8` (Slate 400) | `#636366` (System Gray 4) | 워터마크, 힌트 텍스트 |

---

### ✍️ Typography (9단계 타이포그래피 스케일)
Windows와 macOS 모두에서 미려한 렌더링을 제공하기 위해 **Pretendard(로컬 패키징)** 및 **-apple-system(SF Pro)**을 주 서체로 구성합니다.

* **Font Family Stack:** `-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif;`
* **Monospace Stack (코드용):** `"SF Mono", SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;`

| Level | Size (px) | Weight | Line Height | CSS class 예시 | 주요 용도 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Large Title** | `30px` | 800 (ExtraBold)| 1.3 | `.hud-typo-lt` | 웰컴 화면, 대형 헤더 타이틀 |
| **2. Title 1** | `22px` | 700 (Bold) | 1.35 | `.hud-typo-t1` | 설정/옵션 페이지 최상단 타이틀 |
| **3. Title 2** | `18px` | 700 (Bold) | 1.4 | `.hud-typo-t2` | 다이얼로그 모달, 섹션 대구분 |
| **4. Title 3** | `15px` | 600 (SemiBold) | 1.4 | `.hud-typo-t3` | HUD 윈도우 타이틀, 일반 카드 제목 |
| **5. Headline** | `13px` | 600 (SemiBold) | 1.45 | `.hud-typo-headline` | 아코디언 헤더, 입력창 라벨, 버튼 텍스트 |
| **6. Body** | `13px` | 400 (Regular) | 1.5 | `.hud-typo-body` | 일반 본문 줄글, 설명 영역 |
| **7. Callout** | `12px` | 500 (Medium) | 1.5 | `.hud-typo-callout` | 가이드북 요약 힌트, 주석 정보란 |
| **8. Subheadline** | `11px` | 600 (SemiBold) | 1.5 | `.hud-typo-subheadline`| 배지 텍스트, 메타데이터 정보 |
| **9. Footnote/Code**| `10.5px` | 400 (Regular) | 1.55 | `.hud-typo-footnote` | 주입 코드 프리뷰, 에러 메시지, 도움말 |

---

### 📐 Grid & Spacing System (8px Grid & 12-Column Grid)
모든 컴포넌트의 마진과 패딩은 배수가 정렬되는 **8px Grid System**을 따르며, 미세 조율이 필요한 인라인 요소는 **4px** 단위를 적용합니다.

* **Spacing Scale:**
  - `4px` (`--hud-space-xs`) : 인라인 텍스트-아이콘 간격, 미세 여백
  - `8px` (`--hud-space-sm`) : 버튼 내부 패딩, 아코디언 항목 간격
  - `12px` (`--hud-space-md`) : 일반 카드 내부 패딩, 입력 요소 간 조밀한 간격
  - `16px` (`--hud-space-lg`) : 메인 HUD 내부 패딩, 섹션 간 여백
  - `24px` (`--hud-space-xl`) : 대형 모달 패딩, 섹션 간 큰 여백
  - `32px` (`--hud-space-2xl`) : 페이지 좌우 마진
  - `48px`, `64px` (`--hud-space-3xl`, `--hud-space-4xl`) : 히어로 영역 마진
* **12-Column Layout (옵션 페이지 전용):**
  - Grid Width: `Max-width: 640px` (옵션 페이지 기준)
  - Column 개수: `12`
  - Gutter(열 간격): `16px`
  - Margin(여백): `24px`

---

## 3. DESIGN TOKENS JSON (디자인 토큰 규격)

```json
{
  "global": {
    "font-family": {
      "sans": { "value": "-apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', Roboto, sans-serif" },
      "mono": { "value": "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace" }
    }
  },
  "color": {
    "brand": {
      "primary": { "value": "#5E5CE6" },
      "accent": { "value": "#0A84FF" }
    },
    "semantic": {
      "success": { "value": "#30D158" },
      "warning": { "value": "#FF9F0A" },
      "danger": { "value": "#FF453A" }
    },
    "material": {
      "bg-window-light": { "value": "rgba(255, 255, 255, 0.72)" },
      "bg-window-dark": { "value": "rgba(28, 28, 30, 0.75)" },
      "bg-card-light": { "value": "rgba(255, 255, 255, 0.40)" },
      "bg-card-dark": { "value": "rgba(44, 44, 46, 0.45)" },
      "border-glass-light": { "value": "rgba(255, 255, 255, 0.45)" },
      "border-glass-dark": { "value": "rgba(255, 255, 255, 0.15)" }
    }
  },
  "spacing": {
    "xs": { "value": "4px" },
    "sm": { "value": "8px" },
    "md": { "value": "12px" },
    "lg": { "value": "16px" },
    "xl": { "value": "24px" }
  },
  "radius": {
    "small": { "value": "6px" },
    "medium": { "value": "10px" },
    "large": { "value": "16px" },
    "hud": { "value": "20px" },
    "circle": { "value": "9999px" }
  },
  "shadow": {
    "hud": { "value": "0 10px 30px 0 rgba(31, 38, 135, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.02), inset 0 1px 1px 0 rgba(255, 255, 255, 0.3)" },
    "card": { "value": "0 2px 8px 0 rgba(0, 0, 0, 0.04)" },
    "control-focus": { "value": "0 0 0 3px rgba(94, 92, 230, 0.25)" }
  },
  "transition": {
    "ease-out-expo": { "value": "cubic-bezier(0.16, 1, 0.3, 1)" },
    "duration-normal": { "value": "300ms" },
    "duration-fast": { "value": "150ms" }
  }
}
```

---

## 4. 30+ COMPONENT LIBRARY SPECIFICATION (35개 컴포넌트 명세)

---

### [Category 1: Containers & Layouts (컨테이너 및 구조)]

#### 1. HUD Glass Window (HUD 메인 창)
* **Anatomy:** 전체 패널을 감사며, 고대비 투명 아크릴 효과(Glassmorphism) 및 테두리가 적용된 오버레이 컨테이너.
* **States:** Open(활성화 및 슬라이드 인), Closed(숨김 및 슬라이드 아웃).
* **Accessibility:** `role="region"`, `aria-label="HUD Coach Panel"`, `tabindex="-1"`.
* **CSS Code Spec:**
  ```css
  #hud-coach-root.hud-window {
    position: fixed;
    background: var(--hud-material-bg-1);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--hud-border-glass);
    border-radius: var(--hud-radius-hud);
    box-shadow: var(--hud-shadow-hud);
    transition: transform var(--hud-transition-duration-normal) var(--hud-transition-ease-out-expo), opacity 0.3s;
  }
  ```

#### 2. Panel Header (윈도우 헤더)
* **Anatomy:** 타이틀 영역과 닫기 버튼을 감싸는 상단 바 영역. 경계 분리선 적용.
* **States:** Normal.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--hud-space-md) var(--hud-space-lg);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }
  ```

#### 3. Panel Body (스크롤 가능 본문)
* **Anatomy:** 스크롤 가능한 내부 레이아웃 영역. 패딩 존재.
* **States:** Normal, Scrolling.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-body {
    padding: var(--hud-space-lg);
    overflow-y: auto;
    max-height: calc(100vh - 160px);
  }
  ```

#### 4. Resizable Handle (크기 조절 핸들)
* **Anatomy:** HUD 좌측 혹은 우측 가장자리에 위치한 미세 터치 타겟 스트립.
* **States:** Default(투명), Hover(파란색 세로선 확장), Active(마우스 드래그 중 세로선 늘어남).
* **Accessibility:** `role="separator"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` 키보드 방향키 조절 바인딩.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-resize-handle {
    position: absolute;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
  }
  #hud-coach-root .hud-resize-handle::after {
    content: '';
    width: 2px;
    height: 32px;
    background: rgba(0,0,0,0.1);
    transition: all var(--hud-transition-duration-fast);
  }
  #hud-coach-root .hud-resize-handle:hover::after {
    background: var(--hud-color-accent);
    height: 48px;
  }
  ```

#### 5. Glass Card (글래스 카드)
* **Anatomy:** HUD 내부 섹션 구분을 위한 작은 불투명 카드 플레이트.
* **States:** Default, Hover(약간 밝아짐).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-card {
    background: var(--hud-material-bg-2);
    border: 1px solid var(--hud-border-glass);
    border-radius: var(--hud-radius-medium);
    padding: var(--hud-space-md);
    box-shadow: var(--hud-shadow-card);
  }
  ```

#### 6. Divider Line (경계 분리선)
* **Anatomy:** 섹션이나 항목 간을 구분하는 투명 대쉬 및 실선 스타일러.
* **States:** Normal.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-divider {
    border: none;
    border-top: 1px dashed rgba(0, 0, 0, 0.08);
    margin: var(--hud-space-md) 0;
  }
  ```

---

### [Category 2: Buttons & Action Controls (버튼 및 조작 제어)]

#### 7. Primary Button (주 동작 버튼)
* **Anatomy:** 단색 혹은 미세 그라디언트 채우기 처리된 고대비 텍스트 버튼.
* **States:** Default, Hover(명도 낮춰 강한 시각 인지), Active(크기 2% 축소 축 변환), Focus(외부 3px 블루 링), Disabled(불투명도 0.4).
* **Accessibility:** `role="button"`, 키보드 `Space`/`Enter` 동작.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-btn-primary {
    background: linear-gradient(135deg, var(--hud-color-primary) 0%, var(--hud-color-accent) 100%);
    color: #FFFFFF;
    border-radius: var(--hud-radius-medium);
    padding: 10px 16px;
    box-shadow: 0 4px 12px rgba(94, 92, 230, 0.25);
    transition: transform var(--hud-transition-duration-fast);
  }
  #hud-coach-root .hud-btn-primary:active { transform: scale(0.98); }
  ```

#### 8. Secondary Button (보조 버튼)
* **Anatomy:** 테두리가 있거나 은은한 은색 불투명 배경의 버튼.
* **States:** Default, Hover, Active, Focus, Disabled.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-btn-secondary {
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: var(--hud-text-label);
  }
  ```

#### 9. Destructive Button (삭제/위험 동작 버튼)
* **Anatomy:** 주석 전체 초기화, 삭제 등 불가역 동작 경고를 위한 레드 계열 버튼.
* **States:** Default, Hover, Active, Focus, Disabled.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-btn-danger {
    background: linear-gradient(135deg, var(--hud-color-danger) 0%, #E02B20 100%);
    color: #FFFFFF;
  }
  ```

#### 10. Ghost Button (텍스트 전용 버튼)
* **Anatomy:** 배경색이 없다가 마우스 포커싱/호버링 시 투명 백그라운드가 옅게 나타나는 버튼.
* **States:** Default(투명), Hover(배경 투명 회색), Active, Focus.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-btn-ghost {
    background: transparent;
    color: var(--hud-color-accent);
  }
  #hud-coach-root .hud-btn-ghost:hover { background: rgba(0, 0, 0, 0.04); }
  ```

#### 11. Icon Button (아이콘 버튼)
* **Anatomy:** 텍스트 없이 단일 이모지 혹은 SVG 벡터 그래픽만 중앙 정렬된 버튼. 닫기 기호 등.
* **States:** Default, Hover(회색 둥근 배경 피드백), Active, Focus.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-btn-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--hud-radius-circle);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  ```

#### 12. Segmented Control Tab (탭 그룹 감싸기)
* **Anatomy:** 전체 가로 영역을 고르게 분배하는 세그먼트 박스 트랙.
* **States:** Normal.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-segmented-tabs {
    display: flex;
    background: rgba(0, 0, 0, 0.04);
    border-radius: var(--hud-radius-medium);
    padding: 2px;
  }
  ```

#### 13. Tab Option Item (탭 내부 개별 항목)
* **Anatomy:** 슬라이더 형태로 활성화된 항목만 흰색 카드 플레이트로 입체 표기되는 탭 아이템.
* **States:** Active(흰색 배경 + 섀도우), Inactive(텍스트 회색 + 투명 배경).
* **Accessibility:** `role="tab"`, `aria-selected="true"`, `aria-controls="tabpanel-id"`.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-tab-item {
    flex: 1;
    text-align: center;
    padding: 6px 12px;
    border-radius: var(--hud-radius-small);
    transition: all var(--hud-transition-duration-fast);
  }
  #hud-coach-root .hud-tab-item.active {
    background: #FFFFFF;
    box-shadow: var(--hud-shadow-card);
    color: var(--hud-color-primary);
  }
  ```

---

### [Category 3: Form Elements & Fields (폼 컨트롤 및 입력창)]

#### 14. Text Field (단일 라인 입력창)
* **Anatomy:** 이름, 텍스트 등을 입력받는 둥근 외곽선 입력 요소.
* **States:** Default, Hover, Focus(테두리 파란색 변경 및 아웃라인 섀도우 링), Disabled.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: var(--hud-radius-medium);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  #hud-coach-root .hud-input:focus {
    border-color: var(--hud-color-primary);
    box-shadow: var(--hud-shadow-control-focus);
  }
  ```

#### 15. Textarea (멀티 라인 텍스트 영역)
* **Anatomy:** 긴 가이드북 JSON이나 프롬프트를 처리하기 위한 크기 조절형 대형 상자.
* **States:** Default, Hover, Focus, Disabled, ReadOnly(스크롤바 간소화, 배경색 옅어짐).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-textarea {
    width: 100%;
    min-height: 100px;
    font-family: var(--hud-font-family-mono);
    resize: vertical;
  }
  ```

#### 16. Custom Dropdown Select (셀렉트 박스)
* **Anatomy:** 난이도, 스타일 선택을 위한 스크롤 목록 트리거 드롭다운. 화살표 커스텀 SVG 처리.
* **States:** Default, Hover, Open/Focus, Disabled.
* **Accessibility:** `role="combobox"`, `aria-expanded="false"`.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-select {
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,...");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }
  ```

#### 17. Apple Toggle Switch (토글 스위치)
* **Anatomy:** 미끄러지며 스위칭되는 알약 형태 트랙 + 화이트 노브 원판.
* **States:** Checked(배경 초록색 혹은 파란색), Unchecked(배경 회색), Disabled.
* **Accessibility:** `role="switch"`, `aria-checked="true"`.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-switch-track {
    width: 38px;
    height: 22px;
    border-radius: var(--hud-radius-circle);
    background: #E5E5EA;
    position: relative;
    cursor: pointer;
  }
  #hud-coach-root .hud-switch-nob {
    width: 18px;
    height: 18px;
    border-radius: var(--hud-radius-circle);
    background: #FFFFFF;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform var(--hud-transition-duration-fast);
  }
  #hud-coach-root .hud-switch-track.checked { background: var(--hud-color-success); }
  #hud-coach-root .hud-switch-track.checked .hud-switch-nob { transform: translateX(16px); }
  ```

#### 18. Custom Checkbox (체크박스)
* **Anatomy:** 사각형 외곽선 박스 + 내부 체크(V) 기호 스케일.
* **States:** Default, Checked, Hover, Active, Disabled.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    accent-color: var(--hud-color-primary);
  }
  ```

#### 19. Custom Radio Button (라디오 버튼)
* **Anatomy:** 원형 플레이트 + 가운데 원형 인디케이터 도트.
* **States:** Checked, Unchecked, Disabled.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-radio {
    width: 16px;
    height: 16px;
    border-radius: var(--hud-radius-circle);
  }
  ```

#### 20. Slider Range (범위 조절기)
* **Anatomy:** 미세 간격을 조절하는 수평 트랙 바 + 원형 노브.
* **States:** Normal, Active Dragging.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-slider {
    width: 100%;
    accent-color: var(--hud-color-primary);
  }
  ```

---

### [Category 4: Feedback & Dynamic Banners (피드백 및 알림)]

#### 21. Toast Notification Banner (토스트 알림 배너)
* **Anatomy:** HUD 화면 상단에 팝다운 방식으로 제공되는 공지 메시지 바. 텍스트 본문과 닫기 버튼으로 구성.
* **States:** Success(초록 배경), Error(빨간 배경), Info(파란 배경), Show/Hide.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-toast-banner {
    position: absolute;
    top: 16px; left: 16px; right: 16px;
    padding: var(--hud-space-md);
    border-radius: var(--hud-radius-medium);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.05);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex; gap: 8px;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.3s, transform 0.3s;
  }
  #hud-coach-root .hud-toast-banner.show { opacity: 1; transform: translateY(0); }
  #hud-coach-root .hud-toast-banner.success { background: rgba(220, 252, 231, 0.85); color: #166534; border-color: rgba(34, 197, 94, 0.4); }
  #hud-coach-root .hud-toast-banner-content { flex: 1; }
  #hud-coach-root .hud-toast-banner-close { background: none; border: none; cursor: pointer; opacity: 0.6; }
  ```

#### 22. Status Badge (상태 배지)
* **Anatomy:** 스프라이트 체크리스트 옆에 인젝트 완료/누락 여부를 표기하는 미세 도약 알약 배지.
* **States:** Injected (초록 OKLCH 대비), Missing (푸른 모노톤 OKLCH 대비).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-status-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  #hud-coach-root .hud-status-badge.injected {
    background-color: oklch(0.95 0.03 140);
    color: oklch(0.35 0.12 140);
    border: 1px solid oklch(0.85 0.06 140);
  }
  #hud-coach-root .hud-status-badge.missing {
    background-color: oklch(0.95 0.005 250);
    color: oklch(0.50 0.01 250);
    border: 1px solid oklch(0.85 0.01 250);
  }
  ```

#### 23. Inline Alert Box (인라인 알림 박스 / 안내 배너)
* **Anatomy:** 환경 분석 결과 및 안내 지침을 보여주는 박스. `#hud-prompt-guide-banner` 등에 바인딩.
* **States:** Success(Greenish), Info(Indigo-blueish).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-alert-box {
    border-radius: var(--hud-radius-medium);
    padding: var(--hud-space-md);
    border: 1px solid rgba(0,0,0,0.05);
  }
  #hud-coach-root .hud-alert-box.success { background: rgba(220, 252, 231, 0.85); color: #166534; }
  #hud-coach-root .hud-alert-box.info { background: rgba(224, 231, 255, 0.85); color: #3730a3; }
  ```

#### 24. Circular Loader / Spinner (회전 로딩 원)
* **Anatomy:** AI 프롬프트 생성 시 무한 대기를 회전 원 그래픽으로 표시.
* **States:** Active(360도 무한 회전 루프), Inactive(숨김).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(0,0,0,0.1);
    border-top-color: var(--hud-color-primary);
    border-radius: var(--hud-radius-circle);
    animation: hud-spin 0.8s linear infinite;
  }
  @keyframes hud-spin {
    to { transform: rotate(360deg); }
  }
  ```

#### 25. Horizontal Progress Bar (진행률 표시 바)
* **Anatomy:** 주석 주입률(예: 4/12 완료)을 시각적으로 바 형태로 채워가는 슬라이드 트랙.
* **States:** Progressing, Completed.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-progress-bar-track {
    width: 100%;
    height: 6px;
    background: rgba(0,0,0,0.06);
    border-radius: var(--hud-radius-circle);
  }
  #hud-coach-root .hud-progress-bar-fill {
    height: 100%;
    background: var(--hud-color-success);
    border-radius: var(--hud-radius-circle);
    transition: width 0.3s ease;
  }
  ```

#### 26. Dynamic Tooltip (도움말 말풍선)
* **Anatomy:** 아이콘 위에 호버하면 흐릿한 투명 검정 배경으로 나타나는 도움말 박스.
* **States:** Hover Show, Hidden.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-tooltip {
    position: absolute;
    background: rgba(0,0,0,0.8);
    color: #FFFFFF;
    font-size: var(--hud-typo-footnote);
    padding: 4px 8px;
    border-radius: 4px;
    z-index: 1001;
  }
  ```

---

### [Category 5: Navigation & Menus (내비게이션 및 메뉴)]

#### 27. Accordion Trigger (아코디언 토글 머리)
* **Anatomy:** 단계별 설명란 제목 바 + 방향 지시 화살표(▼ / ▲).
* **States:** Collapsed, Expanded(화살표가 회전 반전 트랜지션 처리됨).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-accordion-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
  }
  #hud-coach-root .hud-accordion-arrow {
    transition: transform var(--hud-transition-duration-fast);
  }
  #hud-coach-root .hud-accordion-trigger.expanded .hud-accordion-arrow {
    transform: rotate(180deg);
  }
  ```

#### 28. Accordion Panel Content (아코디언 본문 접힘 상자)
* **Anatomy:** 아코디언이 열리면 노출되는 카드 내 하단 영역.
* **States:** Collapsed(height 0, overflow hidden), Expanded(부드러운 최대높이 확장).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-accordion-panel {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s var(--hud-transition-ease-out-expo);
  }
  #hud-coach-root .hud-accordion-panel.open {
    max-height: 200px;
  }
  ```

---

### [Category 6: Special Scratch Components (특화 컴포넌트)]

#### 29. Scratch Mini-Block Chip (스크래치 미니 블록 칩)
* **Anatomy:** 스크래치 고유 블록 형태를 본뜬 모서리가 둥근 인라인 칩. 카테고리 색상 적용.
* **States:** Motion(Blue), Looks(Purple), Control(Yellow-Orange) 등 카테고리별 분기.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .scratch-mini-block {
    display: inline-flex;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: var(--hud-typo-footnote);
    font-weight: bold;
    color: #FFFFFF;
    box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15);
  }
  #hud-coach-root .scratch-mini-block.motion { background-color: #4C97FF; }
  #hud-coach-root .scratch-mini-block.control { background-color: #FFAB19; }
  ```

#### 30. Code Editor Block View (코드 에디터 블록 뷰)
* **Anatomy:** 주입할 JSON 코드 블록들을 들여쓰기와 라인 단위로 읽기 쉽게 출력하는 테두리 가로 고정 뷰어.
* **States:** Normal.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-code-view {
    font-family: var(--hud-font-family-mono);
    font-size: var(--hud-typo-footnote);
    background: rgba(0,0,0,0.03);
    border-radius: var(--hud-radius-medium);
    overflow-x: auto;
    white-space: pre-wrap;
  }
  ```

#### 31. Dialog Modal (중요 팝업창)
* **Anatomy:** 화면 전체를 흐릿하게 덮는 암막 뒷배경(Backdrop) + 중앙 독립 윈도우.
* **States:** Open(Fade/Scale-up), Closed.
* **CSS Code Spec:**
  ```css
  .hud-modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center; justify-content: center;
  }
  ```

#### 32. Custom Scrollbar (스크롤 트랙 및 손잡이)
* **Anatomy:** 브라우저 스크롤 바를 얇게 감추고 둥근 반투명 손잡이로 치환.
* **States:** Default(회색 반투명), Hover(진한 투명).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-scroll::-webkit-scrollbar {
    width: 6px;
  }
  #hud-coach-root .hud-scroll::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.12);
    border-radius: var(--hud-radius-circle);
  }
  #hud-coach-root .hud-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
  }
  ```

#### 33. Sprite Checklist Grid Row (체크리스트 그리드 열) [NEW]
* **Anatomy:** 스프라이트 개별 대상 복사 선택 체크박스와 라벨, 주입 상태 배지가 배치되는 수평 플렉스 행 컴포넌트.
* **States:** Normal, Hover(배경 흰색 불투명도 증가 및 부드러운 전환).
* **CSS Code Spec:**
  ```css
  #hud-coach-root .hud-sprite-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--hud-space-xs) var(--hud-space-sm);
    margin-bottom: var(--hud-space-xs);
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.6);
    transition: background-color 200ms var(--hud-transition-ease-out-expo);
  }
  #hud-coach-root .hud-sprite-row:hover { background-color: rgba(255, 255, 255, 0.85); }
  #hud-coach-root .hud-sprite-row-left { display: flex; align-items: center; gap: var(--hud-space-sm); flex: 1; min-width: 0; }
  #hud-coach-root .hud-sprite-row-label { font-size: 11px; font-weight: 600; color: #334155; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #hud-coach-root .hud-sprite-row-checkbox { cursor: pointer; width: 14px; height: 14px; margin: 0; }
  ```

#### 34. Injector Block List Item (주입 블록 리스트 카드) [NEW]
* **Anatomy:** AI가 추천한 블록 조입 제안 항목들을 나열하는 카드형 항목.
* **States:** Default, Hover.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .injector-block-item {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 6px 8px;
    transition: background 0.2s, box-shadow 0.2s;
  }
  #hud-coach-root .injector-block-item:hover { background: rgba(255, 255, 255, 0.8); box-shadow: var(--hud-shadow-card); }
  ```

#### 35. Injector Action Button (블록 주입 액션 버튼) [NEW]
* **Anatomy:** 블록 추천 리스트 옆에 즉각 배치하여 개별 주입을 수행하는 동작 컨트롤.
* **States:** Default, Hover, Active.
* **CSS Code Spec:**
  ```css
  #hud-coach-root .injector-btn {
    background: #F8FAFC;
    border: 1px solid #CBD5E1;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
  }
  #hud-coach-root .injector-btn:hover { background: #E2E8F0; color: #0F172A; }
  ```

---

## 5. DESIGN DO'S & DON'TS (디자인 준수 및 예외 사항)

### 👍 Do's
1. **유리 아크릴 불투명도 유지:** HUD 카드 컨테이너 배경에 절대 불투명 단색(`rgb`)을 바로 대입하지 마세요. 항상 `rgba` 투명도와 `backdrop-filter: blur(...)`를 결합하여 후방 레이어와 상호작용하도록 제안합니다.
2. **둥근 모서리 일관성 준수:** HUD 바깥 윈도우 프레임은 `20px`, 내장 조작 카드는 `10px`, 버튼 및 개별 필드는 `8px`로 둥근 모서리 위계를 엄격히 계층화해 일체감을 만듭니다.
3. **접근성 아웃라인 활성화:** 키보드로 조작하는 학생 사용자를 위해 모든 폼 필드와 버튼에는 `focus-visible` 설정 시 확실한 블루 외곽 링(`--hud-shadow-control-focus`)을 시인 가능하도록 렌더링해야 합니다.

### 👎 Don'ts
1. **원색 100% 사용 자제:** 알림 문구 등에서 쌩빨강(`#FF0000`)이나 쌩초록(`#00FF00`)을 그대로 노출하지 마세요. 반드시 보정된 Semantic 토큰(`--hud-color-success`, `--hud-color-danger`)을 사용해 눈의 피로를 최소화합니다.
2. **인라인 스타일 작성 금지:** 모든 신규 컴포넌트는 오직 디자인 토큰 CSS 속성을 상속받는 전용 클래스를 선언하여 유지 관리해야 합니다. HTML 엘리먼트에 직접 `style`을 하드코딩하지 않습니다.

---

## 6. DEVELOPER GUIDE (개발자 가이드)

### 1. 디자인 토큰 및 폰트 파일 배포 트리 구조
```text
Scratch HUD Coach/
├── manifest.json
├── resource/
│   ├── design_tokens.json
│   ├── design_system.css
│   └── fonts/
│       ├── Pretendard-Regular.woff2
│       ├── Pretendard-SemiBold.woff2
│       └── Pretendard-Bold.woff2
├── content/
│   ├── hud.css
│   └── hud_template.js
├── popup/
│   └── popup.html
└── options/
    └── options.html
```

### 2. manifest.json 선언 및 등록 규칙
로컬 폰트 자원에 대한 외부 탭 접근 허용 및 주입 스타일시트 선언은 아래 규칙을 준수해야 합니다.

* **인젝션 스타일 순서:** `content_scripts.css` 선언 시 공통 변수가 담긴 `resource/design_system.css`를 `content/hud.css`보다 **먼저** 배치해야 Cascading이 성립합니다.
* **웹 리소스 허용:** `resource/fonts/*.woff2` 및 `resource/design_system.css`를 `web_accessible_resources`에 필수 등록합니다.

```json
"content_scripts": [
  {
    "matches": ["https://scratch.mit.edu/projects/*/editor*", "https://scratch.mit.edu/projects/create*"],
    "css": [
      "resource/design_system.css",
      "content/hud.css"
    ],
    "js": [...]
  }
],
"web_accessible_resources": [
  {
    "resources": [
      "resource/fonts/*.woff2",
      "resource/design_system.css"
    ],
    "matches": [
      "https://scratch.mit.edu/*"
    ]
  }
]
```

### 3. CSS 적용 및 연동 예시

> [!WARNING]
> **스크래치 에디터 스타일 오염 경고 (Strict Scoping)**
> 주입되는 스타일시트(`design_system.css`, `hud.css`) 내부에서 글로벌 태그 셀렉터(예: `body`, `button`, `select`, `textarea`)를 직접 꾸미면 스크래치 자체 UI가 붕괴됩니다. 모든 글로벌 태그 스타일은 반드시 `#hud-coach-root` 등 주입된 루트 아이디 하위로 스코프를 한정해야 합니다.
> * 예: `button { ... }` (X) -> `#hud-coach-root button, .hud-btn-primary { ... }` (O)

> [!NOTE]
> **디자인 토큰 수동 동기화**
> 브라우저는 `design_tokens.json`을 직접 해석할 수 없습니다. 따라서 본 JSON은 디자인 원천 데이터로 사용하며, 변경 사항이 있을 시 `design_system.css` 내의 `:root` CSS Custom Properties에 수동(혹은 빌드 스크립트를 통해)으로 미러링해 주어야 합니다.

```css
/* 폰트 로컬 정의 (상대 경로 지정)
   - CSS 파일의 위치(resource/) 기준 상대경로로 지정하면 
     인젝션 환경과 로컬 확장 페이지 모두에서 브라우저가 경로를 정확히 환산합니다. */
@font-face {
  font-family: 'Pretendard';
  src: url('./fonts/Pretendard-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Pretendard';
  src: url('./fonts/Pretendard-SemiBold.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Pretendard';
  src: url('./fonts/Pretendard-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

/* 토큰 가져오기 및 초기화 (반드시 주입 영역 스코프로 분리 선언 권장) */
:root {
  --hud-color-primary: #5E5CE6;
  --hud-color-accent: #0A84FF;
  --hud-material-bg-1: rgba(255, 255, 255, 0.72);
  --hud-border-glass: rgba(255, 255, 255, 0.45);
  
  --hud-space-sm: 8px;
  --hud-space-md: 12px;
  --hud-radius-medium: 10px;
  --hud-transition-duration-fast: 150ms;
  --hud-transition-ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
}

/* 컴포넌트 실제 CSS 바인딩 예시 (Scoped) */
#hud-coach-root .hud-card-item {
  background: var(--hud-material-bg-1);
  border: 1px solid var(--hud-border-glass);
  padding: var(--hud-space-md);
  border-radius: var(--hud-radius-medium);
  transition: transform var(--hud-transition-duration-fast) var(--hud-transition-ease-out-expo);
}
```
