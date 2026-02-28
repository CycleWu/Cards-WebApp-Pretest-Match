// main.js

// === 設定區 ===
const IMAGE_BASE_PATH = "./imgs";

const CARD_BACKS = {
  default: `${IMAGE_BASE_PATH}/Back.png`,
  hwLight: `${IMAGE_BASE_PATH}/HW_Cover_Light.png`,
  hwDark: `${IMAGE_BASE_PATH}/HW_Cover_Dark.png`
};

// === 狀態管理 (核心) ===
// 記錄三層選項的當前狀態
let appState = {
  lang: "zh",      // zh | ja | en | ko
  source: "classic",// classic | hidden
  mode: "simple"    // simple | divination
};

let currentCardPool = []; 
let dataCache = {};       
let isLoading = false;
let selectedIndices = [];

// === DOM 取得 ===
const drawButtonEl = document.getElementById("drawButton");
const statusTextEl = document.getElementById("statusText");
const toggleImageEl = document.getElementById("toggleImage");
const mainStatusSection = document.getElementById("mainStatusSection");
const imageToggleContainer = document.getElementById("imageToggleContainer");
const themeToggleCheckbox = document.getElementById("themeToggleCheckbox");

// 各顯示區塊
const simpleModeGroup = document.getElementById("simpleModeGroup");
const textOnlyModeGroup = document.getElementById("textOnlyModeGroup");
const divinationModeDisplay = document.getElementById("divinationModeDisplay");

// 簡單版 (經典卡 - 有圖片) 元素
const cardNameEl = document.getElementById("cardName");
const cardDescriptionEl = document.getElementById("cardDescription");
const cardImageEl = document.getElementById("cardImage");
const cardImageWrapperEl = document.getElementById("cardImageWrapper");

// 純文字版 (隱言經 - 無圖片) 元素
const deckTextOnlyImg = document.querySelector('#deckTextOnly img');
const textCardNameEl = document.getElementById("textCardName");
const textCardDescriptionEl = document.getElementById("textCardDescription");
const drawButtonTextOnlyEl = document.getElementById("drawButtonTextOnly");

// 占卜版元素
const cardSpread = document.getElementById("cardSpread");
const testCardDetail = document.getElementById("testCardDetail");
const selectionCounter = document.getElementById("selectionCounter");

// === 初始化 ===
document.addEventListener("DOMContentLoaded", () => {
  // 綁定所有 Radio 按鈕的改變事件
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const name = e.target.name; // lang, source, 或是 mode
      const value = e.target.value;
      handleStateChange(name, value);
    });
  });

  // 綁定抽卡按鈕
  if(drawButtonEl) drawButtonEl.addEventListener("click", onDrawCard);
  if(drawButtonTextOnlyEl) drawButtonTextOnlyEl.addEventListener("click", onDrawCard);
  document.getElementById("deck")?.addEventListener("click", onDrawCard);
  document.getElementById("deckTextOnly")?.addEventListener("click", onDrawCard);

  // 其他 UI 綁定
  if(toggleImageEl) toggleImageEl.addEventListener("change", updateImageVisibility);
  if(themeToggleCheckbox) {
    themeToggleCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) document.body.setAttribute("data-theme", "dark");
      else document.body.removeAttribute("data-theme");
      updateCardBackImage();
    });
  }

  // 初次載入
  validateAndApplyState();
});

// === 核心：處理三層選單的變化 ===
function handleStateChange(category, value) {
  appState[category] = value;
  validateAndApplyState();
}

// 防呆機制與狀態套用
function validateAndApplyState() {
  const { lang, source } = appState;

  // 1. 根據語言鎖定不支援的來源
  const classicRadio = document.getElementById('source-classic');
  const hiddenRadio = document.getElementById('source-hidden');

  if (lang === 'ja') {
    // 日文沒有隱言經
    hiddenRadio.disabled = true;
    classicRadio.disabled = false;
    if (appState.source === 'hidden') appState.source = 'classic';
  } else if (lang === 'en') {
    // 英文沒有經典卡
    classicRadio.disabled = true;
    hiddenRadio.disabled = false;
    if (appState.source === 'classic') appState.source = 'hidden';
  } else {
    // 繁中都有
    classicRadio.disabled = false;
    hiddenRadio.disabled = false;
  }

  // 同步 UI 狀態 (避免 JS 強制切換但畫面沒跟上)
  document.getElementById(`source-${appState.source}`).checked = true;

  // 2. 切換畫面與載入資料
  resetDisplays();
  updateLayout();
  loadData();
}

// 根據來源與模式切換顯示的 UI 區塊
function updateLayout() {
  const { mode, source } = appState;
  selectedIndices = []; 

  // 隱藏全部
  simpleModeGroup.style.display = "none";
  textOnlyModeGroup.style.display = "none";
  divinationModeDisplay.style.display = "none";

  if (mode === "divination") {
    // --- 占卜模式 ---
    divinationModeDisplay.style.display = "block";
    mainStatusSection.style.display = "none";
  } else {
    // --- 簡單模式 ---
    mainStatusSection.style.display = "flex";
    
    if (source === "hidden") {
      // 隱言經：無圖片版面
      textOnlyModeGroup.style.display = "flex";
      imageToggleContainer.style.display = "none"; 
    } else {
      // 經典卡：有圖片版面
      simpleModeGroup.style.display = "flex";
      imageToggleContainer.style.display = "inline-flex";
    }
  }

  updateCardBackImage();
}

// 根據當前選擇取得對應的 JSON 檔名
function getTargetJsonPath() {
  const { lang, source } = appState;
  if (source === 'classic') {
    if (lang === 'zh') return './cards_filled.json';
    if (lang === 'ja') return './cards_jp.json';
  } else if (source === 'hidden') {
    if (lang === 'zh') return './hidden_words_zh.json';
    if (lang === 'en') return './hidden_words_en.json';
  }
  return './cards_filled.json'; // 預設安全值
}

async function loadData() {
  isLoading = true;
  setStatus("正在載入資料...");
  setDrawEnabled(false);

  const targetUrl = getTargetJsonPath();

  if (dataCache[targetUrl]) {
    currentCardPool = dataCache[targetUrl];
    onDataLoaded();
    isLoading = false;
    return;
  }

  try {
    const res = await fetch(targetUrl, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");
    const data = await res.json();
    dataCache[targetUrl] = data;
    currentCardPool = data;
    onDataLoaded();
  } catch (e) {
    console.error(e);
    setStatus("資料載入失敗，無法取得：" + targetUrl);
  } finally {
    isLoading = false;
  }
}

function onDataLoaded() {
  setStatus(`已載入牌庫：共 ${currentCardPool.length} 張。`);
  setDrawEnabled(true);
  
  if (appState.mode === "divination") {
    renderFullDeck();
  }
}

// === 抽卡渲染邏輯 ===
function onDrawCard() {
  if (isLoading || !currentCardPool.length) return;
  const randomIndex = Math.floor(Math.random() * currentCardPool.length);
  const card = currentCardPool[randomIndex];

  if (appState.source === "hidden") {
    renderCardTextOnly(card);
  } else {
    renderCardWithImage(card);
  }
}

function renderCardWithImage(card) {
  const name = card.name || "未命名卡牌";
  cardNameEl.textContent = name;
  cardDescriptionEl.textContent = card.description || "";

  // 這裡動態讀取 JSON 中的 image 屬性，不用擔心檔名變更
  if (card.image && toggleImageEl.checked) {
    cardImageEl.src = `${IMAGE_BASE_PATH}/${card.image}`;
    cardImageEl.alt = name;
    cardImageWrapperEl.style.display = "block";
  } else {
    cardImageWrapperEl.style.display = "none";
    cardImageEl.removeAttribute("src");
  }

  triggerAnimation(cardNameEl.parentElement);
}

function renderCardTextOnly(card) {
  let prefix = "";
  if (appState.lang === "en") prefix = "Hidden Words No. ";
  else if (appState.lang === "zh") prefix = "隱言經 第 ";

  let title = `${prefix}${card.name || card.id}`;
  if (appState.lang === "zh") title += " 條";

  textCardNameEl.textContent = title;
  textCardDescriptionEl.textContent = card.description || "";

  triggerAnimation(textCardNameEl.parentElement);
}

// === 占卜邏輯 ===
function renderFullDeck() {
  if(!cardSpread) return;
  cardSpread.innerHTML = "";
  selectedIndices = [];

  document.getElementById("divinationFullResults").style.display = "none";
  testCardDetail.style.display = "block";
  testCardDetail.innerHTML = "<p>準備中...</p>";
  updateSelectionUI();

  const shuffledIndices = [...Array(currentCardPool.length).keys()].sort(() => Math.random() - 0.5);

  shuffledIndices.forEach((poolIndex) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "mini-card";

    const img = document.createElement("img");
    img.src = CARD_BACKS.default; 
    img.alt = "Card Back";
    img.ondragstart = () => false;
    cardDiv.appendChild(img);

    cardDiv.onclick = () => handleSelect(poolIndex, cardDiv);
    cardSpread.appendChild(cardDiv);
  });
}

function handleSelect(poolIndex, element) {
  if (selectedIndices.includes(poolIndex)) {
    selectedIndices = selectedIndices.filter(i => i !== poolIndex);
    element.classList.remove("selected");
  } else if (selectedIndices.length < 6) {
    selectedIndices.push(poolIndex);
    element.classList.add("selected");
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = selectedIndices.length;
  if(selectionCounter) {
    selectionCounter.textContent = count < 6 ? `請繼續挑選 (${count} / 6)` : "✦ 挑選完成 ✦";
  }

  const resultsArea = document.getElementById("divinationFullResults");
  const container = document.getElementById("resultsContainer");

  if (count < 6) {
    testCardDetail.style.display = "block";
    resultsArea.style.display = "none";
    testCardDetail.innerHTML = "<p>請繼續挑選，感受卡片的訊息...</p>";
  } else {
    testCardDetail.style.display = "none";
    resultsArea.style.display = "block";
    container.innerHTML = "";

    selectedIndices.forEach((cardIdx, i) => {
      const card = currentCardPool[cardIdx];
      const cardDiv = document.createElement("div");
      cardDiv.className = "result-card-unit";
      cardDiv.innerHTML = `
        <h4>第 ${i + 1} 張：${card.name || "未命名"}</h4>
        <p class="result-text">${card.description || ""}</p>
      `;
      container.appendChild(cardDiv);
    });
    resultsArea.scrollIntoView({ behavior: 'smooth' });
  }
}

// === 輔助與重置函式 ===
function updateCardBackImage() {
  if (!deckTextOnlyImg) return;
  const isDarkTheme = document.body.getAttribute("data-theme") === "dark";
  if (appState.source === 'hidden') {
    deckTextOnlyImg.src = isDarkTheme ? CARD_BACKS.hwDark : CARD_BACKS.hwLight;
  } else {
    deckTextOnlyImg.src = CARD_BACKS.default;
  }
}

function resetDisplays() {
  if (cardNameEl) cardNameEl.textContent = "等待抽卡...";
  if (cardDescriptionEl) cardDescriptionEl.textContent = "請點擊下方按鈕或卡組。";
  if (cardImageWrapperEl) cardImageWrapperEl.style.display = "none";
  if (cardImageEl) cardImageEl.removeAttribute("src");

  if (textCardNameEl) textCardNameEl.textContent = "等待抽卡...";
  if (textCardDescriptionEl) textCardDescriptionEl.textContent = "請點擊下方按鈕或卡組。";
}

function triggerAnimation(element) {
  if (!element) return;
  element.classList.remove("flip");
  void element.offsetWidth; // 強制重繪
  element.classList.add("flip");
}

function setStatus(message) {
  if(statusTextEl) statusTextEl.textContent = message;
}

function setDrawEnabled(enabled) {
  if(drawButtonEl) drawButtonEl.disabled = !enabled;
  if(drawButtonTextOnlyEl) drawButtonTextOnlyEl.disabled = !enabled;
}

function updateImageVisibility() {
  if (!cardImageEl.src) return;
  cardImageWrapperEl.style.display = toggleImageEl.checked ? "block" : "none";
}
