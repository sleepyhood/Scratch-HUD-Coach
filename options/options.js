const key = "hud_assign_json";

(async function init() {
  const { [key]: val } = await chrome.storage.sync.get(key);
  if (val) document.getElementById("assign-json").value = val;
})();

document.getElementById("save").addEventListener("click", async () => {
  const v = document.getElementById("assign-json").value;
  await chrome.storage.sync.set({ [key]: v });
  alert("저장했습니다. (차후 버전에서 체크리스트에 반영)");
});
