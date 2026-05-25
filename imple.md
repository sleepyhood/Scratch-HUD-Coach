# Aether HUD 디자인 시스템 구현 계획서 (Scratch HUD Coach)

본 계획서는 **Scratch HUD Coach** 크롬 익스텐션의 모든 UI 요소를 Apple의 Human Interface Guidelines(HIG) 철학에 맞추어 전면 리디자인하고, 체계적이고 관리 가능한 디자인 시스템(Aether HUD)을 구축하기 위한 실행 계획을 정의합니다.

---

## User Review Required

> [!IMPORTANT]
> **인라인 스타일 제거 및 클래스화**
> 기존 `content/hud_template.js` 및 HTML 파일들에 다수 존재하던 인라인 스타일(`style="..."`)들을 새로운 디자인 시스템 클래스로 이관합니다. 이를 통해 코드 유지보수성이 크게 향상되나, 기존 레거시 레이아웃의 레이어 순서(z-index) 및 마진 보정이 필요할 수 있습니다.
>
> **JavaScript 내부의 동적 스타일 하드코딩 충돌 방지**
> 기존 `content/content.js` 및 `popup/popup.js` 코드 내에서 상태 알림 배지, 진행률 정보, 유령 주석 배너의 색상 및 배경을 자바스크립트 인라인 스타일(`.style.background = "#dcfce7"` 등)로 직접 변경하던 지점이 다수 감지되었습니다. 
> 디자인 시스템(특히 다크 모드)과의 색상 일관성을 유지하기 위해, 자바스크립트가 직접 헥사코드를 주입하는 대신 디자인 시스템의 시맨틱 클래스(`.hud-badge-success`, `.hud-toast-error` 등)를 토글하도록 JS 코드를 함께 보완 및 리팩토링합니다.
>
> **Light/Dark Mode 대응성**
> 스크래치 에디터 사이트 자체가 Light 모드 중심이므로, 기본 HUD는 반투명 Acrylic Light 테마를 기본값으로 하되, 시스템 설정(`prefers-color-scheme`) 혹은 추후 옵션 설정을 대비하여 Dark 모드 변수도 함께 구축합니다.

---

## Open Questions

> [!NOTE]
> *현재 모든 열린 질문이 해결되었습니다. 사용자의 결정에 따라 Windows 환경에서도 끊김 없고 일관된 애플 룩앤필을 구현하기 위해 Pretendard 로컬 패키징 방식을 도입합니다.*

---

## Proposed Changes

새로운 디자인 시스템을 구축하기 위해 공통 토큰(JSON, CSS)을 생성하고 기존 UI 컴포넌트들을 이 시스템에 맞게 전면 리팩토링합니다.

---

### 1. 디자인 시스템 코어 (Foundations)

#### [NEW] [AETHER_DESIGN_SYSTEM.md](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/AETHER_DESIGN_SYSTEM.md)
- Apple HIG 기반의 색상, 타이포그래피, 그리드 스페이싱 원칙 정의.
- 30+가지 프리미엄 컴포넌트의 명세(구조, 상태, 사용 가이드, 접근성 및 코드 스펙), 패턴, Do's & Don'ts, 개발자 가이드를 총망라한 출판 가능한 레벨의 종합 디자인 가이드북.

#### [NEW] [design_tokens.json](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/resource/design_tokens.json)
- 색상(Color), 타이포그래피(Typography), 간격(Spacing), 둥근 모서리(Border Radius), 그림자(Shadow), 모션(Motion) 값을 구조화한 디자인 토큰 정의.

#### [NEW] [Pretendard 폰트 파일](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/resource/fonts)
- Windows 환경에서 최적의 한글/영문 가독성 및 자간을 일관되게 제공하고, 스크래치 사이트 내부의 CSP 제한을 우회하기 위해 `Pretendard-Regular.woff2`, `Pretendard-SemiBold.woff2`, `Pretendard-Bold.woff2` 폰트 파일을 익스텐션 내부에 탑재.

#### [NEW] [design_system.css](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/resource/design_system.css)
- `design_tokens.json`을 기반으로 한 CSS Custom Properties(`--hud-*`) 및 기본 컴포넌트(버튼, 입력 필드, 카드, 스크롤바 등)의 공통 스타일시트 작성.
- 내장 패키징된 Pretendard 폰트 파일을 `@font-face`로 정의하고, macOS 환경에서는 시스템 기본 폰트(SF Pro)가 최우선 구동되도록 하이브리드 폰트 스택 설정.
- `popup.html` 및 `options.html`에서 공통 링크하여 디자인 일관성 유지.

---

### 2. HUD 화면 구성 요소 (Content Script UI)

#### [MODIFY] [hud.css](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/content/hud.css)
- 기존 스타일을 `design_system.css` 토큰 시스템과 연동되도록 리팩토링.
- 8px 그리드 시스템에 맞춰 모든 카드 패딩, 컴포넌트 간격을 보정.
- 가로 크기 조절기(Resize Handle)와 스크롤바 스타일을 프리미엄 텍스처(Apple 느낌의 미니멀 스타일)로 개선.
- 스크래치 카테고리별(Motion, Looks, Events 등) 블록 색상 칩 명도/대비 보정.

#### [MODIFY] [hud_template.js](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/content/hud_template.js)
- HTML 템플릿 코드 내부의 인라인 스타일(`style="..."`)을 모두 디자인 시스템 클래스명(`hud-card`, `hud-select`, `hud-flex-row` 등)으로 치환.
- 탭 네비게이션, 아코디언 컴포넌트의 HTML 구조를 접근성(ARIA)을 준수하도록 태그 속성 추가.

#### [MODIFY] [content.js](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/content/content.js)
- 자바스크립트 내에서 안내 배너, 진행 바, 텍스트 라벨 등의 요소를 렌더링할 때 인라인 하드코딩 스타일(`.style.backgroundColor = "..."` 등)로 직접 조작하던 코드를 클래스 동적 토글(`.classList.add('hud-badge-success')` 등)로 교체하여 CSS와 결합성을 높이고 다크 모드 일관성 지원.
- JS가 관리하는 동적 HUD 요소를 디자인 가이드북의 scoping 규칙에 맞게 클래스 설계 유지.

---

### 3. 익스텐션 팝업 및 옵션 화면 (Extension Pages UI)

#### [MODIFY] [popup.html](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/popup/popup.html)
- `<head>` 영역에 `resource/design_system.css` 링크 추가.
- 내부 `<style>` 코드를 토큰 기반 변수로 변경 및 간소화.
- 팝업 전체 레이아웃을 `Aether Glass Card` 스타일로 개편하여 HUD와 시각적 일체감 형성.
- 프롬프트 가이드 텍스트 영역 및 토글 버튼을 애플 네이티브 컴포넌트 룩앤필로 개선.

#### [MODIFY] [popup.js](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/popup/popup.js)
- 대기 상태 배지 업데이트 시 인라인 스타일로 배경색/글자색을 하드코딩하던 로직(`badge.style.background = ...`)을 제거하고, 디자인 시스템 시맨틱 배지 클래스(`.hud-badge-success`, `.hud-badge-idle`)를 동적으로 교체하도록 코드 리팩토링.

#### [MODIFY] [options.html](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/options/options.html)
- `resource/design_system.css` 링크 추가.
- 12-Column 반응형 레이아웃 구조 기반으로 옵션 페이지 개편.
- 설정 항목들을 의미론적으로 분류한 카드 컴포넌트화.
- 셀렉트 박스(`select`), 입력창(`textarea`), 저장 버튼(`button`)에 포커스 링, 액티브 트랜지션 등 프리미엄 피드백 추가.

---

### 4. 설정 파일 및 리소스 정의 (Configuration)

#### [MODIFY] [manifest.json](file:///c:/Users/osw/Desktop/Workspace/Projects/Scratch%20HUD%20Coach/manifest.json)
- **주입 스타일시트 우선순위 적용:** `content_scripts`의 `css` 리스트에 `resource/design_system.css`를 `content/hud.css`보다 **먼저** 로드되도록 등록하여 디자인 시스템의 공통 변수(토큰)들이 HUD 컴포넌트 스타일에 안정적으로 상속(Cascading)되도록 구조화.
- **웹 리소스 권한 허용:** 패키징된 Pretendard 폰트 파일(`resource/fonts/*.woff2`) 및 `resource/design_system.css`를 `web_accessible_resources`에 등록하여 외부 도메인인 스크래치 페이지(`scratch.mit.edu`) 상에 주입되는 HUD 창에서도 도메인 보안 제약(CSP) 없이 로컬 자원에 안전하게 접근하도록 권한 부여.

---

## Verification Plan

### Automated Tests
- 크롬 익스텐션 빌드 검사: 익스텐션 로드 시 Manifest 오류나 리소스 경로 에러가 없는지 확인.
- 브라우저 콘솔 오류 체크: `page_bridge.js` 및 content scripts 주입 후 CSS/JS 로드 차단 에러(CSP) 발생 여부 체크.

### Manual Verification
1. **에디터 HUD 테스트:** 스크래치 프로젝트 에디터 페이지에 접속하여 HUD를 토글해 봅니다.
   - Glassmorphism 효과가 뒷배경(스크래치 블록 영역)과 겹쳤을 때 가독성 체크.
   - 마우스 호버, 포커스 시의 미세 애니메이션 동작 여부.
   - 라이트 모드 및 다크 모드 스타일이 정상 스위칭되는지 CSS 변수 강제 조절로 확인.
2. **팝업 및 옵션 화면 테스트:**
   - 툴바 아이콘을 클릭하여 팝업 UI를 열고 스크롤바와 버튼 반응을 확인합니다.
   - 옵션 페이지 설정창에서 폼 컨트롤의 포커스 상태(Outline ring) 및 그림자 효과를 점검합니다.
