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
    ui_title: "Scripture Cards",
    ui_source_classic: "Scripture Cards",
    ui_source_hidden: "Hidden Words",
    ui_mode_simple: "Simple",
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

// === 狀態管理 (核心) ===
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

const simpleModeGroup = document.getElementById("simpleModeGroup");
const textOnlyModeGroup = document.getElementById("textOnlyModeGroup");
const divinationModeDisplay = document.getElementById("divinationModeDisplay");

// 新增取得卡片顯示區塊容器
const cardDisplayEl = document.getElementById("cardDisplay");
const textCardDisplayEl = document.getElementById("textCardDisplay");

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
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const name = e.target.name; 
      const value = e.target.value;
      handleStateChange(name, value);
    });
  });

  if(drawButtonEl) drawButtonEl.addEventListener("click", onDrawCard);
  if(drawButtonTextOnlyEl) drawButtonTextOnlyEl.addEventListener("click", onDrawCard);
  document.getElementById("deck")?.addEventListener("click", onDrawCard);
  document.getElementById("deckTextOnly")?.addEventListener("click", onDrawCard);

  if(toggleImageEl) toggleImageEl.addEventListener("change", updateImageVisibility);
  if(themeToggleCheckbox) {
    themeToggleCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) document.body.setAttribute("data-theme", "dark");
      else document.body.removeAttribute("data-theme");
      updateCardBackImage();
    });
  }

  validateAndApplyState();
});

// === 核心：處理三層選單的變化 ===
function handleStateChange(category, value) {
  appState[category] = value;
  validateAndApplyState();
}

function updateUILanguage() {
  const lang = appState.lang;
  const texts = UI_TEXTS[lang] || UI_TEXTS.zh;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (texts[key]) el.textContent = texts[key];
  });

  if (appState.mode === 'divination') updateSelectionUI(); 
  if (isLoading) setStatus(texts.ui_status_init);
}

// === 防呆機制與狀態套用 ===
function validateAndApplyState() {
  const { lang } = appState;

  const classicRadio = document.getElementById('source-classic');
  const hiddenRadio = document.getElementById('source-hidden');
  const classicLabel = document.querySelector('label[for="source-classic"]');

  // 每次切換前，先還原經典卡標籤的顯示狀態
  if(classicLabel) classicLabel.style.display = "";

  if (lang === 'jp') {
    // 日文：無隱言經 (保留選項，但停用)
    hiddenRadio.disabled = true;
    classicRadio.disabled = false;
    if (appState.source === 'hidden') appState.source = 'classic';
  } else if (lang === 'en') {
    // 英文：無經典卡 (隱藏選項標籤，保留隱言經)
    classicRadio.disabled = true;
    if(classicLabel) classicLabel.style.display = "none";
    hiddenRadio.disabled = false;
    if (appState.source === 'classic') appState.source = 'hidden';
  } else {
    // 繁中 (與韓文)：皆有
    classicRadio.disabled = false;
    hiddenRadio.disabled = false;
  }

  // 確保切換語系或來源時，重置卡片顯示區塊為隱藏狀態
  resetDisplays();

  document.getElementById(`source-${appState.source}`).checked = true;

  updateUILanguage();
  updateLayout();
  loadData();
}

function updateLayout() {
  const { mode, source } = appState;
  selectedIndices = []; 

  simpleModeGroup.style.display = "none";
  textOnlyModeGroup.style.display = "none";
  divinationModeDisplay.style.display = "none";

  if (mode === "divination") {
    divinationModeDisplay.style.display = "block";
    mainStatusSection.style.display = "none";
  } else {
    mainStatusSection.style.display = "flex";
    
    if (source === "hidden") {
      textOnlyModeGroup.style.display = "flex";
      imageToggleContainer.style.display = "none"; 
    } else {
      simpleModeGroup.style.display = "flex";
      imageToggleContainer.style.display = "inline-flex";
    }
  }

  updateCardBackImage();
}

function getTargetJsonPath() {
  const { lang, source } = appState;
  if (source === 'classic') {
    if (lang === 'zh') return './cards_filled.json';
    if (lang === 'jp') return './cards_jp.json';
  } else if (source === 'hidden') {
    if (lang === 'zh') return './hidden_words_zh.json';
    if (lang === 'en') return './hidden_words_en.json';
  }
  return './cards_filled.json'; 
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
  
  renderCardList();
}

function renderCardList() {
  const cardListContainer = document.getElementById("cardList");
  if (!cardListContainer) return;

  cardListContainer.innerHTML = ""; 

  currentCardPool.forEach((card, index) => {
    const item = document.createElement("div");
    item.className = "cardlist-item";
    item.textContent = card.name || `Card ${index + 1}`;
    
    item.onclick = () => {
      if (appState.source === "hidden") {
        renderCardTextOnly(card);
      } else {
        renderCardWithImage(card);
      }
      // 確保點擊清單時也會顯示卡片區塊
      document.getElementById(appState.source === "hidden" ? "textCardDisplay" : "cardDisplay")?.scrollIntoView({ behavior: 'smooth' });
    };
    
    cardListContainer.appendChild(item);
  });
}

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
  // 顯示卡片區塊
  if(cardDisplayEl) cardDisplayEl.style.display = "flex";

  const name = card.name || "未命名卡牌";
  cardNameEl.textContent = name;
  cardDescriptionEl.textContent = card.description || "";

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
  // 顯示卡片區塊
  if(textCardDisplayEl) textCardDisplayEl.style.display = "flex";

  let prefix = "";
  if (appState.lang === "en") prefix = "Hidden Words No. ";
  else if (appState.lang === "zh") prefix = "隱言經 第 ";

  let title = `${prefix}${card.name || card.id}`;
  if (appState.lang === "zh") title += " 條";

  textCardNameEl.textContent = title;
  textCardDescriptionEl.textContent = card.description || "";

  triggerAnimation(textCardNameEl.parentElement);
}

function getCurrentBackImage() {
  const { lang, source } = appState;
  const isDarkTheme = document.body.getAttribute("data-theme") === "dark";

  if (source === 'hidden') {
    return isDarkTheme ? CARD_BACKS.hwDark : CARD_BACKS.hwLight;
  } else {
    return (lang === 'jp') ? CARD_BACKS.classic_jp : CARD_BACKS.classic_zh;
  }
}

function updateCardBackImage() {
  const currentBackImg = getCurrentBackImage();
  
  const deckTextOnlyImg = document.querySelector('#deckTextOnly img');
  if (deckTextOnlyImg) deckTextOnlyImg.src = currentBackImg;

  const deckImg = document.querySelector('#deck img');
  if (deckImg) deckImg.src = currentBackImg;

  const divinationCards = document.querySelectorAll('#cardSpread .mini-card img');
  divinationCards.forEach(img => {
    img.src = currentBackImg;
  });
}

function renderFullDeck() {
  if (!cardSpread) return;

  cardSpread.innerHTML = "";
  selectedIndices = [];

  const results = document.getElementById("divinationFullResults");
  if (results) results.style.display = "none";

  const testCardDetail = document.getElementById("testCardDetail");
  if (testCardDetail) testCardDetail.style.display = "none";

  updateSelectionUI();

  const currentBackImg = getCurrentBackImage();

  const shuffledIndices = [...Array(currentCardPool.length).keys()]
    .sort(() => Math.random() - 0.5);

  shuffledIndices.forEach((poolIndex) => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "mini-card";

    const img = document.createElement("img");
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
      selectionCounter.textContent = "✦ Done ✦"; 
    }
  }

  const resultsArea = document.getElementById("divinationFullResults");
  const container = document.getElementById("resultsContainer");

  if (count === 6) {
    resultsArea.style.display = "block";
    resultsArea.querySelector('h3').textContent = texts.ui_divination_result_title;
    resultsArea.querySelector('button').textContent = texts.ui_divination_reset;
    container.innerHTML = "";

    selectedIndices.forEach((cardIdx, i) => {
      const card = currentCardPool[cardIdx];
      const cardDiv = document.createElement("div");
      cardDiv.className = "result-card-unit";

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
  } else {
    resultsArea.style.display = "none";
  }
}

function resetDisplays() {
  // 隱藏卡片顯示區塊直到實際抽卡
  if (cardDisplayEl) cardDisplayEl.style.display = "none";
  if (textCardDisplayEl) textCardDisplayEl.style.display = "none";

  if (cardNameEl) cardNameEl.textContent = "";
  if (cardDescriptionEl) cardDescriptionEl.textContent = "";
  if (cardImageWrapperEl) cardImageWrapperEl.style.display = "none";
  if (cardImageEl) cardImageEl.removeAttribute("src");

  if (textCardNameEl) textCardNameEl.textContent = "";
  if (textCardDescriptionEl) textCardDescriptionEl.textContent = "";
}

function triggerAnimation(element) {
  if (!element) return;
  element.classList.remove("flip");
  void element.offsetWidth; 
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
