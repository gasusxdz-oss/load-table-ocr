const pdfFile = document.getElementById("pdfFile");
const uploadedFileName = document.getElementById("uploadedFileName");
const image = document.getElementById("pdfImage");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const rowInput = document.getElementById("rowCount");
const ocrButton = document.getElementById("ocrButton");
const zoomInButton = document.getElementById("zoomIn");
const zoomOutButton = document.getElementById("zoomOut");
const resetViewButton = document.getElementById("zoomReset");
const viewer = document.getElementById("viewer");
const message = document.getElementById("message");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const downloadLinkContainer = document.getElementById("downloadLinkContainer");
const downloadLink = document.getElementById("downloadLink");
const prevPageButton = document.getElementById("prevPage");
const nextPageButton = document.getElementById("nextPage");
const currentPageSpan = document.getElementById("currentPage");
const totalPagesSpan = document.getElementById("totalPages");
const dropzone = document.querySelector(".dropzone");
const selectButton = document.querySelector(".selectButton");

let dragging = false;
let panning = false;
let mode = "idle";
let startPoint = null;
let currentPoint = null;
let selection = null;
let panStartX = 0;
let panStartY = 0;
let blinkVisible = true;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let imageWidth = 0;
let imageHeight = 0;
let imageLoaded = false;
let totalPages = 1;
let currentPage = 1;

const MIN_SCALE = 0.05;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.15;

// 点滅するカーソルの表示を切り替えるためのタイマー
setInterval(() => {
    blinkVisible = !blinkVisible;
    draw();
}, 500);

// 値をminとmaxの範囲に制限する関数
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// 画像をビューアにフィットさせる関数
function fitToView() {
    if (!imageLoaded) return;

    const rect = viewer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const fitScale = Math.min(rect.width / imageWidth, rect.height / imageHeight);
    scale = clamp(Math.min(1, fitScale), MIN_SCALE, MAX_SCALE);
    offsetX = (rect.width - imageWidth * scale) / 2;
    offsetY = (rect.height - imageHeight * scale) / 2;

    image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    image.style.transformOrigin = "0 0";
    draw();
}

// 画像座標をスクリーン座標に変換する関数
function imageToScreen(x, y) {
    return {
        x: x * scale + offsetX,
        y: y * scale + offsetY
    };
}

// スクリーン座標を画像座標に変換する関数
function screenToImage(x, y) {
    return {
        x: (x - offsetX) / scale,
        y: (y - offsetY) / scale
    };
}

// ズームを行う関数
function zoomAt(factor, anchorX, anchorY) {
    if (!imageLoaded) return;

    const previousScale = scale;
    scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);

    if (scale === previousScale) return;

    const anchorImageX = (anchorX - offsetX) / previousScale;
    const anchorImageY = (anchorY - offsetY) / previousScale;

    offsetX = anchorX - anchorImageX * scale;
    offsetY = anchorY - anchorImageY * scale;

    image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    image.style.transformOrigin = "0 0";
    draw();
}

// 選択範囲を画像の境界内に制限する関数
function clampSelection(rect) {
    const left = clamp(rect.left, 0, imageWidth);
    const top = clamp(rect.top, 0, imageHeight);
    const right = clamp(rect.right, 0, imageWidth);
    const bottom = clamp(rect.bottom, 0, imageHeight);

    return {
        left: Math.min(left, right),
        top: Math.min(top, bottom),
        right: Math.max(left, right),
        bottom: Math.max(top, bottom)
    };
}

// 選択範囲を描画する関数
function drawSelectionRect(rect) {
    const start = imageToScreen(rect.left, rect.top);
    const end = imageToScreen(rect.right, rect.bottom);

    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);

    const rows = Math.max(1, parseInt(rowInput.value, 10) || 1);
    const rowHeight = (rect.bottom - rect.top) / rows;

    ctx.strokeStyle = "rgba(255, 0, 0, 0.75)";
    ctx.lineWidth = 1;

    for (let i = 1; i < rows; i += 1) {
        const y = rect.top + rowHeight * i;
        const rowStart = imageToScreen(rect.left, y);
        const rowEnd = imageToScreen(rect.right, y);

        ctx.beginPath();
        ctx.moveTo(rowStart.x, rowStart.y);
        ctx.lineTo(rowEnd.x, rowEnd.y);
        ctx.stroke();
    }
}

// 描画を更新する関数
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (dragging && startPoint && currentPoint) {
        const rect = clampSelection({
            left: Math.min(startPoint.x, currentPoint.x),
            top: Math.min(startPoint.y, currentPoint.y),
            right: Math.max(startPoint.x, currentPoint.x),
            bottom: Math.max(startPoint.y, currentPoint.y)
        });
        drawSelectionRect(rect);
        return;
    }

    if (selection && blinkVisible) {
        drawSelectionRect(selection);
    }
}

// PDFファイルが選択されたときの処理
pdfFile.addEventListener("change", async () => {
    if (pdfFile.files.length === 0) {
        return;
    }

    uploadedFileName.textContent = pdfFile.files[0].name;

    const form = new FormData();
    form.append("pdf", pdfFile.files[0]);

    const res = await fetch("/upload", {
        method: "POST",
        body: form
    });

    const data = await res.json();
    selection = null;
    imageLoaded = false;
    currentPage = 1;
    totalPages = data.total_pages || 1;
    
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    updatePageButtonStates();
    downloadLinkContainer.style.display = "none";
    downloadLink.href = "#";
    
    image.src = data.image + "?" + Date.now();
});

// 画像が読み込まれたときの処理
image.onload = () => {
    imageLoaded = true;
    imageWidth = image.naturalWidth;
    imageHeight = image.naturalHeight;
    fitToView();
};

// ウィンドウのサイズが変更されたときの処理
window.addEventListener("resize", () => {
    if (imageLoaded) {
        fitToView();
    }
});

// マウス操作のイベントリスナー
canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();

    if (e.button === 1) {
        e.preventDefault();
        panning = true;
        mode = "pan";
        canvas.style.cursor = "grabbing";
        panStartX = e.clientX;
        panStartY = e.clientY;
        startPoint = null;
        currentPoint = null;
        return;
    }

    if (e.button !== 0) return;

    const point = screenToImage(e.clientX - rect.left, e.clientY - rect.top);

    dragging = true;
    mode = "select";
    startPoint = { x: point.x, y: point.y };
    currentPoint = { x: point.x, y: point.y };
    selection = null;
    canvas.style.cursor = "crosshair";
    draw();
});

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    if (mode === "pan" && panning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        offsetX += dx;
        offsetY += dy;
        panStartX = e.clientX;
        panStartY = e.clientY;
        image.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        image.style.transformOrigin = "0 0";
        draw();
        return;
    }

    if (!dragging || !startPoint) return;

    currentPoint = screenToImage(e.clientX - rect.left, e.clientY - rect.top);
    draw();
});

canvas.addEventListener("mouseup", (e) => {
    if (mode === "pan") {
        panning = false;
        mode = "idle";
        canvas.style.cursor = "crosshair";
        return;
    }

    if (!dragging) return;

    const rect = canvas.getBoundingClientRect();
    currentPoint = screenToImage(e.clientX - rect.left, e.clientY - rect.top);
    dragging = false;
    mode = "idle";

    selection = clampSelection({
        left: Math.min(startPoint.x, currentPoint.x),
        top: Math.min(startPoint.y, currentPoint.y),
        right: Math.max(startPoint.x, currentPoint.x),
        bottom: Math.max(startPoint.y, currentPoint.y)
    });

    draw();
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAt(factor, anchorX, anchorY);
}, { passive: false });

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

rowInput.addEventListener("input", draw);

zoomInButton.addEventListener("click", () => {
    zoomAt(ZOOM_STEP, viewer.clientWidth / 2, viewer.clientHeight / 2);
});

zoomOutButton.addEventListener("click", () => {
    zoomAt(1 / ZOOM_STEP, viewer.clientWidth / 2, viewer.clientHeight / 2);
});

resetViewButton.addEventListener("click", fitToView);

// ファイル選択ボタンのイベントリスナー
selectButton.addEventListener("click", (e) => {
    e.preventDefault();
    pdfFile.click();
});

// ページナビゲーション関数
async function changePage(pageNumber) {
    const res = await fetch("/page", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            page: pageNumber
        })
    });

    const data = await res.json();
    
    if (res.ok) {
        currentPage = data.current_page;
        totalPages = data.total_pages;
        
        currentPageSpan.textContent = currentPage;
        totalPagesSpan.textContent = totalPages;
        updatePageButtonStates();
        
        selection = null;
        image.src = data.image + "?" + Date.now();
    } else {
        alert(data.error || "ページの変更に失敗しました");
    }
}

// ページボタンの有効/無効を更新
function updatePageButtonStates() {
    prevPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;
}

// ページナビゲーションボタンのイベントリスナー
prevPageButton.addEventListener("click", () => {
    if (currentPage > 1) {
        changePage(currentPage - 2);
    }
});

nextPageButton.addEventListener("click", () => {
    if (currentPage < totalPages) {
        changePage(currentPage);
    }
});

// ドラッグ&ドロップのイベントリスナー
dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.style.borderColor = "#4f8cff";
    dropzone.style.background = "#eef5ff";
});

dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.style.borderColor = "#d9e3ef";
    dropzone.style.background = "#f8fafc";
});

dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dropzone.style.borderColor = "#d9e3ef";
    dropzone.style.background = "#f8fafc";
    
    const files = e.dataTransfer.files;
    if (files.length === 0) {
        return;
    }

    const file = files[0];
    if (!file.name.endsWith(".pdf")) {
        alert("PDFファイルを選択してください");
        return;
    }

    pdfFile.files = files;
    uploadedFileName.textContent = file.name;

    const form = new FormData();
    form.append("pdf", file);

    const res = await fetch("/upload", {
        method: "POST",
        body: form
    });

    const data = await res.json();
    selection = null;
    imageLoaded = false;
    currentPage = 1;
    totalPages = data.total_pages || 1;
    
    currentPageSpan.textContent = currentPage;
    totalPagesSpan.textContent = totalPages;
    updatePageButtonStates();
    downloadLinkContainer.style.display = "none";
    downloadLink.href = "#";
    
    image.src = data.image + "?" + Date.now();
});

ocrButton.addEventListener("click", async () => {
    if (selection == null) {
        alert("範囲を選択してください");
        return;
    }

    progressBar.value = 0;
    progressText.textContent = "0%";

    const timer = setInterval(async () => {
        const p = await updateProgress();
        if (p >= 100) {
            clearInterval(timer);
        }
    }, 200);

    const res = await fetch("/save_selection", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ...selection,
            rows: parseInt(rowInput.value, 10)
        })
    });

    clearInterval(timer);
    progressBar.value = 100;
    progressText.textContent = "100%";

    const data = await res.json();
    showMessage("OCRが完了しました。補正結果を確認してください。")

    downloadLink.href = data.excel;
    downloadLinkContainer.style.display = "block";
});

// メッセージを表示する関数
function showMessage(text) {
    message.textContent = text;
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 3000);
}

// 進捗状況を更新する関数
async function updateProgress() {
    const res = await fetch("/progress");
    const data = await res.json();

    progressBar.value = data.progress;
    progressText.textContent = data.progress + "%";

    return data.progress;
}