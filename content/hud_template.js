// content/hud_template.js
(function () {
  window.HUD_HTML_TEMPLATE = `
    <div id="hud-coach-header">
      <div id="hud-coach-title">Scratch HUD Coach</div>
      <button class="hud-close-btn" id="btn-hud-close" title="HUD 닫기">&times;</button>
    </div>
    <div id="hud-tab-nav">
      <button class="hud-tab-btn active" data-tab="guidebook">📋 가이드북</button>
      <button class="hud-tab-btn" data-tab="injector">⚡ 블록 주입기</button>
    </div>
    <div id="hud-coach-body">

      <!-- Tab 1: 가이드북 생성기 -->
      <div id="hud-tab-content-guidebook" class="hud-tab-content active">

      <div class="hud-section" style="margin-top: 4px;">
        <h4 id="hud-step1-header" style="cursor: pointer; display: flex; justify-content: space-between; margin: 0 0 8px;">
          <span>🔍 1단계: 원본 JSON (사전형)</span>
          <span id="hud-step1-arrow">▼</span>
        </h4>
        <div class="hud-card" id="hud-step1-content" style="display: none;">
          <textarea id="live-json-view" readonly placeholder="현재 화면에 배치된 스크래치 블록의 원본 구조"></textarea>
        </div>
      </div>

      <div class="hud-section">
        <h4 id="hud-step2-header" style="cursor: pointer; display: flex; justify-content: space-between; margin: 0 0 8px;">
          <span>⚡ 2단계: 정규화 파싱(배열형)</span>
          <span id="hud-step2-arrow">▼</span>
        </h4>
        <div class="hud-card" id="hud-step2-content" style="display: none;">
          <textarea id="live-parsed-view" readonly placeholder="정규화된 논리적 시퀀스 및 주석(comment)이 나타납니다."></textarea>
        </div>
      </div>

      <div class="hud-section">
        <h4 style="color: #4f46e5;">
          <span>📝 3단계: AI 주석 가이드 생성기</span>
        </h4>
        <div class="hud-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.06);">
            <span style="font-size: 12px; font-weight: 600; color: #475569;">가이드북 난이도</span>
            <select id="hud-comment-level-select" class="hud-select">
              <option value="basic">기초 단계 (직접 지시)</option>
              <option value="advanced">심화 단계 (간접 미션)</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.06);">
            <span style="font-size: 12px; font-weight: 600; color: #475569;">가이드북 스타일</span>
            <select id="hud-comment-style-select" class="hud-select">
              <option value="text">텍스트 리스트 (기본형)</option>
              <option value="pseudoblock">유사 블록 구조 (시각화형)</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div id="hud-sprite-selection-container" style="background: #f1f5f9; padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1;">
              <div style="font-size:11px; font-weight:bold; margin-bottom:6px; color:#334155;">🎯 프롬프트 생성 대상 선택</div>
              <div id="hud-prompt-guide-banner" style="font-size:10px; padding:6px; border-radius:4px; margin-bottom:6px; line-height:1.4; font-weight:500;"></div>
              <div id="hud-sprite-checklist" style="display: flex; flex-direction: column; gap: 4px; max-height: 100px; overflow-y: auto;">
                <label style="font-size:11px; color:#475569; display:flex; align-items:center; gap:4px; font-weight:bold;">
                  <input type="checkbox" id="hud-cb-stage-overview" value="STAGE_AND_OVERVIEW" checked disabled style="accent-color:#6366f1;">
                  무대(배경) 및 개요 (기본 포함)
                </label>
                <div id="hud-sprite-checklist-placeholder" style="font-size:10px; color:#ef4444; margin-top:4px; padding-left: 4px;">
                  ⚠️ 무대에 가이드 주석이 먼저 주입되어야 개별 스프라이트 선택이 가능해집니다.
                </div>
              </div>
            </div>
            
            <button class="ai-btn ai-btn-primary" id="btn-copy-prompt">
              📋 AI 프롬프트 복사
            </button>
            <button class="ai-btn" id="btn-generate-guide" style="background: transparent; border: 1px solid #cbd5e1; color: #64748b; font-weight: 500; font-size: 11px;">
              🚀 로컬 주석 가이드 생성 및 복사
            </button>
          </div>
          <div id="ai-status"></div>
        </div>
      </div>

      <div class="hud-section" style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h4 style="color: #4f46e5; margin: 0;">⚡ AI 생성 주석 주입 및 내보내기</h4>
        </div>
        <div class="hud-card" style="padding: 12px;">
          <textarea id="hud-guide-json-input" placeholder="AI가 생성한 주석 JSON 스키마를 여기에 붙여넣으세요..." style="width: 100%; height: 120px; font-size: 10px; font-family: monospace; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; outline: none; resize: vertical; box-sizing: border-box; margin-bottom: 4px;"></textarea>
          <div style="display: flex; gap: 8px; margin-top: 8px;">
            <button class="ai-btn" id="btn-hud-guide-inject" style="flex: 1; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
              🚀 주석 주입
            </button>
            <button class="ai-btn" id="btn-hud-guide-text-copy" style="flex: 1; background: #3b82f6; color: white; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
              📋 텍스트 복사
            </button>
          </div>
          
          <div id="hud-guide-progress-container" style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; display: none;">
            <div style="font-size:11px; font-weight:bold; color:#1e293b; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
              <span>📊 주석 주입 진행 상황</span>
              <span id="hud-guide-progress-status" style="font-size:10px; color:#64748b;">0/0 완료</span>
            </div>
            <div id="hud-guide-progress-list" style="display:flex; flex-direction:column; gap:4px; max-height:120px; overflow-y:auto; font-size:11px; color:#475569;">
            </div>
          </div>
        </div>
      </div>

      <div class="hud-section" style="margin-top: 8px;">
        <h4 style="color: #e11d48; margin-bottom: 8px;">🗑️ 워크스페이스 관리 도구</h4>
        <div class="hud-card" style="padding: 12px; background: #fff1f2; border: 1px solid #fecdd3;">
          <button class="ai-btn" id="btn-hud-clear-comments-only" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; width: 100%; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            🗑️ 가이드 주석만 지우기
          </button>
        </div>
      </div>

      </div> <!-- end of hud-tab-content-guidebook -->

      <!-- Tab 2: 블록 주입기 -->
      <div id="hud-tab-content-injector" class="hud-tab-content">

        <div class="hud-section" style="margin-top: 4px; border: 2px solid #6366f1; background: #eef2ff;">
          <h4 style="color: #4338ca; display: flex; justify-content: space-between; align-items: center; margin: 0;">
            <span>🤖 AI 프롬프트 가이드 (실시간 환경 연동)</span>
          </h4>
          <div style="margin-top: 12px;">
            <div id="btn-toggle-hud-ai-guide" style="font-size:11px; color:#475569; margin-bottom:6px; line-height:1.5; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.5); padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1;">
              <span>📄 가이드 텍스트 보기</span>
              <span id="hud-ai-guide-arrow">▼</span>
            </div>
            <div id="hud-ai-guide-content" style="display: none;">
              <textarea id="hud-ai-prompt-preview" readonly style="width: 100%; height: 160px; font-size: 10px; font-family: monospace; background: rgba(255,255,255,0.8); border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; outline: none; resize: vertical; box-sizing: border-box;"></textarea>
            </div>
            
            <div style="margin-top:6px; display:flex; align-items:center; gap:6px; padding:4px 0;">
              <input type="checkbox" id="hud-cb-include-comments" style="cursor:pointer; width:14px; height:14px; accent-color:#6366f1;">
              <label for="hud-cb-include-comments" style="font-size:11px; color:#475569; cursor:pointer; user-select:none; line-height:1.4;">
                📝 프로젝트 내 주석(구현 지침) 포함
              </label>
            </div>
            <div id="hud-ghost-cleanup-container" style="margin-top:6px; display:none; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:6px; background:#fff1f2; border:1px solid #fecdd3;">
              <span style="font-size:11px; color:#be123c; display:flex; align-items:center; gap:4px;">
                ⚠️ 유령 주석 <strong id="hud-ghost-count">0</strong>개 감지됨 <span id="hud-ghost-targets" style="font-size: 10px; font-weight: normal;"></span>
              </span>
              <button id="hud-btn-clean-ghost" style="padding:4px 8px; font-size:10px; border-radius:4px; background:#e11d48; color:white; border:none; cursor:pointer; font-weight:bold;">
                정리하기
              </button>
            </div>
            <div style="margin-top:8px;">
              <button class="ai-btn" id="btn-hud-copy-ai-prompt" style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; width: 100%; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
                📋 가이드 전체 복사
              </button>
            </div>
          </div>
        </div>

        <div class="hud-section" style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h4 style="color: #4f46e5; margin: 0;">⚡ AI 생성 JSON 즉시 주입</h4>
            <button id="btn-hud-format-json" style="background: none; border: 1px solid #4f46e5; color: #4f46e5; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;">🧹 포맷 정리</button>
          </div>
          <div class="hud-card" style="padding: 12px;">
            <textarea id="hud-custom-json-input" placeholder="AI가 생성한 JSON 스키마를 여기에 붙여넣으세요..." style="width: 100%; height: 120px; font-size: 10px; font-family: monospace; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; outline: none; resize: vertical; box-sizing: border-box; margin-bottom: 4px;"></textarea>
            <div id="hud-json-validation-msg" style="color: #ef4444; font-size: 10px; display: none; margin-bottom: 8px; word-break: break-all;"></div>
            <button class="ai-btn" id="btn-hud-instant-inject" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 100%; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer;">
              🚀 즉시 주입하기
            </button>
          </div>
        </div>

        <div class="hud-section" style="margin-top: 8px;">
          <h4 style="color: #e11d48; margin-bottom: 8px;">🗑️ 워크스페이스 관리 도구</h4>
          <div class="hud-card" style="padding: 12px; background: #fff1f2; border: 1px solid #fecdd3;">
            <div style="display: flex; gap: 12px; justify-content: center; margin-bottom: 10px; border-bottom: 1px dashed rgba(225, 29, 72, 0.2); padding-bottom: 8px;">
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #9f1239; cursor: pointer; user-select: none;">
                <input type="checkbox" id="hud-clear-blocks-cb" checked style="cursor: pointer; width: 13px; height: 13px; accent-color: #ef4444;">
                🧩 블록 삭제
              </label>
              <label style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #9f1239; cursor: pointer; user-select: none;">
                <input type="checkbox" id="hud-clear-comments-cb" checked style="cursor: pointer; width: 13px; height: 13px; accent-color: #ef4444;">
                📝 주석 삭제
              </label>
            </div>
            <button class="ai-btn" id="btn-hud-clear-workspace" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; width: 100%; padding: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              🗑️ 선택한 요소 지우기
            </button>
            <div id="hud-clear-warning-desc" style="font-size: 9.5px; color: #be123c; margin-top: 6px; text-align: center; line-height: 1.4;">
              선택한 요소가 모든 스프라이트에서 영구 삭제됩니다.
            </div>
          </div>
        </div>
      </div>

    </div>
  `;
})();
