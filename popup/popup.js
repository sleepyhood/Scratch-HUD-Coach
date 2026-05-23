chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab) {
    const toggleBtn = document.getElementById("btn-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        chrome.tabs.sendMessage(tab.id, { type: "toggle-hud" });
        window.close();
      });
    }
  }
});

const inputJson = document.getElementById("custom-json-input");
const btnSave = document.getElementById("btn-save-custom-json");
const btnClear = document.getElementById("btn-clear-custom-json");
const badge = document.getElementById("inject-status-badge");

const btnToggleGuide = document.getElementById("btn-toggle-guide");
const guideContent = document.getElementById("guide-content");
const guideArrow = document.getElementById("guide-arrow");
const btnCopyGuide = document.getElementById("btn-copy-guide");
const aiPromptTemplate = document.getElementById("ai-prompt-template");

const originalPromptText = aiPromptTemplate.value;
let currentEnvText = "";

const elSprites = document.getElementById("detected-sprites");
const elVariables = document.getElementById("detected-variables");
const elBroadcasts = document.getElementById("detected-broadcasts");

// 상태 렌더링
function updateBadge(isPending) {
  if (isPending) {
    badge.textContent = "주입 대기 중";
    badge.style.background = "#dcfce7";
    badge.style.color = "#166534";
  } else {
    badge.textContent = "대기 없음";
    badge.style.background = "#e2e8f0";
    badge.style.color = "#64748b";
  }
}

// 초기 로딩
chrome.storage.local.get([
  "custom_inject_json", 
  "custom_inject_pending",
  "custom_sprites_list",
  "custom_variables_list",
  "custom_broadcasts_list"
], (res) => {
  if (res.custom_inject_json) {
    inputJson.value = res.custom_inject_json;
  }
  updateBadge(!!res.custom_inject_pending);

  const sprites = res.custom_sprites_list || [];
  const vars = res.custom_variables_list || [];
  const broadcasts = res.custom_broadcasts_list || [];

  if (elSprites) {
    elSprites.textContent = sprites.length > 0 ? sprites.join(", ") : "대기 중 (새로고침 필요)";
  }
  if (elVariables) {
    elVariables.textContent = vars.length > 0 ? vars.join(", ") : "없음";
  }
  if (elBroadcasts) {
    elBroadcasts.textContent = broadcasts.length > 0 ? broadcasts.join(", ") : "없음";
  }

  if (sprites.length > 0 || vars.length > 0 || broadcasts.length > 0) {
    currentEnvText = `\n\n[현재 프로젝트 환경 정보]\n`;
    currentEnvText += `- 스프라이트 목록: ${sprites.length > 0 ? sprites.join(", ") : "없음"}\n`;
    currentEnvText += `- 변수/리스트 목록: ${vars.length > 0 ? vars.join(", ") : "없음"}\n`;
    currentEnvText += `- 방송 신호 목록: ${broadcasts.length > 0 ? broadcasts.join(", ") : "없음"}\n\n`;
    currentEnvText += `주의: 위 목록에 명시된 스프라이트 이름, 변수 이름, 방송 신호만 사용해 코드를 생성하고 절대 임의의 이름을 새로 만들지 마십시오.`;
    
    aiPromptTemplate.value = originalPromptText + currentEnvText;
  }
});

// 저장 로직
btnSave.addEventListener("click", () => {
  const val = inputJson.value.trim();
  if (!val) {
    alert("JSON을 입력해주세요.");
    return;
  }
  try {
    const parsed = JSON.parse(val);
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      alert("올바른 스프라이트-스크립트 객체 형식의 JSON이 아닙니다.");
      return;
    }
    chrome.storage.local.set({
      custom_inject_json: val,
      custom_inject_pending: true
    }, () => {
      updateBadge(true);
      btnSave.textContent = "✅ 저장됨";
      setTimeout(() => btnSave.textContent = "💾 저장 및 대기", 2000);
    });
  } catch(e) {
    alert("JSON 파싱 에러: " + e.message);
  }
});

// 초기화 로직
btnClear.addEventListener("click", () => {
  chrome.storage.local.set({
    custom_inject_json: "",
    custom_inject_pending: false
  }, () => {
    inputJson.value = "";
    updateBadge(false);
  });
});

// 가이드 아코디언 토글
btnToggleGuide.addEventListener("click", () => {
  const isHidden = guideContent.style.display === "none";
  guideContent.style.display = isHidden ? "block" : "none";
  guideArrow.textContent = isHidden ? "▲" : "▼";
});

// 가이드 복사
btnCopyGuide.addEventListener("click", () => {
  aiPromptTemplate.select();
  document.execCommand("copy");
  btnCopyGuide.textContent = "✅ 복사 완료";
  setTimeout(() => btnCopyGuide.textContent = "가이드 복사", 2000);
});
