// main.js

// === 設定區 ===
const IMAGE_BASE_PATH = "./imgs";

const CARD_BACKS = {
  classic_zh: `${IMAGE_BASE_PATH}/zh_cards_Back.png`,
  classic_jp: `${IMAGE_BASE_PATH}/jp_cards_Back.png`,
  hwLight: `${IMAGE_BASE_PATH}/HW_Cover_Light.png`,
  hwDark: `${IMAGE_BASE_PATH}/HW_Cover_Dark.png`
};

// === 多國語系字典 ===
const UI_TEXTS = {
  zh: {
    ui_title: "經典卡抽卡",
    ui_source_classic: "經典卡",
    ui_source_hidden: "隱言經",
    ui_mode_simple: "簡單模式",
    ui_mode_divination: "占卜模式",
    ui_draw_btn: "抽卡",
    ui_cardlist_summary: "卡牌清單",
    ui_divination_hint: "請憑直覺挑選 6 張卡片",
    ui_divination_result_title: "✦ 您的占卜結果 ✦",
    ui_divination_reset: "重新挑選",
    ui_status_init: "正在初始化...",
    ui_image_toggle: "顯示卡牌圖片"
  },
  jp: {
    ui_title: "聖典カード",
    ui_source_classic: "聖典カード",
    ui_source_hidden: "隠言経",
    ui_mode_simple: "シンプル",
    ui_mode_divination: "占いモード",
    ui_draw_btn: "カードを引く",
    ui_cardlist_summary: "カードリスト",
    ui_divination_hint: "直感で6枚のカードを選んでください",
    ui_divination_result_title: "✦ 占い結果 ✦",
    ui_divination_reset: "もう一度選ぶ",
    ui_status_init: "初期化中...",
    ui_image_toggle: "画像を表示する"
  },
  en: {
    ui_title: "Bahá'í Cards",
    ui_source_classic: "Classic Cards",
    ui_source_hidden: "Hidden Words",
    ui_mode_simple: "Simple Mode",
    ui_mode_divination: "Divination",
    ui_draw_btn: "Draw Card",
    ui_cardlist_summary: "Card List",
    ui_divination_hint: "Follow your intuition and pick 6 cards",
    ui_divination_result_title: "✦ Your Reading ✦",
    ui_divination_reset: "Start Over",
    ui_status_init: "Initializing...",
    ui_image_toggle: "Show Images"
  }
};

// === 輔助函式：取得當前正確的卡背 ===
function getCurrentBackImage() {
  const isDarkTheme = document.body.getAttribute("data-theme") === "dark";
  
  if (appState.source === 'hidden') {
    // 隱言經：根據深淺色模式切換
    return isDarkTheme ? CARD_BACKS.hwDark : CARD_BACKS.hwLight;
  } else {
    // 經典卡：使用預設卡背
    return CARD_BACKS.default; 
  }
}

// === 狀態管理 (核心) ===
// 記錄三層選項的當前狀態
let appState = {
  lang: "zh",      // zh | jp | en | ko
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

// === 更新介面語系的函式 ===
function updateUILanguage() {
  const lang = appState.lang;
  const texts = UI_TEXTS[lang] || UI_TEXTS.zh;

  // 1. 更新所有帶有 data-i18n 屬性的元素
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (texts[key]) {
      el.textContent = texts[key];
    }
  });

  // 2. 特殊更新：占卜介面的計數器提示語
  if (appState.mode === 'divination') {
    updateSelectionUI(); // 呼叫原本的 UI 更新函式來同步文字
  }
  
  // 3. 更新狀態列文字 (如果正在載入中)
  if (isLoading) {
    setStatus(texts.ui_status_init);
  }
}

// 防呆機制與狀態套用
function validateAndApplyState() {
  const { lang, source } = appState;

  // 1. 根據語言鎖定不支援的來源
  const classicRadio = document.getElementById('source-classic');
  const hiddenRadio = document.getElementById('source-hidden');

  if (lang === 'jp') {
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

  // 執行介面翻譯
  updateUILanguage();
  // 切換畫面與載入資料
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
    if (lang === 'jp') return './cards_jp.json';
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
  
  // 1. 如果是占卜模式，渲染完整牌組供挑選
  if (appState.mode === "divination") {
    renderFullDeck();
  }
  
  // 2. 恢復功能：渲染卡牌清單（支援中日文）
  renderCardList();
}

// === 新增：渲染卡牌清單功能 ===
function renderCardList() {
  const cardListContainer = document.getElementById("cardList");
  if (!cardListContainer) return;

  cardListContainer.innerHTML = ""; // 清空舊內容

  currentCardPool.forEach((card, index) => {
    const item = document.createElement("div");
    item.className = "cardlist-item";
    // 顯示卡片名稱，若無名稱則顯示編號
    item.textContent = card.name || `Card ${index + 1}`;
    
    // 點擊清單項目直接顯示該張卡片
    item.onclick = () => {
      if (appState.source === "hidden") {
        renderCardTextOnly(card);
      } else {
        renderCardWithImage(card);
      }
      // 點擊後自動捲動到顯示區域
      document.getElementById("cardDisplay")?.scrollIntoView({ behavior: 'smooth' });
    };
    
    cardListContainer.appendChild(item);
  });
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

// === 輔助函式：取得當前應使用的背面圖片路徑 ===
function getCurrentBackImage() {
  const { lang, source } = appState;
  const isDarkTheme = document.body.getAttribute("data-theme") === "dark";

  if (source === 'hidden') {
    return isDarkTheme ? CARD_BACKS.hwDark : CARD_BACKS.hwLight;
  } else {
    // 經典卡 source === 'classic'
    return (lang === 'jp') ? CARD_BACKS.classic_jp : CARD_BACKS.classic_zh;
  }
}

// === 修改：更新卡片背面顯示 ===
function updateCardBackImage() {
  // 取得當前應該顯示的卡背
  const currentBackImg = getCurrentBackImage();
  
  // 1. 更新隱言經牌組
  const deckTextOnlyImg = document.querySelector('#deckTextOnly img');
  if (deckTextOnlyImg) deckTextOnlyImg.src = currentBackImg;

  // 2. 更新經典卡牌組
  const deckImg = document.querySelector('#deck img');
  if (deckImg) deckImg.src = currentBackImg;

  // 3. 更新占卜模式的所有卡牌
  const divinationCards = document.querySelectorAll('#cardSpread .mini-card img');
  divinationCards.forEach(img => {
    img.src = currentBackImg;
  });
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

  // 取得當前正確的卡背圖片
  const currentBackImg = getCurrentBackImage();

  const shuffledIndices = [...Array(currentCardPool.length).keys()].sort(() => Math.random() - 0.5);

  shuffledIndices.forEach((poolIndex) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "mini-card";

    const img = document.createElement("img");
    // 這裡原本是寫死的 CARD_BACKS.default，改為使用動態變數
    img.src = currentBackImg; 
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
  const lang = appState.lang;
  const texts = UI_TEXTS[lang] || UI_TEXTS.zh;
  
  if(selectionCounter) {
    if (count < 6) {
      selectionCounter.textContent = `${texts.ui_divination_hint} (${count} / 6)`;
    } else {
      selectionCounter.textContent = "✦ Done ✦"; // 或者加入字典
    }
  }

  const resultsArea = document.getElementById("divinationFullResults");
  const container = document.getElementById("resultsContainer");

  if (count === 6) {
      // 顯示結果標題
      resultsArea.querySelector('h3').textContent = texts.ui_divination_result_title;
      // 顯示重置按鈕文字
      resultsArea.querySelector('button').textContent = texts.ui_divination_reset;
    container.innerHTML = "";

    selectedIndices.forEach((cardIdx, i) => {
      const card = currentCardPool[cardIdx];
      const cardDiv = document.createElement("div");
      
      cardDiv.className = "result-card-unit";

      // 處理「第 X 張」的翻譯
        let orderText = `Card ${i + 1}`;
        if(lang === 'zh') orderText = `第 ${i + 1} 張`;
        if(lang === 'jp') orderText = `第 ${i + 1} 枚`;
      
      cardDiv.innerHTML = `
        <h4>${orderText}：${card.name || ""}</h4>
          <p class="result-text">${card.description || ""}</p>
        `;
      container.appendChild(cardDiv);
    });
    resultsArea.scrollIntoView({ behavior: 'smooth' });
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
