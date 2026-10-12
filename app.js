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
let currentOperation = 'sum'; // 'sum', 'subtract', or 'compare'
let currentShapeStyle = 'numberblocks'; // 'numicon' or 'numberblocks'
let dragState = null;
let quizScore = 0;
let quizTotal = 0;

// Colors used for the Numicon shapes (0-10)
const NUMBER_COLORS = {
    0: '#cbd5e0',
    1: '#e87c2a',
    2: '#2b7de0',
    3: '#7ec8e3',
    4: '#2e8b57',
    5: '#dc3545',
    6: '#f5c542',
    7: '#e75480',
    8: '#a0522d',
    9: '#1a3a6b',
    10: '#b8b8b8'
};

// Numberblocks series colors for the solid-color numbers (1-6, 8).
// 7 (rainbow), 9 (three greys) and 10 (white, red border) are handled
// specially in blockColorsForNumber because they are not a single color.
// Palette based on the widely used Numberblocks community pixel-art hex codes.
const NUMBERBLOCK_COLORS = {
    1: '#ff1a1a', // red
    2: '#ff8c00', // orange
    3: '#ffe000', // yellow
    4: '#00c000', // green
    5: '#00b4ff', // blue
    6: '#8a2be2', // indigo
    8: '#ff4fa3'  // magenta / pink
};

// The seven rainbow block colors Numberblock Seven is made of (bottom to top).
const SEVEN_RAINBOW = ['#ff1a1a', '#ff8c00', '#ffe000', '#00c000', '#00b4ff', '#8a2be2', '#c030e0'];
// Nine's three shades of grey, grouped in threes (bottom to top).
const NINE_GREYS = ['#9aa0a6', '#c2c7cc', '#e4e7ea'];

const TEN_BLOCK_FILL = '#ffffff';
const TEN_BLOCK_BORDER = '#ff1a1a'; // ten blocks are white with a red border
const DEFAULT_BORDER = 'rgba(0,0,0,0.25)';

// Colors for the "ones" part (1-9). Reuses the single-digit palette.
function onesColor(d) {
    if (d === 7) return SEVEN_RAINBOW; // array: handled per block
    if (d === 9) return NINE_GREYS;    // array: handled per block
    return NUMBERBLOCK_COLORS[d] || '#888888';
}

// Returns an array of per-block fill colors (bottom -> top) for a Numberblock.
function blockColorsForNumber(n) {
    if (n === 7) {
        return SEVEN_RAINBOW.slice();
    }
    if (n === 9) {
        // Three blocks of each grey shade.
        const out = [];
        for (let i = 0; i < 9; i++) out.push(NINE_GREYS[Math.floor(i / 3)]);
        return out;
    }
    if (n === 10) {
        return Array.from({ length: 10 }, () => TEN_BLOCK_FILL);
    }
    if (n > 10) {
        // 11-20: a full ten (white blocks) plus the remainder in the ones color.
        const ones = n - 10;
        const tenPart = Array.from({ length: 10 }, () => TEN_BLOCK_FILL);
        if (ones === 10) {
            // 20 is two tens: all white.
            return tenPart.concat(Array.from({ length: 10 }, () => TEN_BLOCK_FILL));
        }
        const oc = onesColor(ones);
        let onesPart;
        if (Array.isArray(oc)) {
            // 17 or 19: remainder blocks follow the special per-block palette.
            onesPart = [];
            for (let i = 0; i < ones; i++) {
                onesPart.push(ones === 9
                    ? NINE_GREYS[Math.floor(i / 3)]
                    : SEVEN_RAINBOW[i]);
            }
        } else {
            onesPart = Array.from({ length: ones }, () => oc);
        }
        return tenPart.concat(onesPart);
    }
    const base = NUMBERBLOCK_COLORS[n] || '#888888';
    return Array.from({ length: n }, () => base);
}

// Returns per-block border info (bottom -> top): the ten-block part gets a
// red border, the ones part gets the default subtle border.
function blockBordersForNumber(n) {
    const makeBorder = isTen => ({
        color: isTen ? TEN_BLOCK_BORDER : DEFAULT_BORDER,
        width: isTen ? 2.5 : 1.5
    });
    if (n === 10) {
        return Array.from({ length: 10 }, () => makeBorder(true));
    }
    if (n > 10) {
        const ones = n - 10;
        const tenPart = Array.from({ length: 10 }, () => makeBorder(true));
        const onesIsTen = ones === 10; // 20: second ten is also a ten block
        const onesPart = Array.from({ length: ones }, () => makeBorder(onesIsTen));
        return tenPart.concat(onesPart);
    }
    return Array.from({ length: n }, () => makeBorder(false));
}

// How a Numberblock's cubes are split across columns (bottom-to-top,
// left-to-right). Each entry is the number of cubes in that column.
// Matches the shapes used in the series for these numbers.
function blockColumnLayout(n) {
    switch (n) {
        case 4: return [2, 2];       // 2x2
        case 6: return [3, 3];       // 2x3
        case 8: return [4, 4];       // 2x4
        case 9: return [3, 3, 3];    // 3x3
        case 10: return [5, 5];      // 2x5, like the Numicon ten
        default:
            if (n > 10) {
                // 11-20: the ten renders as a 2x5 block (two columns of 5),
                // like the Numicon ten. The remainder reuses the standalone
                // layout of its ones digit, so e.g. 16 looks like 10 + 6,
                // 19 looks like 10 + 9, etc.
                if (n === 20) return [5, 5, 5, 5]; // two 2x5 tens
                return [5, 5, ...blockColumnLayout(n - 10)];
            }
            return [n]; // single column stack (1,2,3,5,7)
    }
}

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
    if (currentShapeStyle === 'numberblocks') {
        return createNumberblockSVG(number);
    }
    if (number === 0) {
        return createZeroSVG();
    }
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

// ============ ZERO SHAPE (Numicon style) ============

function createZeroSVG() {
    // An empty, flat tile with a dashed outline to represent "nothing".
    const svgNS = 'http://www.w3.org/2000/svg';
    const width = HOLE_SPACING + PAD * 2;
    const height = HOLE_SPACING + PAD * 2;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', 'Numicon shape for number 0 (empty)');
    svg.setAttribute('role', 'img');

    const r = CORNER_R;
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 1.5);
    rect.setAttribute('y', 1.5);
    rect.setAttribute('width', width - 3);
    rect.setAttribute('height', height - 3);
    rect.setAttribute('rx', r);
    rect.setAttribute('fill', 'rgba(203,213,224,0.25)');
    rect.setAttribute('stroke', NUMBER_COLORS[0]);
    rect.setAttribute('stroke-width', '3');
    rect.setAttribute('stroke-dasharray', '6 5');
    svg.appendChild(rect);

    return svg;
}

// ============ NUMBERBLOCKS STYLE ============

// Renders a number as a stack of unit cubes (Numberblocks style):
// a single column of 1x1 blocks with a simple face on the top block.
function createNumberblockSVG(number) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const CUBE = 34; // size of one cube in px

    if (number === 0) {
        // Zero: a flat dashed outline, no cubes.
        const width = CUBE + PAD * 2;
        const height = CUBE + PAD * 2;
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('aria-label', 'Numberblocks figure for number 0 (empty)');
        svg.setAttribute('role', 'img');

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', 1.5);
        rect.setAttribute('y', 1.5);
        rect.setAttribute('width', width - 3);
        rect.setAttribute('height', height - 3);
        rect.setAttribute('rx', 4);
        rect.setAttribute('fill', 'rgba(203,213,224,0.25)');
        rect.setAttribute('stroke', NUMBER_COLORS[0]);
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('stroke-dasharray', '6 5');
        svg.appendChild(rect);
        return svg;
    }

    const n = Math.min(number, 20);
    const blockColors = blockColorsForNumber(n);
    const blockBorders = blockBordersForNumber(n);
    const layout = blockColumnLayout(n); // cubes per column, left to right

    const cols = layout.length;
    const rowsTall = Math.max(...layout);
    const width = cols * CUBE + PAD * 2;
    const height = rowsTall * CUBE + PAD * 2;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', `Numberblocks figure for number ${number}`);
    svg.setAttribute('role', 'img');

    // Place blocks column by column, bottom to top. The face goes on the
    // topmost block of the first (leftmost) column, which reads as the head.
    let placed = 0;
    const faceCol = 0;
    const firstColCount = layout[0];
    for (let col = 0; col < cols; col++) {
        const cubesInCol = layout[col];
        for (let i = 0; i < cubesInCol; i++) {
            const x = PAD + col * CUBE;
            // Stack upward: the first cube in a column sits at the bottom.
            const y = height - PAD - (i + 1) * CUBE;

            const border = blockBorders[placed] || { color: DEFAULT_BORDER, width: 1.5 };
            const cube = document.createElementNS(svgNS, 'rect');
            cube.setAttribute('x', x);
            cube.setAttribute('y', y);
            cube.setAttribute('width', CUBE);
            cube.setAttribute('height', CUBE);
            cube.setAttribute('fill', blockColors[placed] || blockColors[blockColors.length - 1]);
            cube.setAttribute('stroke', border.color);
            cube.setAttribute('stroke-width', border.width);
            svg.appendChild(cube);

            if (col === faceCol && i === firstColCount - 1) {
                addNumberblockFace(svg, x, y, CUBE);
            }
            placed++;
        }
    }

    return svg;
}

function addNumberblockFace(svg, x, y, cube) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const eyeR = cube * 0.09;
    const eyeY = y + cube * 0.4;

    [x + cube * 0.33, x + cube * 0.67].forEach(ex => {
        const eyeWhite = document.createElementNS(svgNS, 'circle');
        eyeWhite.setAttribute('cx', ex);
        eyeWhite.setAttribute('cy', eyeY);
        eyeWhite.setAttribute('r', eyeR * 1.8);
        eyeWhite.setAttribute('fill', 'white');
        eyeWhite.setAttribute('stroke', 'rgba(0,0,0,0.3)');
        eyeWhite.setAttribute('stroke-width', '1');
        svg.appendChild(eyeWhite);

        const pupil = document.createElementNS(svgNS, 'circle');
        pupil.setAttribute('cx', ex);
        pupil.setAttribute('cy', eyeY);
        pupil.setAttribute('r', eyeR);
        pupil.setAttribute('fill', '#1a202c');
        svg.appendChild(pupil);
    });

    // Simple smile.
    const smile = document.createElementNS(svgNS, 'path');
    const sy = y + cube * 0.62;
    smile.setAttribute('d', `M ${x + cube * 0.3} ${sy} Q ${x + cube * 0.5} ${sy + cube * 0.18} ${x + cube * 0.7} ${sy}`);
    smile.setAttribute('fill', 'none');
    smile.setAttribute('stroke', '#1a202c');
    smile.setAttribute('stroke-width', '2');
    smile.setAttribute('stroke-linecap', 'round');
    svg.appendChild(smile);
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

    const cols = 5;
    const rows = Math.ceil(21 / cols); // numbers 0-20

    // Tallest shape depends on style. Numicon: 10-shape = 5*32 + 16 = 176.
    // Numberblocks: Seven is a single column of 7 cubes = 7*34 + 16 = 254.
    // Use the taller of the two so neither style overflows its cell.
    const tallestShapeH = currentShapeStyle === 'numberblocks' ? 254 : 176;
    const maxShapeH = tallestShapeH + 26; // plus label + padding
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

    for (let n = 0; n <= 20; n++) {
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

    // Check if dropped on the workspace (entire area, not just drop zone)
    if (currentMode === 'learn') {
        const workspace = document.getElementById('workspace');
        const rect = workspace.getBoundingClientRect();
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

    // Remove everything except the hint
    Array.from(dropZone.children).forEach(child => {
        if (child !== hint) child.remove();
    });

    if (learnShapes.length === 0) {
        hint.classList.remove('hidden');
        let hintText;
        if (currentOperation === 'sum') {
            hintText = 'Drag 2 shapes here to see their sum';
        } else if (currentOperation === 'subtract') {
            hintText = 'Drag 2 shapes here to subtract them';
        } else {
            hintText = 'Drag 2 shapes here to compare them';
        }
        hint.querySelector('p').textContent = hintText;
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
        learnScale = Math.min(scaleByW, scaleByH, 1.5);
        learnScale = Math.max(learnScale, 0.3);
    }

    // Build display items that remember their original index so removal
    // stays correct even when we reorder for subtraction.
    let displayItems = learnShapes.map((num, idx) => ({ num, idx }));
    // For subtraction we always show the larger number first so the
    // result is never negative, regardless of the order shapes were dropped.
    if (currentOperation === 'subtract' && displayItems.length === 2) {
        displayItems.sort((a, b) => b.num - a.num);
    }

    // Render dropped shapes with operator between them
    displayItems.forEach((entry, i) => {
        const num = entry.num;
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
        del.addEventListener('click', () => removeLearnShape(entry.idx));
        shapeWrapper.appendChild(del);

        dropZone.appendChild(shapeWrapper);

        if (i < displayItems.length - 1) {
            const op = document.createElement('span');
            op.className = 'plus-sign';
            if (currentOperation === 'sum') {
                op.textContent = '+';
            } else if (currentOperation === 'subtract') {
                op.textContent = '−';
            } else if (displayItems.length === 2) {
                const a = displayItems[0].num;
                const b = displayItems[1].num;
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
                resultSvg.setAttribute('width', Math.round(origW * 1.0));
                resultSvg.setAttribute('height', Math.round(origH * 1.0));
                shapeContainer.appendChild(resultSvg);
                sumDisplay.appendChild(shapeContainer);
            }
        } else if (currentOperation === 'subtract') {
            // Always subtract the smaller number from the larger one so the
            // result is never negative.
            const big = Math.max(learnShapes[0], learnShapes[1]);
            const small = Math.min(learnShapes[0], learnShapes[1]);
            const diff = big - small;
            const text = document.createElement('span');
            text.className = 'sum-text';
            text.textContent = `${big} − ${small} = ${diff}`;
            sumDisplay.appendChild(text);

            const shapeContainer = document.createElement('span');
            shapeContainer.className = 'sum-shape';
            const resultSvg = createShapeForNumber(diff);
            shapeContainer.appendChild(resultSvg);
            sumDisplay.appendChild(shapeContainer);
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
    // Operands span 0-20 (0 included so zero shows up in quizzes too).
    let a, b;
    if (currentOperation === 'sum') {
        // Any operands, but keep the result within 0-20.
        a = Math.floor(Math.random() * 21); // 0-20
        b = Math.floor(Math.random() * (21 - a)); // 0..(20 - a)
    } else if (currentOperation === 'subtract') {
        // Any operands up to 20; show the larger first so the result is >= 0.
        a = Math.floor(Math.random() * 21); // 0-20
        b = Math.floor(Math.random() * 21); // 0-20
        if (b > a) {
            [a, b] = [b, a];
        }
    } else {
        // Compare: any two numbers 0-20.
        a = Math.floor(Math.random() * 21);
        b = Math.floor(Math.random() * 21);
    }
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

    if (currentOperation === 'sum' || currentOperation === 'subtract') {
        quizAnswer = currentOperation === 'sum' ? a + b : a - b;

        const op = document.createElement('span');
        op.className = 'quiz-operator';
        op.textContent = currentOperation === 'sum' ? '+' : '−';
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
        let guard = 0;
        while (choices.size < 4 && guard < 100) {
            guard++;
            let wrong = quizAnswer + Math.floor(Math.random() * 7) - 3;
            if (wrong < 0) wrong = 0;
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
    document.getElementById('operationToggle').classList.toggle('hidden', false);

    if (mode === 'quiz') {
        generateQuizQuestion();
    }
}

function switchOperation(op) {
    currentOperation = op;
    document.getElementById('sumBtn').classList.toggle('active', op === 'sum');
    document.getElementById('subtractBtn').classList.toggle('active', op === 'subtract');
    document.getElementById('compareBtn').classList.toggle('active', op === 'compare');
    renderLearnMode();
    if (currentMode === 'quiz') {
        quizScore = 0;
        quizTotal = 0;
        generateQuizQuestion();
    }
}

function switchShapeStyle(style) {
    currentShapeStyle = style;
    document.getElementById('numiconBtn').classList.toggle('active', style === 'numicon');
    document.getElementById('numberblocksBtn').classList.toggle('active', style === 'numberblocks');

    // Re-render everything currently on screen with the new style.
    renderPanel();
    renderLearnMode();
    if (currentMode === 'quiz') {
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

    document.getElementById('learnBtn')?.addEventListener('click', () => switchMode('learn'));
    document.getElementById('quizBtn')?.addEventListener('click', () => switchMode('quiz'));
    document.getElementById('sumBtn')?.addEventListener('click', () => switchOperation('sum'));
    document.getElementById('subtractBtn')?.addEventListener('click', () => switchOperation('subtract'));
    document.getElementById('compareBtn')?.addEventListener('click', () => switchOperation('compare'));
    document.getElementById('numiconBtn')?.addEventListener('click', () => switchShapeStyle('numicon'));
    document.getElementById('numberblocksBtn')?.addEventListener('click', () => switchShapeStyle('numberblocks'));
    document.getElementById('quizNext')?.addEventListener('click', generateQuizQuestion);

    window.addEventListener('resize', () => requestAnimationFrame(renderPanel));
});
