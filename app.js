// Numicon shape definitions
const NUMICON_SHAPES = [
    { number: 1, color: '#e87c2a' },
    { number: 2, color: '#2b7de0' },
    { number: 3, color: '#7ec8e3' },
    { number: 4, color: '#2e8b57' },
    { number: 5, color: '#dc3545' },
    { number: 6, color: '#f5c542' },
    { number: 7, color: '#e75480' },
    { number: 8, color: '#a0522d' },
    { number: 9, color: '#1a3a6b' },
    { number: 10, color: '#b8b8b8' }
];

// Layout constants for SVG shapes
const HOLE_R = 12;
const HOLE_SPACING = 32;
const PAD = 8;
const CORNER_R = 6;

// State
let learnShapes = []; // shapes dropped in learn mode (max 2)
let currentMode = 'learn'; // 'learn' or 'quiz'
let currentOperation = 'sum'; // 'sum' or 'compare'
let dragState = null;
let quizScore = 0;
let quizTotal = 0;

// ============ SVG RENDERING ============

function createShapeSVG(shapeData) {
    const num = shapeData.number;
    const color = shapeData.color;

    const cols = num === 1 || num === 2 ? 1 : 2;
    const rows = Math.ceil(num / cols);
    const isOdd = num % 2 === 1 && num > 1;

    const width = cols * HOLE_SPACING + PAD * 2;
    const height = rows * HOLE_SPACING + PAD * 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', `Numicon shape for number ${num}`);
    svg.setAttribute('role', 'img');

    let path;
    if (isOdd) {
        const notchX = width - 28;
        const notchY = 28;
        const r = CORNER_R;
        path = `
            M ${r} 0 L ${notchX - r} 0
            Q ${notchX} 0 ${notchX} ${r}
            L ${notchX} ${notchY - r}
            Q ${notchX} ${notchY} ${notchX + r} ${notchY}
            L ${width - r} ${notchY}
            Q ${width} ${notchY} ${width} ${notchY + r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r} Q 0 0 ${r} 0 Z`;
    } else {
        const r = CORNER_R;
        path = `
            M ${r} 0 L ${width - r} 0
            Q ${width} 0 ${width} ${r}
            L ${width} ${height - r}
            Q ${width} ${height} ${width - r} ${height}
            L ${r} ${height}
            Q 0 ${height} 0 ${height - r}
            L 0 ${r} Q 0 0 ${r} 0 Z`;
    }

    const pathEl = document.createElementNS(svgNS, 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('fill', color);
    svg.appendChild(pathEl);

    let holeCount = 0;
    for (let row = 0; row < rows; row++) {
        const holesInRow = (isOdd && row === 0) ? 1 : cols;
        for (let col = 0; col < holesInRow; col++) {
            const cx = PAD + HOLE_SPACING / 2 + col * HOLE_SPACING;
            const cy = PAD + HOLE_SPACING / 2 + row * HOLE_SPACING;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', HOLE_R);
            circle.setAttribute('fill', 'rgba(255,255,255,0.85)');
            circle.setAttribute('stroke', 'rgba(0,0,0,0.1)');
            circle.setAttribute('stroke-width', '1.5');
            svg.appendChild(circle);
            holeCount++;
            if (holeCount >= num) break;
        }
        if (holeCount >= num) break;
    }

    return svg;
}

function drawShapeInSVG(svg, color, num, offsetX, offsetY, width, height) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const cols = num === 1 || num === 2 ? 1 : 2;
    const rows = Math.ceil(num / cols);
    const isOdd = num % 2 === 1 && num > 1;
    const r = CORNER_R;

    let path;
    if (isOdd) {
        const notchX = width - 28;
        const notchY = 28;
        path = `
            M ${offsetX + r} ${offsetY} L ${offsetX + notchX - r} ${offsetY}
            Q ${offsetX + notchX} ${offsetY} ${offsetX + notchX} ${offsetY + r}
            L ${offsetX + notchX} ${offsetY + notchY - r}
            Q ${offsetX + notchX} ${offsetY + notchY} ${offsetX + notchX + r} ${offsetY + notchY}
            L ${offsetX + width - r} ${offsetY + notchY}
            Q ${offsetX + width} ${offsetY + notchY} ${offsetX + width} ${offsetY + notchY + r}
            L ${offsetX + width} ${offsetY + height - r}
            Q ${offsetX + width} ${offsetY + height} ${offsetX + width - r} ${offsetY + height}
            L ${offsetX + r} ${offsetY + height}
            Q ${offsetX} ${offsetY + height} ${offsetX} ${offsetY + height - r}
            L ${offsetX} ${offsetY + r}
            Q ${offsetX} ${offsetY} ${offsetX + r} ${offsetY} Z`;
    } else {
        path = `
            M ${offsetX + r} ${offsetY} L ${offsetX + width - r} ${offsetY}
            Q ${offsetX + width} ${offsetY} ${offsetX + width} ${offsetY + r}
            L ${offsetX + width} ${offsetY + height - r}
            Q ${offsetX + width} ${offsetY + height} ${offsetX + width - r} ${offsetY + height}
            L ${offsetX + r} ${offsetY + height}
            Q ${offsetX} ${offsetY + height} ${offsetX} ${offsetY + height - r}
            L ${offsetX} ${offsetY + r}
            Q ${offsetX} ${offsetY} ${offsetX + r} ${offsetY} Z`;
    }

    const pathEl = document.createElementNS(svgNS, 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('fill', color);
    svg.appendChild(pathEl);

    let holeCount = 0;
    for (let row = 0; row < rows; row++) {
        const holesInRow = (isOdd && row === 0) ? 1 : cols;
        for (let col = 0; col < holesInRow; col++) {
            const cx = offsetX + PAD + HOLE_SPACING / 2 + col * HOLE_SPACING;
            const cy = offsetY + PAD + HOLE_SPACING / 2 + row * HOLE_SPACING;
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', HOLE_R);
            circle.setAttribute('fill', 'rgba(255,255,255,0.85)');
            circle.setAttribute('stroke', 'rgba(0,0,0,0.1)');
            circle.setAttribute('stroke-width', '1.5');
            svg.appendChild(circle);
            holeCount++;
            if (holeCount >= num) break;
        }
        if (holeCount >= num) break;
    }
}

function createCompositeSVG(number) {
    const tenShape = NUMICON_SHAPES[9];
    const remainder = number - 10;
    const remShape = NUMICON_SHAPES[remainder - 1];

    const tenCols = 2, tenRows = 5;
    const tenW = tenCols * HOLE_SPACING + PAD * 2;
    const tenH = tenRows * HOLE_SPACING + PAD * 2;

    const remCols = remainder === 1 || remainder === 2 ? 1 : 2;
    const remRows = Math.ceil(remainder / remCols);
    const remW = remCols * HOLE_SPACING + PAD * 2;
    const remH = remRows * HOLE_SPACING + PAD * 2;

    const totalW = tenW + remW - PAD;
    const totalH = Math.max(tenH, remH);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.setAttribute('aria-label', `Numicon composite shape for number ${number}`);
    svg.setAttribute('role', 'img');

    const tenOffsetY = totalH - tenH;
    drawShapeInSVG(svg, tenShape.color, 10, 0, tenOffsetY, tenW, tenH);

    const remOffsetX = tenW - PAD;
    const remOffsetY = totalH - remH;
    drawShapeInSVG(svg, remShape.color, remainder, remOffsetX, remOffsetY, remW, remH);

    return svg;
}

function createShapeForNumber(number) {
    if (number <= 10) {
        return createShapeSVG(NUMICON_SHAPES[number - 1]);
    }
    if (number <= 20) {
        return createCompositeSVG(number);
    }
    // For numbers > 20, show as 20 + remainder recursively
    // but cap at 20 for display purposes
    return createCompositeSVG(20);
}

// ============ PANEL ============

let PANEL_SCALE = 0.35;

function calculatePanelScale() {
    const panel = document.getElementById('panelShapes');
    const panelRect = panel.getBoundingClientRect();
    const availableW = panelRect.width;
    const availableH = panelRect.height;

    if (!availableW || !availableH) {
        PANEL_SCALE = 0.25;
        return;
    }

    const isMobile = window.innerWidth <= 768;
    const cols = isMobile ? 5 : 5;
    const rows = isMobile ? 4 : 4;

    // Tallest shape: 10-shape = 5*32 + 16 = 176, plus label ~18px, plus padding ~8px
    const maxShapeH = 176 + 26;
    // Widest composite shape (20 = 10+10 side by side): ~152
    const maxShapeW = 152;

    const cellW = (availableW - (cols - 1) * 8) / cols;
    const cellH = (availableH - (rows - 1) * 8) / rows;

    const scaleByW = cellW / maxShapeW;
    const scaleByH = cellH / maxShapeH;

    PANEL_SCALE = Math.min(scaleByW, scaleByH) * 0.9;
    PANEL_SCALE = Math.max(PANEL_SCALE, 0.1);
}

function renderPanel() {
    const panel = document.getElementById('panelShapes');
    panel.innerHTML = '';
    calculatePanelScale();

    for (let n = 1; n <= 20; n++) {
        const item = document.createElement('div');
        item.className = 'panel-shape';
        item.dataset.number = n;

        const svg = createShapeForNumber(n);
        const origW = parseInt(svg.getAttribute('width'));
        const origH = parseInt(svg.getAttribute('height'));
        svg.setAttribute('width', Math.round(origW * PANEL_SCALE));
        svg.setAttribute('height', Math.round(origH * PANEL_SCALE));

        const label = document.createElement('span');
        label.className = 'shape-label';
        label.textContent = n;

        item.appendChild(svg);
        item.appendChild(label);
        panel.appendChild(item);

        item.addEventListener('mousedown', (e) => startDragFromPanel(e, n));
        item.addEventListener('touchstart', (e) => startDragFromPanel(e, n), { passive: false });
    }
}

// ============ DRAG & DROP ============

function startDragFromPanel(e, number) {
    if (currentMode === 'quiz') return; // no dragging in quiz mode
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.appendChild(createShapeForNumber(number));
    document.body.appendChild(ghost);

    const svg = ghost.querySelector('svg');
    const ghostW = parseInt(svg.getAttribute('width'));
    const ghostH = parseInt(svg.getAttribute('height'));

    ghost.style.left = (clientX - ghostW / 2) + 'px';
    ghost.style.top = (clientY - ghostH / 2) + 'px';

    dragState = {
        number,
        ghost,
        offsetX: ghostW / 2,
        offsetY: ghostH / 2
    };
}

function onDragMove(e) {
    if (!dragState) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    dragState.ghost.style.left = (clientX - dragState.offsetX) + 'px';
    dragState.ghost.style.top = (clientY - dragState.offsetY) + 'px';
}

function onDragEnd(e) {
    if (!dragState) return;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    dragState.ghost.remove();

    // Check if dropped on the learn drop zone
    const dropZone = document.getElementById('learnDropZone');
    if (dropZone) {
        const rect = dropZone.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            addLearnShape(dragState.number);
        }
    }

    dragState = null;
}

document.addEventListener('mousemove', onDragMove);
document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchmove', onDragMove, { passive: false });
document.addEventListener('touchend', onDragEnd);

// ============ LEARN MODE ============

function addLearnShape(number) {
    if (learnShapes.length >= 2) return; // max 2 shapes
    learnShapes.push(number);
    renderLearnMode();
}

function removeLearnShape(index) {
    learnShapes.splice(index, 1);
    renderLearnMode();
}

function renderLearnMode() {
    const dropZone = document.getElementById('learnDropZone');
    const sumDisplay = document.getElementById('sumDisplay');
    const hint = document.getElementById('workspaceHint');

    dropZone.innerHTML = '';

    if (learnShapes.length === 0) {
        hint.classList.remove('hidden');
        hint.querySelector('p').textContent = currentOperation === 'sum'
            ? 'Drag 2 shapes here to see their sum'
            : 'Drag 2 shapes here to compare them';
        sumDisplay.classList.remove('visible');
        sumDisplay.innerHTML = '';
        return;
    }

    hint.classList.add('hidden');

    // Calculate scale to fit shapes inside drop zone
    const zoneRect = dropZone.getBoundingClientRect();
    const maxShapeW = 152; // widest composite shape
    const maxShapeH = 176; // tallest shape (10)
    const numShapes = learnShapes.length;
    const gapSpace = numShapes > 1 ? 80 : 0; // space for + sign and gaps

    const availW = zoneRect.width - 64; // padding
    const availH = zoneRect.height - 64;

    let learnScale = 1;
    if (availW > 0 && availH > 0) {
        const scaleByW = (availW - gapSpace) / (numShapes * maxShapeW);
        const scaleByH = availH / maxShapeH;
        learnScale = Math.min(scaleByW, scaleByH, 1);
        learnScale = Math.max(learnScale, 0.3);
    }

    // Render dropped shapes with operator between them
    learnShapes.forEach((num, i) => {
        const shapeWrapper = document.createElement('div');
        shapeWrapper.className = 'learn-shape';

        const svg = createShapeForNumber(num);
        const origW = parseInt(svg.getAttribute('width'));
        const origH = parseInt(svg.getAttribute('height'));
        svg.setAttribute('width', Math.round(origW * learnScale));
        svg.setAttribute('height', Math.round(origH * learnScale));
        shapeWrapper.appendChild(svg);

        const numLabel = document.createElement('span');
        numLabel.className = 'learn-shape-number';
        numLabel.textContent = num;
        shapeWrapper.appendChild(numLabel);

        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.textContent = '×';
        del.addEventListener('click', () => removeLearnShape(i));
        shapeWrapper.appendChild(del);

        dropZone.appendChild(shapeWrapper);

        if (i < learnShapes.length - 1) {
            const op = document.createElement('span');
            op.className = 'plus-sign';
            if (currentOperation === 'sum') {
                op.textContent = '+';
            } else if (learnShapes.length === 2) {
                const a = learnShapes[0];
                const b = learnShapes[1];
                op.textContent = a > b ? '>' : a < b ? '<' : '=';
            } else {
                op.textContent = '?';
            }
            dropZone.appendChild(op);
        }
    });

    // Show result if 2 shapes
    if (learnShapes.length === 2) {
        sumDisplay.classList.add('visible');
        sumDisplay.innerHTML = '';

        if (currentOperation === 'sum') {
            const total = learnShapes[0] + learnShapes[1];
            const text = document.createElement('span');
            text.className = 'sum-text';
            text.textContent = `${learnShapes[0]} + ${learnShapes[1]} = ${total}`;
            sumDisplay.appendChild(text);

            if (total <= 20) {
                const shapeContainer = document.createElement('span');
                shapeContainer.className = 'sum-shape';
                const resultSvg = createShapeForNumber(total);
                const origW = parseInt(resultSvg.getAttribute('width'));
                const origH = parseInt(resultSvg.getAttribute('height'));
                resultSvg.setAttribute('width', Math.round(origW * 0.6));
                resultSvg.setAttribute('height', Math.round(origH * 0.6));
                shapeContainer.appendChild(resultSvg);
                sumDisplay.appendChild(shapeContainer);
            }
        } else {
            // Compare mode
            const a = learnShapes[0];
            const b = learnShapes[1];
            const text = document.createElement('span');
            text.className = 'sum-text';
            const sign = a > b ? '>' : a < b ? '<' : '=';
            text.textContent = `${a} ${sign} ${b}`;
            sumDisplay.appendChild(text);
        }
    } else {
        sumDisplay.classList.remove('visible');
        sumDisplay.innerHTML = '';
    }
}

// ============ QUIZ MODE ============

let quizAnswer = null;
let quizAnswered = false;

function generateQuizQuestion() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    quizAnswered = false;

    const questionEl = document.getElementById('quizQuestion');
    const choicesEl = document.getElementById('quizChoices');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('quizNext');

    feedbackEl.textContent = '';
    feedbackEl.className = 'quiz-feedback';
    nextBtn.classList.remove('visible');

    questionEl.innerHTML = '';

    const shapeA = document.createElement('div');
    shapeA.className = 'quiz-shape-wrapper';
    shapeA.appendChild(createShapeForNumber(a));
    const labelA = document.createElement('span');
    labelA.className = 'quiz-shape-number';
    labelA.textContent = a;
    shapeA.appendChild(labelA);
    questionEl.appendChild(shapeA);

    if (currentOperation === 'sum') {
        quizAnswer = a + b;

        const op = document.createElement('span');
        op.className = 'quiz-operator';
        op.textContent = '+';
        questionEl.appendChild(op);

        const shapeB = document.createElement('div');
        shapeB.className = 'quiz-shape-wrapper';
        shapeB.appendChild(createShapeForNumber(b));
        const labelB = document.createElement('span');
        labelB.className = 'quiz-shape-number';
        labelB.textContent = b;
        shapeB.appendChild(labelB);
        questionEl.appendChild(shapeB);

        const eq = document.createElement('span');
        eq.className = 'quiz-operator';
        eq.textContent = '= ?';
        questionEl.appendChild(eq);

        // Generate choices (correct + 3 wrong)
        const choices = new Set([quizAnswer]);
        while (choices.size < 4) {
            let wrong = quizAnswer + Math.floor(Math.random() * 7) - 3;
            if (wrong < 2) wrong = 2;
            if (wrong > 20) wrong = 20;
            if (wrong !== quizAnswer) choices.add(wrong);
        }

        const shuffled = [...choices].sort(() => Math.random() - 0.5);

        choicesEl.innerHTML = '';
        shuffled.forEach(num => {
            const choice = document.createElement('div');
            choice.className = 'quiz-choice';
            choice.dataset.value = num;

            const svg = createShapeForNumber(num);
            const origW = parseInt(svg.getAttribute('width'));
            const origH = parseInt(svg.getAttribute('height'));
            svg.setAttribute('width', Math.round(origW * 0.65));
            svg.setAttribute('height', Math.round(origH * 0.65));
            choice.appendChild(svg);

            const label = document.createElement('span');
            label.className = 'choice-label';
            label.textContent = num;
            choice.appendChild(label);

            choice.addEventListener('click', () => handleQuizAnswer(num, choice));
            choicesEl.appendChild(choice);
        });
    } else {
        // Compare mode quiz: pick the correct sign
        quizAnswer = a > b ? '>' : a < b ? '<' : '=';

        const op = document.createElement('span');
        op.className = 'quiz-operator';
        op.textContent = '?';
        questionEl.appendChild(op);

        const shapeB = document.createElement('div');
        shapeB.className = 'quiz-shape-wrapper';
        shapeB.appendChild(createShapeForNumber(b));
        const labelB = document.createElement('span');
        labelB.className = 'quiz-shape-number';
        labelB.textContent = b;
        shapeB.appendChild(labelB);
        questionEl.appendChild(shapeB);

        const signs = ['<', '=', '>'];
        choicesEl.innerHTML = '';
        signs.forEach(sign => {
            const choice = document.createElement('div');
            choice.className = 'quiz-choice quiz-choice-sign';
            choice.dataset.value = sign;

            const label = document.createElement('span');
            label.className = 'choice-sign-label';
            label.textContent = sign;
            choice.appendChild(label);

            choice.addEventListener('click', () => handleQuizAnswer(sign, choice));
            choicesEl.appendChild(choice);
        });
    }

    updateQuizScore();
}

function handleQuizAnswer(selected, choiceEl) {
    if (quizAnswered) return;
    quizAnswered = true;
    quizTotal++;

    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('quizNext');
    const allChoices = document.querySelectorAll('.quiz-choice');

    const isCorrect = String(selected) === String(quizAnswer);

    if (isCorrect) {
        quizScore++;
        choiceEl.classList.add('correct');
        feedbackEl.textContent = '✓ Correct!';
        feedbackEl.className = 'quiz-feedback correct';
    } else {
        choiceEl.classList.add('wrong');
        allChoices.forEach(c => {
            if (c.dataset.value === String(quizAnswer)) {
                c.classList.add('correct');
            }
        });
        feedbackEl.textContent = `✗ The answer is ${quizAnswer}`;
        feedbackEl.className = 'quiz-feedback wrong';
    }

    nextBtn.classList.add('visible');

    // In compare mode, replace the ? with the correct sign
    if (currentOperation === 'compare') {
        const operators = document.querySelectorAll('#quizQuestion .quiz-operator');
        operators.forEach(op => {
            if (op.textContent === '?') {
                op.textContent = quizAnswer;
            }
        });
    }
    updateQuizScore();
}

function updateQuizScore() {
    const scoreEl = document.getElementById('quizScore');
    if (quizTotal === 0) {
        scoreEl.textContent = '';
    } else {
        scoreEl.textContent = `Score: ${quizScore} / ${quizTotal}`;
    }
}

// ============ MODE SWITCHING ============

function switchMode(mode) {
    currentMode = mode;

    document.getElementById('learnBtn').classList.toggle('active', mode === 'learn');
    document.getElementById('quizBtn').classList.toggle('active', mode === 'quiz');

    document.getElementById('learnMode').classList.toggle('hidden', mode !== 'learn');
    document.getElementById('quizMode').classList.toggle('hidden', mode !== 'quiz');
    document.getElementById('clearBtn').classList.toggle('hidden', mode !== 'learn');
    document.getElementById('operationToggle').classList.toggle('hidden', false);

    if (mode === 'quiz') {
        generateQuizQuestion();
    }
}

function switchOperation(op) {
    currentOperation = op;
    document.getElementById('sumBtn').classList.toggle('active', op === 'sum');
    document.getElementById('compareBtn').classList.toggle('active', op === 'compare');
    renderLearnMode();
    if (currentMode === 'quiz') {
        quizScore = 0;
        quizTotal = 0;
        generateQuizQuestion();
    }
}

function clearLearn() {
    learnShapes = [];
    renderLearnMode();
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        renderPanel();
        renderLearnMode();
    });

    document.getElementById('learnBtn').addEventListener('click', () => switchMode('learn'));
    document.getElementById('quizBtn').addEventListener('click', () => switchMode('quiz'));
    document.getElementById('sumBtn').addEventListener('click', () => switchOperation('sum'));
    document.getElementById('compareBtn').addEventListener('click', () => switchOperation('compare'));
    document.getElementById('clearBtn').addEventListener('click', clearLearn);
    document.getElementById('quizNext').addEventListener('click', generateQuizQuestion);

    window.addEventListener('resize', () => requestAnimationFrame(renderPanel));
});
