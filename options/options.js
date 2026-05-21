const key_assign = "hud_assign_json";
const key_level = "hud_comment_level";

(async function init() {
  const data = await chrome.storage.sync.get([key_assign, key_level]);
  if (data[key_assign]) {
    document.getElementById("assign-json").value = data[key_assign];
  }
  if (data[key_level]) {
    document.getElementById("comment-level").value = data[key_level];
  }
})();

document.getElementById("save").addEventListener("click", async () => {
  const v_assign = document.getElementById("assign-json").value;
  const v_level = document.getElementById("comment-level").value;
  await chrome.storage.sync.set({ 
    [key_assign]: v_assign,
    [key_level]: v_level
  });
  alert("설정을 저장했습니다.");
});
