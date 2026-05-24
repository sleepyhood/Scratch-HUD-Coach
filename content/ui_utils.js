// content/ui_utils.js
(function () {
  class HUDUiUtils {
    // 1. 드래그 이동 플로팅 버튼 초기화
    static initDraggableFAB(toggleBtn, onBtnClickCallback) {
      let isDragging = false;
      let dragStartX = 0, dragStartY = 0;
      let fabStartX = 0, fabStartY = 0;

      // 이전 위치 복원
      chrome.storage.local.get(['hud_btn_pos'], (res) => {
        if (res && res.hud_btn_pos) {
          toggleBtn.style.top = res.hud_btn_pos.top + 'px';
          toggleBtn.style.left = res.hud_btn_pos.left + 'px';
          toggleBtn.style.right = 'auto';
        }
      });

      toggleBtn.addEventListener('mousedown', (e) => {
        isDragging = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = toggleBtn.getBoundingClientRect();
        fabStartX = rect.left;
        fabStartY = rect.top;

        const onMouseMove = (moveEvent) => {
          const dx = moveEvent.clientX - dragStartX;
          const dy = moveEvent.clientY - dragStartY;
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
          }
          if (isDragging) {
            toggleBtn.style.left = (fabStartX + dx) + 'px';
            toggleBtn.style.top = (fabStartY + dy) + 'px';
            toggleBtn.style.right = 'auto';
          }
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          if (isDragging) {
            chrome.storage.local.set({
              hud_btn_pos: {
                top: parseInt(toggleBtn.style.top),
                left: parseInt(toggleBtn.style.left)
              }
            });
          }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      // 클릭 이벤트 핸들러 바인딩 (드래그 시 작동 방지)
      toggleBtn.addEventListener('click', (e) => {
        if (isDragging) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof onBtnClickCallback === 'function') {
          onBtnClickCallback();
        }
      });
    }

    // 2. 아코디언 접기/펼치기 제어
    static initAccordions(root) {
      const step1Header = root.querySelector('#hud-step1-header');
      const step1Content = root.querySelector('#hud-step1-content');
      const step1Arrow = root.querySelector('#hud-step1-arrow');
      if (step1Header && step1Content && step1Arrow) {
        step1Header.addEventListener('click', () => {
          const isHidden = step1Content.style.display === "none";
          step1Content.style.display = isHidden ? "block" : "none";
          step1Arrow.textContent = isHidden ? "▲" : "▼";
        });
      }

      const step2Header = root.querySelector('#hud-step2-header');
      const step2Content = root.querySelector('#hud-step2-content');
      const step2Arrow = root.querySelector('#hud-step2-arrow');
      if (step2Header && step2Content && step2Arrow) {
        step2Header.addEventListener('click', () => {
          const isHidden = step2Content.style.display === "none";
          step2Content.style.display = isHidden ? "block" : "none";
          step2Arrow.textContent = isHidden ? "▲" : "▼";
        });
      }
    }

    // 3. 주입 피드백 애니메이션 실행
    static triggerInjectAnimation(jsonInputEl, isSuccess) {
      if (!jsonInputEl) return;
      jsonInputEl.classList.remove('hud-inject-success', 'hud-inject-error');
      void jsonInputEl.offsetWidth; // reflow
      if (isSuccess) {
        jsonInputEl.classList.add('hud-inject-success');
      } else {
        jsonInputEl.classList.add('hud-inject-error');
      }
    }

    // 4. JSON 포맷 정리 및 유효성 실시간 체크
    static initJsonFormatterAndValidator(root, showAiStatusCallback) {
      const jsonInput = root.querySelector('#hud-custom-json-input');
      const formatBtn = root.querySelector('#btn-hud-format-json');
      const validationMsg = root.querySelector('#hud-json-validation-msg');

      if (jsonInput && validationMsg) {
        jsonInput.addEventListener('input', () => {
          const val = jsonInput.value.trim();
          if (!val) {
            validationMsg.style.display = 'none';
            return;
          }
          try {
            JSON.parse(val);
            validationMsg.style.display = 'none';
          } catch (e) {
            validationMsg.textContent = '❌ 문법 오류: ' + e.message;
            validationMsg.style.display = 'block';
          }
        });
      }

      if (formatBtn && jsonInput && validationMsg) {
        formatBtn.addEventListener('click', () => {
          const val = jsonInput.value.trim();
          if (!val) return;
          try {
            const parsed = JSON.parse(val);
            jsonInput.value = JSON.stringify(parsed, null, 2);
            validationMsg.style.display = 'none';
          } catch (e) {
            if (typeof showAiStatusCallback === 'function') {
              showAiStatusCallback('포맷 정리 실패: 올바른 JSON 형식이 아닙니다.', 'error');
            }
          }
        });
      }
    }
  }

  window.HUDUiUtils = HUDUiUtils;
})();
