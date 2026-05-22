const key_assign = "hud_assign_json";
const key_level = "hud_comment_level";
const key_style = "hud_comment_style";

(async function init() {
  const data = await chrome.storage.sync.get([key_assign, key_level, key_style]);
  if (data[key_assign]) {
    document.getElementById("assign-json").value = data[key_assign];
  }
  if (data[key_level]) {
    document.getElementById("comment-level").value = data[key_level];
  }
  if (data[key_style]) {
    document.getElementById("comment-style").value = data[key_style];
  }
})();

document.getElementById("save").addEventListener("click", async () => {
  const v_assign = document.getElementById("assign-json").value;
  const v_level = document.getElementById("comment-level").value;
  const v_style = document.getElementById("comment-style").value;
  await chrome.storage.sync.set({ 
    [key_assign]: v_assign,
    [key_level]: v_level,
    [key_style]: v_style
  });
  alert("설정을 저장했습니다.");
});
