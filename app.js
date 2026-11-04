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
let maxOperand = 10; // largest operand value for the sum quiz (slider: 1-20, step 1)
const SUM_DISPLAY_MAX_H = 120; // bounded height of the learn-mode result shape

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

// Shared renderer for both learn and quiz: lays out a row of numbered shapes
// with operators between them inside `dropZone`, scaled to fit the zone. Both
// modes use the identical drop-zone container and this identical scaling, so
// the question/expression looks and behaves the same in each.
//
// items: [{ num, op }] where `op` is the operator string shown AFTER the shape
//        (null for the last item). num > 20 renders as a bare number.
// opts:  { reservedBelow, onDelete }
//        reservedBelow - px height taken by content below the zone (sum result
//                        in learn, choices+bottom in quiz) so shapes fit above.
//        onDelete      - if given, each shape gets a delete button calling it
//                        with the item's index (learn mode only).
function renderShapeRow(dropZone, items, opts = {}) {
    const { reservedBelow = 0, onDelete = null } = opts;

    // Clear everything except a .workspace-hint child, if present.
    Array.from(dropZone.children).forEach(child => {
        if (!child.classList || !child.classList.contains('workspace-hint')) {
            child.remove();
        }
    });

    // Measure the real intrinsic sizes so we can scale to fit exactly.
    items.forEach(it => {
        if (it.num <= 20) {
            it.svg = createShapeForNumber(it.num);
            it.w = parseInt(it.svg.getAttribute('width')) || 1;
            it.h = parseInt(it.svg.getAttribute('height')) || 1;
        } else {
            it.svg = null;        // bare number tile
            it.w = 120;           // nominal width for a number tile
            it.h = 120;
        }
    });

    const ZONE_PADDING = 70;         // zone padding + border (both sides)
    const TOP_SPACE = 16;            // delete button / breathing room at top
    const LABEL_H = 1.6 * 16 + 8;    // number label height at scale = 1

    const maxShapeH = items.reduce((max, e) => Math.max(max, e.h), 1);

    // (Re)build every row element at a given scale. Returns nothing; callers
    // measure the result and may rebuild at a corrected scale.
    function buildAtScale(scale) {
        Array.from(dropZone.children).forEach(child => {
            if (!child.classList || !child.classList.contains('workspace-hint')) {
                child.remove();
            }
        });
        // Shared box height = tallest scaled shape, so all shapes center on one
        // band and their labels line up; operators center on the same band.
        const boxHeight = Math.round(maxShapeH * scale);

        items.forEach((it) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'shape-item';

            const box = document.createElement('div');
            box.className = 'shape-item-box';
            box.style.height = `${boxHeight}px`;

            // Inner element that shrink-wraps the actual shape; it is the
            // positioning context for the delete button so the button anchors
            // to the real shape corner, not the taller shared box.
            const shapeInner = document.createElement('span');
            shapeInner.className = 'shape-item-shape';

            if (it.svg) {
                it.svg.setAttribute('width', Math.round(it.w * scale));
                it.svg.setAttribute('height', Math.round(it.h * scale));
                shapeInner.appendChild(it.svg);
            } else {
                box.classList.add('shape-item-box-number');
                box.style.fontSize = `${(3 * scale).toFixed(2)}rem`;
                shapeInner.textContent = it.num;
            }

            if (onDelete) {
                const del = document.createElement('button');
                del.className = 'delete-btn';
                del.textContent = '×';
                del.addEventListener('click', () => onDelete(it.idx));
                shapeInner.appendChild(del);
            }

            box.appendChild(shapeInner);
            wrapper.appendChild(box);

            const label = document.createElement('span');
            label.className = 'shape-item-number';
            label.textContent = it.num;
            label.style.fontSize = `${(1.6 * scale).toFixed(2)}rem`;
            wrapper.appendChild(label);

            dropZone.appendChild(wrapper);

            if (it.op != null) {
                // The operator mirrors the shape-item column (glyph box +
                // label-height spacer) so it centers on the shape band.
                const opWrap = document.createElement('div');
                opWrap.className = 'shape-item-op-wrap';

                const glyph = document.createElement('span');
                glyph.className = 'shape-item-operator';
                glyph.style.fontSize = `${(2 * scale).toFixed(2)}rem`;
                glyph.style.height = `${boxHeight}px`;
                glyph.textContent = it.op;
                opWrap.appendChild(glyph);

                const spacer = document.createElement('span');
                spacer.className = 'shape-item-number';
                spacer.style.fontSize = `${(1.6 * scale).toFixed(2)}rem`;
                spacer.textContent = '\u00A0';
                spacer.setAttribute('aria-hidden', 'true');
                opWrap.appendChild(spacer);

                dropZone.appendChild(opWrap);
            }
        });
    }

    // First pass: an estimate to get close, then measure the ACTUAL rendered
    // row and correct the scale exactly so nothing overflows the zone. This
    // avoids relying on hand-tuned operator-width guesses.
    const areaRect = dropZone.getBoundingClientRect();
    const availW = areaRect.width - ZONE_PADDING;
    const availH = areaRect.height - ZONE_PADDING - TOP_SPACE - reservedBelow;
    if (availW <= 0 || availH <= 0) { buildAtScale(1); return 1; }

    // Start from the height-based estimate (height has no wrapping surprises).
    let scale = Math.min(availH / (maxShapeH + LABEL_H), 2.5);
    scale = Math.max(scale, 0.1);
    buildAtScale(scale);

    // Correct for width: measure the actual rendered row (sum of child widths
    // plus the flex gaps) and shrink proportionally if it exceeds the zone's
    // inner width. More reliable than scrollWidth for a centered flex row.
    const ROW_GAP = 24; // 1.5rem flex gap
    const kids = Array.from(dropZone.children).filter(c =>
        !c.classList || !c.classList.contains('workspace-hint'));
    const contentW = kids.reduce((sum, c) => sum + c.offsetWidth, 0)
        + Math.max(0, kids.length - 1) * ROW_GAP;
    const innerW = dropZone.clientWidth - (ZONE_PADDING - 6); // minus padding
    if (contentW > innerW && innerW > 0) {
        scale = Math.max(0.1, scale * (innerW / contentW) * 0.98); // small margin
        buildAtScale(scale);
    }

    return scale;
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

    // Build display items that remember their original index so removal
    // stays correct even when we reorder for subtraction.
    let displayItems = learnShapes.map((num, idx) => ({ num, idx }));
    // For subtraction we always show the larger number first so the
    // result is never negative, regardless of the order shapes were dropped.
    if (currentOperation === 'subtract' && displayItems.length === 2) {
        displayItems.sort((a, b) => b.num - a.num);
    }

    // Attach the operator shown after each shape (none after the last).
    displayItems.forEach((it, i) => {
        if (i === displayItems.length - 1) { it.op = null; return; }
        if (currentOperation === 'sum') it.op = '+';
        else if (currentOperation === 'subtract') it.op = '−';
        else if (displayItems.length === 2) {
            const d = displayItems[0].num - displayItems[1].num;
            it.op = d > 0 ? '>' : d < 0 ? '<' : '=';
        } else it.op = '?';
    });

    // Reserve the (bounded) sum-display height below the zone when a result
    // shows, then render the shape row with the shared renderer.
    const reservedBelow = learnShapes.length === 2 ? SUM_DISPLAY_MAX_H + 24 : 0;
    renderShapeRow(dropZone, displayItems, {
        reservedBelow,
        onDelete: removeLearnShape,
    });

    // Builds the result shape for the sum-display, capped to a bounded height
    // so the sum-display never grows unpredictably and pushes the drop zone
    // (and its shapes) into overflow.
    const makeResultShape = (n) => {
        const shapeContainer = document.createElement('span');
        shapeContainer.className = 'sum-shape';
        const resultSvg = createShapeForNumber(n);
        const origW = parseInt(resultSvg.getAttribute('width')) || 1;
        const origH = parseInt(resultSvg.getAttribute('height')) || 1;
        const cap = Math.min(1, SUM_DISPLAY_MAX_H / origH);
        resultSvg.setAttribute('width', Math.round(origW * cap));
        resultSvg.setAttribute('height', Math.round(origH * cap));
        shapeContainer.appendChild(resultSvg);
        return shapeContainer;
    };

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
                sumDisplay.appendChild(makeResultShape(total));
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

            sumDisplay.appendChild(makeResultShape(diff));
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
    // Each operand is drawn uniformly and independently so every number in its
    // range is equally likely to appear as a tile.
    const randTo = (max) => Math.floor(Math.random() * (max + 1)); // 0..max
    let a, b;
    if (currentOperation === 'sum') {
        // Sum caps each operand at maxOperand (the slider value). Both operands
        // are uniform over 0..maxOperand with no cross-operand constraint, so
        // 0 and maxOperand are exactly as likely as any value between them.
        // The sum then ranges 0..2*maxOperand and renders as a plain number
        // when it exceeds 20.
        a = randTo(maxOperand);
        b = randTo(maxOperand);
    } else if (currentOperation === 'subtract') {
        // Operands uniform over 0..maxOperand. Re-roll until b <= a so the
        // difference is non-negative, without swapping (swapping would skew
        // the minuend large).
        do {
            a = randTo(maxOperand);
            b = randTo(maxOperand);
        } while (b > a);
    } else {
        // Compare: any two numbers 0..maxOperand, uniform and independent.
        a = randTo(maxOperand);
        b = randTo(maxOperand);
    }
    quizAnswered = false;

    const questionEl = document.getElementById('quizQuestion');
    const choicesEl = document.getElementById('quizChoices');
    const feedbackEl = document.getElementById('quizFeedback');
    const nextBtn = document.getElementById('quizNext');

    feedbackEl.textContent = '';
    feedbackEl.className = 'quiz-feedback';
    nextBtn.classList.remove('visible');

    // Render the question expression into the same drop-zone/renderer as learn.
    // The first operand carries the arithmetic operator; the second carries the
    // trailing "= ?" (or the compare "?" goes on the first operand).
    const opSymbol = currentOperation === 'sum' ? '+' : '−';
    const questionItems = currentOperation === 'compare'
        ? [{ num: a, op: '?' }, { num: b, op: null }]
        : [{ num: a, op: opSymbol }, { num: b, op: '= ?' }];
    renderShapeRow(questionEl, questionItems);

    if (currentOperation === 'sum' || currentOperation === 'subtract') {
        quizAnswer = currentOperation === 'sum' ? a + b : a - b;

        // Generate choices (correct + 3 wrong). Sum answers can reach twice the
        // max operand; subtract answers stay within 0..maxOperand.
        const maxChoice = currentOperation === 'sum' ? maxOperand * 2 : maxOperand;
        const choices = new Set([quizAnswer]);

        // Prefer distractors close to the answer, but never clamp out-of-range
        // values onto 0 or the cap -- that would pile duplicates onto the
        // boundary and make 0 appear far more often than it should. Drop any
        // candidate that falls outside [0, maxChoice] and try another offset.
        let guard = 0;
        while (choices.size < 4 && guard < 200) {
            guard++;
            const offset = Math.floor(Math.random() * 7) - 3; // -3..+3
            if (offset === 0) continue;
            const wrong = quizAnswer + offset;
            if (wrong < 0 || wrong > maxChoice) continue;
            choices.add(wrong);
        }

        // Fallback: if the answer sits in a corner (e.g. 0 or the cap) and the
        // nearby window couldn't supply enough distinct values, fill from the
        // full valid range.
        guard = 0;
        while (choices.size < 4 && guard < 500) {
            guard++;
            const candidate = Math.floor(Math.random() * (maxChoice + 1));
            choices.add(candidate);
        }

        const shuffled = [...choices].sort(() => Math.random() - 0.5);

        choicesEl.innerHTML = '';
        shuffled.forEach(num => {
            const choice = document.createElement('div');
            choice.className = 'quiz-choice';
            choice.dataset.value = num;

            // Shapes only exist for 0-20; above that, show the number alone.
            if (num <= 20) {
                const svg = createShapeForNumber(num);
                // Let CSS size the shape to fill the card (viewBox preserves
                // aspect ratio). Drop the intrinsic width/height so the shape
                // scales up to use the available card space.
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                choice.appendChild(svg);
            } else {
                choice.classList.add('quiz-choice-number');
            }

            const label = document.createElement('span');
            label.className = 'choice-label';
            label.textContent = num;
            choice.appendChild(label);

            choice.addEventListener('click', () => handleQuizAnswer(num, choice));
            choicesEl.appendChild(choice);
        });
    } else {
        // Compare mode quiz: pick the correct sign. The question row is already
        // rendered above (with "?" between the operands).
        quizAnswer = a > b ? '>' : a < b ? '<' : '=';

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
        const operators = document.querySelectorAll('#quizQuestion .shape-item-operator');
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

// ============ BUILD MODE ============
//
// A construction puzzle: show the native outline of a target number N, and
// offer 4 pieces of which exactly 2 combine to fill that outline. The child
// drags pieces onto the stage; dropped pieces snap to the grid so a wrong
// piece visibly overhangs the outline or overlaps the other piece. When the
// two placed pieces exactly cover the outline, it turns green and a Next
// button starts a fresh round. No scoring.
//
// The tiling math runs on abstract grid cells so it is style-agnostic; only
// the per-cell geometry (cellsForNumber) and the painter differ per style.
// Geometry verified headlessly against the agreed examples before wiring UI.

const BUILD_CELL_DEFAULT = 40; // fallback px size of one grid cell
const BUILD_CELL_MAX = 72;     // never make cells larger than this
const BUILD_CELL_MIN = 20;     // never shrink below this

// The current cell size in px (set per round from the measured stage).
function currentBuildCell() {
    return (buildRound && buildRound.cell) || BUILD_CELL_DEFAULT;
}

// Compute the largest cell size that fits a cols x rows outline inside the
// stage, leaving a margin so misfit pieces can overhang visibly, and clamped
// to sane bounds. Measures the live stage; if it has no size yet, falls back.
function computeBuildCell(stage, cols, rows) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return BUILD_CELL_DEFAULT;
    // Leave room: ~2 cells of margin all around for overhang + the dashed
    // stage padding.
    const availW = rect.width - 90;
    const availH = rect.height - 90;
    const byW = availW / (cols + 2);
    const byH = availH / (rows + 2);
    let cell = Math.floor(Math.min(byW, byH));
    cell = Math.max(BUILD_CELL_MIN, Math.min(BUILD_CELL_MAX, cell));
    return cell;
}

let buildRound = null; // { target, correctPair, outlineCells, placed: [...] }

// Cell set for a number in the current style, in local grid coords
// ({c, r}, r increasing downward, normalized so min c/r = 0).
function cellsForNumber(n, style) {
    const cells = [];
    if (style === 'numberblocks') {
        const layout = blockColumnLayout(n);
        const rowsTall = Math.max(...layout);
        for (let c = 0; c < layout.length; c++) {
            const h = layout[c];
            for (let i = 0; i < h; i++) {
                cells.push({ c, r: rowsTall - 1 - i }); // bottom-aligned column
            }
        }
        return normalizeCells(cells);
    }
    // numicon: the outline MUST match createShapeForNumber exactly so the
    // target we build looks like the number everywhere else in the app.
    //  - 1..10  -> the single-shape hole grid (createShapeSVG).
    //  - 11..20 -> the composite (createCompositeSVG): a 2x5 ten at columns
    //              0-1 plus the remainder shape beside it (columns 2+),
    //              BOTH bottom-aligned, exactly as drawn.
    if (n <= 10) {
        return normalizeCells(numiconSingleCells(n));
    }
    const remainder = n - 10;
    const tenCells = numiconSingleCells(10); // 2x5, rows 0..4
    const remCells = numiconSingleCells(remainder);
    const tenRows = 5;
    const remRows = Math.max(...remCells.map(p => p.r)) + 1;
    // Bottom-align: ten occupies rows 0..4; remainder's bottom sits on row 4.
    const totalRows = Math.max(tenRows, remRows);
    const tenDR = totalRows - tenRows;
    const remDR = totalRows - remRows;
    tenCells.forEach(p => cells.push({ c: p.c, r: p.r + tenDR }));
    remCells.forEach(p => cells.push({ c: p.c + 2, r: p.r + remDR })); // beside the ten
    return normalizeCells(cells);
}

// Hole grid for a single Numicon number 1..10, matching createShapeSVG:
// 1 and 2 are a single column; 3..10 are 2-wide with rows filled top-to-bottom
// and odd numbers (>1) carrying a single hole in the TOP row (col 0) -- the
// notch. r increases downward.
function numiconSingleCells(n) {
    const cells = [];
    const cols = (n === 1 || n === 2) ? 1 : 2;
    const rows = Math.ceil(n / cols);
    const isOdd = n % 2 === 1 && n > 1;
    let count = 0;
    for (let r = 0; r < rows; r++) {
        const inRow = (isOdd && r === 0) ? 1 : cols;
        for (let c = 0; c < inRow; c++) {
            cells.push({ c, r });
            if (++count >= n) break;
        }
        if (count >= n) break;
    }
    return cells;
}

function normalizeCells(cells) {
    const minC = Math.min(...cells.map(p => p.c));
    const minR = Math.min(...cells.map(p => p.r));
    return cells.map(p => ({ c: p.c - minC, r: p.r - minR }));
}

function cellKey(p) { return `${p.c},${p.r}`; }
function cellSetSignature(cells) {
    return normalizeCells(cells).map(cellKey).sort().join('|');
}

// All distinct orientations (rotations x flip) of a cell set.
function cellOrientations(cells) {
    const variants = [];
    const seen = new Set();
    for (let flip = 0; flip < 2; flip++) {
        let c = flip ? cells.map(p => ({ c: -p.c, r: p.r })) : cells;
        for (let rot = 0; rot < 4; rot++) {
            const nc = normalizeCells(c);
            const sig = cellSetSignature(nc);
            if (!seen.has(sig)) { seen.add(sig); variants.push(nc); }
            c = c.map(p => ({ c: p.r, r: -p.c })); // rotate 90deg
        }
    }
    return variants;
}

// Every way `piece` can be dropped to cover a subset of `targetSet` (a Set of
// cell keys). Returns a list of placed cell arrays.
function piecePlacements(piece, targetSet) {
    const out = [];
    const targets = [...targetSet].map(s => {
        const [c, r] = s.split(',').map(Number); return { c, r };
    });
    for (const o of cellOrientations(piece)) {
        for (const t of targets) {
            const dc = t.c - o[0].c;
            const dr = t.r - o[0].r;
            const placed = o.map(p => ({ c: p.c + dc, r: p.r + dr }));
            if (placed.every(p => targetSet.has(cellKey(p)))) out.push(placed);
        }
    }
    return out;
}

// Does (a, b) exactly partition N's outline in `style`?
function pairTiles(n, a, b, style) {
    if (a + b !== n) return false;
    const target = cellsForNumber(n, style);
    const targetSet = new Set(target.map(cellKey));
    const pieceA = cellsForNumber(a, style);
    for (const placedA of piecePlacements(pieceA, targetSet)) {
        const remaining = new Set(targetSet);
        placedA.forEach(p => remaining.delete(cellKey(p)));
        if (remaining.size !== b) continue;
        const pieceB = cellsForNumber(b, style);
        if (piecePlacements(pieceB, remaining).some(pl => pl.length === remaining.size)) {
            return true;
        }
    }
    return false;
}

// All valid 2-piece partitions (a<=b) of N's outline in `style`.
function validPairsFor(n, style) {
    const pairs = [];
    for (let a = 1; a <= Math.floor(n / 2); a++) {
        const b = n - a;
        if (pairTiles(n, a, b, style)) pairs.push([a, b]);
    }
    return pairs;
}

// Can target N in `style` yield a 4-card tray with EXACTLY one solvable pair?
// Requires a valid pair plus two distinct distractor values from 1..N-1 such
// that no two of the four tray values form a second valid partition. Small
// targets (2,3,4) fail this and are excluded from rounds.
function hasUniqueTrayTarget(n, style) {
    const pairs = validPairsFor(n, style);
    if (pairs.length === 0) return false;
    for (const [a, b] of pairs) {
        if (pairAdmitsCleanTray(n, a, b, style)) return true;
    }
    return false;
}

// Can this specific correct pair (a,b) be padded with 2 distractors such that
// NO two tray values (other than a,b) sum to the target? Uses the sum rule so
// the tray is unambiguous by arithmetic, not just by tiling.
function pairAdmitsCleanTray(n, a, b, style) {
    const tray = [a, b];
    const createsSecond = (v) => tray.some(u => u + v === n);
    let added = 0;
    for (let v = 1; v < n; v++) {
        if (v === a || v === b || tray.includes(v)) continue;
        if (createsSecond(v)) continue;
        tray.push(v);
        if (++added >= 2) return true;
    }
    return false;
}

// Build a fresh round: pick a target N (2..20) that admits a unique-solution
// 4-card tray in the current style, choose one partition as the correct pair,
// and assemble 4 tray pieces of which exactly those 2 are correct.
function newBuildRound() {
    const style = currentShapeStyle;

    // Candidate targets: must tile AND admit a 4-card tray with exactly one
    // solvable pair. Very small targets (2, 3, 4) can't supply enough distinct
    // values without forcing a second valid pair, so they're excluded. The
    // puzzle is only meaningful once there's room for genuine distractors.
    const candidates = [];
    for (let n = 2; n <= 20; n++) {
        if (hasUniqueTrayTarget(n, style)) candidates.push(n);
    }
    if (candidates.length === 0) return null;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const pairs = validPairsFor(target, style);
    // Prefer a correct pair that can be surrounded by 2 clean distractors
    // (no second solution). Fall back to any valid pair if none qualify.
    const cleanPairs = pairs.filter(([a, b]) => pairAdmitsCleanTray(target, a, b, style));
    const pool = cleanPairs.length ? cleanPairs : pairs;
    const correctPair = pool[Math.floor(Math.random() * pool.length)];

    // Tray pieces: the two correct values plus two distractors. A distractor is
    // only accepted if it does NOT form a SECOND valid partition with ANY value
    // already on the tray (correct values or earlier distractors). That keeps
    // exactly one solvable pair on the tray -- e.g. for target 15 with correct
    // 10+5, we must reject 12 and 3 together, since 12+3 also tiles 15.
    const trayValues = [correctPair[0], correctPair[1]];

    // Would adding `v` to the current tray create any valid partnership?
    const createsSecondSolution = (v) => {
        return trayValues.some(u => {
            // Reject if v pairs with an existing tray value to SUM to the
            // target -- even if that pair wouldn't tile -- so the tray is
            // unambiguous by arithmetic (only the correct pair adds to N).
            return u + v === target;
        });
    };

    const distractorPool = [];
    for (let v = 1; v < target; v++) {
        if (v !== correctPair[0] && v !== correctPair[1]) distractorPool.push(v);
    }
    shuffleInPlace(distractorPool);
    for (const v of distractorPool) {
        if (trayValues.length >= 4) break;
        if (trayValues.includes(v)) continue;
        if (createsSecondSolution(v)) continue; // would add a 2nd solution
        trayValues.push(v);
    }

    // Fallback if the no-second-solution rule left us short (small targets):
    // relax to any distinct value that at least isn't an exact duplicate of a
    // correct value. Still avoids a second solution where possible.
    let pad = 1;
    while (trayValues.length < 4 && pad <= 40) {
        const v = ((correctPair[0] + pad) % Math.max(1, target - 1)) + 1;
        if (!trayValues.includes(v) && !createsSecondSolution(v)) {
            trayValues.push(v);
        }
        pad++;
    }
    // Last resort (very small targets like 2 or 3): allow duplicates of a
    // distractor rather than render fewer than 4 cards.
    pad = 1;
    while (trayValues.length < 4 && pad <= 40) {
        const v = ((correctPair[0] + pad) % Math.max(1, target - 1)) + 1;
        if (!trayValues.includes(v)) trayValues.push(v);
        pad++;
    }
    shuffleInPlace(trayValues);

    buildRound = {
        target,
        style,
        correctPair,
        outlineCells: cellsForNumber(target, style),
        trayValues,
        placed: [], // { value, cells: [{c,r}], el }
        solved: false
    };
    // Precompute THE solution: exact placed cells + orientation for each
    // correct value, so correct pieces snap to fixed, natural positions (the
    // leftover always looks exactly like the partner shape) and coloring is
    // unambiguous. { value -> { cells, rot, flip } }
    buildRound.solution = solveLayoutForPair(target, correctPair[0], correctPair[1], style);
    return buildRound;
}

// Compute one concrete, natural-looking solution for pair (a,b) filling N's
// outline. Returns { [value]: { cells, rot, flip } } giving each piece's exact
// placed cells and the orientation used (so we can color/draw it faithfully).
//
// Preference order (so the leftover reads as the partner's natural shape):
//   1. a placement of `a` in its DEFAULT orientation whose remainder `b` fills
//      in its DEFAULT orientation, then
//   2. default `a` with any `b`, then
//   3. any `a` with any `b`.
// When a === b (e.g. 4+4) the two instances are keyed by index via the caller.
function solveLayoutForPair(n, a, b, style) {
    const targetSet = new Set(cellsForNumber(n, style).map(cellKey));
    const aOris = orientationsWithMeta(a, style);
    const bDefault = cellsForNumber(b, style);

    let best = null; // { score, aPlace, bPlace }
    for (const ao of aOris) {
        for (const aPlaced of placementsOfOrientation(ao.cells, targetSet)) {
            const remaining = new Set(targetSet);
            aPlaced.forEach(p => remaining.delete(cellKey(p)));
            if (remaining.size !== b) continue;
            const bOris = orientationsWithMeta(b, style);
            for (const bo of bOris) {
                const bFit = placementsOfOrientation(bo.cells, remaining)
                    .find(pl => pl.length === remaining.size);
                if (!bFit) continue;
                // Score: prefer default orientations. Weight the SMALLER piece
                // (b, since a<=b isn't guaranteed here, so compare sizes) more,
                // so the leftover visually reads as that number's natural shape.
                const aNonDefault = (ao.rot === 0 && !ao.flip) ? 0 : 1;
                const bNonDefault = (bo.rot === 0 && !bo.flip) ? 0 : 1;
                const aSmaller = a <= b;
                const smallCost = aSmaller ? aNonDefault : bNonDefault;
                const bigCost = aSmaller ? bNonDefault : aNonDefault;
                const score = smallCost * 2 + bigCost; // smaller piece default matters most
                if (!best || score < best.score) {
                    best = {
                        score,
                        a: { value: a, cells: aPlaced, rot: ao.rot, flip: ao.flip },
                        b: { value: b, cells: bFit, rot: bo.rot, flip: bo.flip }
                    };
                }
                if (best.score === 0) break;
            }
            if (best && best.score === 0) break;
        }
        if (best && best.score === 0) break;
    }
    return best ? { aSlot: best.a, bSlot: best.b } : null;
}

// Orientations of a value's cells, each tagged with the {rot,flip} that
// produced it (so we can later draw the piece in that orientation).
function orientationsWithMeta(value, style) {
    const base = cellsForNumber(value, style);
    const out = [];
    const seen = new Set();
    for (let flip = 0; flip < 2; flip++) {
        for (let rot = 0; rot < 4; rot++) {
            const cells = normalizeCells(base.map(p => applyOrient(p, rot, flip)));
            const sig = cellSetSignature(cells);
            if (seen.has(sig)) continue;
            seen.add(sig);
            out.push({ cells, rot, flip });
        }
    }
    return out;
}

// Placements of an already-oriented cell set covering a subset of targetSet.
function placementsOfOrientation(oriCells, targetSet) {
    const out = [];
    const targets = [...targetSet].map(s => {
        const [c, r] = s.split(',').map(Number); return { c, r };
    });
    for (const t of targets) {
        const dc = t.c - oriCells[0].c;
        const dr = t.r - oriCells[0].r;
        const placed = oriCells.map(p => ({ c: p.c + dc, r: p.r + dr }));
        if (placed.every(p => targetSet.has(cellKey(p)))) out.push(placed);
    }
    return out;
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// The native grid pitch of a drawn shape, per style (px between cell centers).
function stylePitch(style) {
    return style === 'numberblocks' ? 34 /* CUBE */ : HOLE_SPACING;
}

// Renders a piece using the REAL app shape renderer (createShapeForNumber) in
// DEFAULT orientation, scaled so one native cell == the current build cell
// size. Used for the tray cards and the drag ghost, so those are pixel-
// identical to the panel/learn/quiz rendering. Returns the wrapping <div>,
// the PAD inset (stage px), and the scaled width/height.
function buildShapeEl(value) {
    const style = buildRound ? buildRound.style : currentShapeStyle;
    const CELL = currentBuildCell();
    const scale = CELL / stylePitch(style);

    const svg = createShapeForNumber(value);
    const origW = parseInt(svg.getAttribute('width')) || 1;
    const origH = parseInt(svg.getAttribute('height')) || 1;
    svg.setAttribute('width', Math.round(origW * scale));
    svg.setAttribute('height', Math.round(origH * scale));
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${origW} ${origH}`);

    const el = document.createElement('div');
    el.style.lineHeight = '0';
    el.appendChild(svg);
    return { el, inset: PAD * scale, scale, w: Math.round(origW * scale), h: Math.round(origH * scale) };
}

// Apply a cell-space orientation: flip (mirror c) then rotate 90*rot CW
// (screen coords, y down). Used to relate a piece's default layout to its
// placed layout when coloring a placed piece faithfully.
function applyOrient(p, rot, flip) {
    let c = flip ? -p.c : p.c;
    let r = p.r;
    for (let i = 0; i < rot; i++) { const nc = -r, nr = c; c = nc; r = nr; }
    return { c, r };
}

// Paints a PLACED piece from its final (possibly rotated/flipped) cells, using
// the same per-cell colors, borders, holes and face as the real renderer, so a
// placed piece reads the same as the panel/tray. Always grid-aligned (no PAD),
// which is why placed pieces use this rather than a CSS-rotated real SVG.
function paintCellsSVG(value, cells, rot = 0, flip = 0) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const CELL = currentBuildCell();
    const minC = Math.min(...cells.map(p => p.c));
    const minR = Math.min(...cells.map(p => p.r));
    const cols = Math.max(...cells.map(p => p.c)) - minC + 1;
    const rows = Math.max(...cells.map(p => p.r)) - minR + 1;
    const w = cols * CELL, h = rows * CELL;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `piece for ${value}`);

    const style = buildRound ? buildRound.style : currentShapeStyle;

    // Map each placed cell back to its default-orientation color index using
    // the KNOWN orientation (rot,flip). This is exact for composite teens (14)
    // whose colors differ per cell -- no fragile orientation search.
    const placedNorm = cells.map(p => ({ c: p.c - minC, r: p.r - minR }));
    const colorForPlaced = buildPlacedColorLookup(value, style, rot, flip, placedNorm);

    // Determine the head cell (for the Numberblocks face): the default head is
    // the top of the first column = the cell with min c then min r; map it to
    // the matching placed cell.
    placedNorm.forEach((p, i) => {
        const x = p.c * CELL, y = p.r * CELL;
        if (style === 'numberblocks') {
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', CELL);
            rect.setAttribute('height', CELL);
            rect.setAttribute('fill', colorForPlaced.fill(p));
            const b = colorForPlaced.border(p);
            rect.setAttribute('stroke', b.color);
            rect.setAttribute('stroke-width', b.width);
            svg.appendChild(rect);
        } else {
            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', x + 1);
            rect.setAttribute('y', y + 1);
            rect.setAttribute('width', CELL - 2);
            rect.setAttribute('height', CELL - 2);
            rect.setAttribute('rx', CORNER_R);
            rect.setAttribute('fill', colorForPlaced.fill(p));
            svg.appendChild(rect);
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', x + CELL / 2);
            circle.setAttribute('cy', y + CELL / 2);
            circle.setAttribute('r', CELL * 0.3);
            circle.setAttribute('fill', 'rgba(255,255,255,0.85)');
            circle.setAttribute('stroke', 'rgba(0,0,0,0.1)');
            circle.setAttribute('stroke-width', '1.5');
            svg.appendChild(circle);
        }
    });

    // Numberblocks face on the head cell, matching the real renderer.
    if (style === 'numberblocks') {
        const head = colorForPlaced.headPlacedCell;
        if (head) addNumberblockFace(svg, head.c * CELL, head.r * CELL, CELL);
    }
    return svg;
}

// Builds per-cell color/border lookups for a placed piece by matching its
// placed cells to the default-orientation cells (whose colors come straight
// from blockColorsForNumber / blockBordersForNumber / NUMBER_COLORS).
function buildPlacedColorLookup(value, style, rot, flip, placedNorm) {
    const defaultCells = cellsForNumber(value, style);
    // Apply the KNOWN orientation to the default cells; index i still maps to
    // color i. Normalize so coords match placedNorm, then key -> default index.
    const mapped = defaultCells.map(p => applyOrient(p, rot, flip));
    const mn = normalizeCells(mapped);
    const placedKeyToDefaultIdx = new Map();
    mn.forEach((p, idx) => placedKeyToDefaultIdx.set(cellKey(p), idx));

    if (style === 'numberblocks') {
        const colors = blockColorsForNumber(value);
        const borders = blockBordersForNumber(value);
        // The head (face) is default index of the top of the first column:
        // in createNumberblockSVG that's placement index firstColCount-1.
        const layout = blockColumnLayout(value);
        const headDefaultIdx = layout[0] - 1;
        // Find which placed cell maps to that default index.
        let headPlacedCell = null;
        placedNorm.forEach(p => {
            const di = placedKeyToDefaultIdx.get(cellKey(p));
            if (di === headDefaultIdx) headPlacedCell = p;
        });
        return {
            fill: (p) => {
                const di = placedKeyToDefaultIdx.get(cellKey(p));
                const c = colors[di];
                return c || (Array.isArray(colors) ? colors[0] : colors) || '#888';
            },
            border: (p) => {
                const di = placedKeyToDefaultIdx.get(cellKey(p));
                return borders[di] || { color: DEFAULT_BORDER, width: 1.5 };
            },
            headPlacedCell
        };
    }
    // Numicon: single color for 1-10; composite teens (11-20) are a grey ten
    // (indices 0-9) plus the remainder's color (indices 10+), matching
    // cellsForNumber's order (ten cells pushed first, then remainder).
    const numiconColors = numiconCellColors(value);
    return {
        fill: (p) => {
            const di = placedKeyToDefaultIdx.get(cellKey(p));
            return numiconColors[di] || numiconColors[0] || '#888';
        },
        border: () => ({ color: DEFAULT_BORDER, width: 1.5 }),
        headPlacedCell: null
    };
}

// Per-cell colors for a Numicon number, in cellsForNumber() default index
// order. 1-10: all the number's own color. 11-20: first 10 cells are the ten
// (grey), the remaining cells are the remainder number's color.
function numiconCellColors(value) {
    if (value <= 10) {
        const c = NUMBER_COLORS[value] || '#888';
        return Array.from({ length: value }, () => c);
    }
    const remainder = value - 10;
    const tenColor = NUMBER_COLORS[10] || '#b8b8b8';
    const remColor = NUMBER_COLORS[remainder] || '#888';
    const out = Array.from({ length: 10 }, () => tenColor);
    for (let i = 0; i < remainder; i++) out.push(remColor);
    return out;
}

// Build an SVG that traces the outer (and any inner) perimeter of a cell set
// as line segments: every unit edge that borders exactly one cell. Drawn at
// the current cell size so it overlays the canvas exactly.
function buildOutlinePerimeterSVG(cells, cols, rows) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const CELL = currentBuildCell();
    const w = cols * CELL;
    const h = rows * CELL;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');

    const occ = new Set(cells.map(cellKey));
    const has = (c, r) => occ.has(`${c},${r}`);

    // Internal grid lines first (faint), so the outer perimeter draws on top.
    // An internal edge is shared by two occupied cells; draw each once by only
    // considering a cell's right and bottom neighbour.
    const internal = [];
    cells.forEach(({ c, r }) => {
        if (has(c + 1, r)) internal.push([c + 1, r, c + 1, r + 1]); // right divider
        if (has(c, r + 1)) internal.push([c, r + 1, c + 1, r + 1]); // bottom divider
    });
    const addLine = (edge, cls) => {
        const [x1, y1, x2, y2] = edge;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1 * CELL);
        line.setAttribute('y1', y1 * CELL);
        line.setAttribute('x2', x2 * CELL);
        line.setAttribute('y2', y2 * CELL);
        if (cls) line.setAttribute('class', cls);
        svg.appendChild(line);
    };
    internal.forEach(e => addLine(e, 'build-outline-divider'));

    // Outer perimeter: every unit edge that borders exactly one cell.
    const edges = [];
    cells.forEach(({ c, r }) => {
        if (!has(c, r - 1)) edges.push([c, r, c + 1, r]);         // top
        if (!has(c, r + 1)) edges.push([c, r + 1, c + 1, r + 1]); // bottom
        if (!has(c - 1, r)) edges.push([c, r, c, r + 1]);         // left
        if (!has(c + 1, r)) edges.push([c + 1, r, c + 1, r + 1]); // right
    });
    edges.forEach(e => addLine(e));
    return svg;
}

function renderBuildMode() {
    const stage = document.getElementById('buildStage');
    const tray = document.getElementById('buildTray');
    const prompt = document.getElementById('buildPrompt');
    const feedback = document.getElementById('buildFeedback');
    const nextBtn = document.getElementById('buildNext');
    if (!stage || !buildRound) return;

    stage.classList.remove('solved');
    feedback.textContent = '';
    nextBtn.textContent = 'Skip';

    prompt.textContent = 'Build the number';

    // Build the sized inner canvas that holds the outline + placed pieces.
    stage.innerHTML = '';
    const cells = buildRound.outlineCells;
    const cols = Math.max(...cells.map(p => p.c)) + 1;
    const rows = Math.max(...cells.map(p => p.r)) + 1;

    // Scale the cell size so the outline fills as much of the stage as possible
    // (bigger where there's room), while staying inside the stage with a margin
    // for overhanging misfit pieces. Falls back to the default if the stage has
    // no measured size yet.
    buildRound.cell = computeBuildCell(stage, cols, rows);
    const CELL = buildRound.cell;

    const canvas = document.createElement('div');
    canvas.className = 'build-canvas';
    canvas.style.width = `${cols * CELL}px`;
    canvas.style.height = `${rows * CELL}px`;
    stage.appendChild(canvas);
    buildRound.canvas = canvas;

    // Faint fill behind the pieces so the empty target area reads as a slot.
    cells.forEach(p => {
        const cell = document.createElement('div');
        cell.className = 'build-outline-cell';
        cell.style.left = `${p.c * CELL}px`;
        cell.style.top = `${p.r * CELL}px`;
        cell.style.width = `${CELL}px`;
        cell.style.height = `${CELL}px`;
        canvas.appendChild(cell);
    });

    // A single perimeter outline traced around the silhouette, layered ABOVE
    // the pieces so the target border is always visible (and turns green on
    // success). pointer-events:none so it never blocks dragging.
    const outlineSvg = buildOutlinePerimeterSVG(cells, cols, rows);
    outlineSvg.classList.add('build-outline-perimeter');
    canvas.appendChild(outlineSvg);
    buildRound.outlineSvgEl = outlineSvg;

    // The expected number as a small numeral, inside the stage just below the
    // outline. Absolutely positioned under the canvas so it tracks the outline
    // and stays within the dashed draggable area.
    const targetNum = document.createElement('div');
    targetNum.className = 'build-target-number';
    targetNum.setAttribute('aria-hidden', 'true');
    targetNum.textContent = buildRound.target;
    targetNum.style.position = 'absolute';
    targetNum.style.left = '0';
    targetNum.style.right = '0';
    targetNum.style.top = `${rows * CELL + 12}px`;
    canvas.appendChild(targetNum);

    // Tray pieces. Reuses the quiz choice card classes (.quiz-choices /
    // .quiz-choice) so sizing + mobile scaling match the quiz exactly, with a
    // number label under each piece.
    tray.innerHTML = '';
    buildRound.trayValues.forEach((value, idx) => {
        const piece = document.createElement('div');
        piece.className = 'quiz-choice build-piece';
        piece.dataset.value = value;
        piece.dataset.trayIdx = idx;

        // Real app renderer (default orientation) == the panel look, and ==
        // what gets dragged/placed.
        const { el } = buildShapeEl(value);
        const svg = el.querySelector('svg');
        // Let CSS size the shape to fill the card (viewBox preserves aspect),
        // just like quiz choices do.
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        piece.appendChild(svg);

        const label = document.createElement('span');
        label.className = 'choice-label';
        label.textContent = value;
        piece.appendChild(label);

        piece.addEventListener('mousedown', (e) => startBuildDrag(e, value, idx));
        piece.addEventListener('touchstart', (e) => startBuildDrag(e, value, idx), { passive: false });
        tray.appendChild(piece);
    });
}

// ---- Build drag & drop ----
let buildDrag = null;

function startBuildDrag(e, value, trayIdx) {
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    // Real app renderer (default orientation) scaled to the grid; the ghost
    // includes the shape's PAD border, so the snap math subtracts `inset`.
    const { el, inset, w, h } = buildShapeEl(value);
    ghost.appendChild(el);
    document.body.appendChild(ghost);

    ghost.style.left = (clientX - w / 2) + 'px';
    ghost.style.top = (clientY - h / 2) + 'px';

    buildDrag = { value, trayIdx, ghost, w, h, inset };
}

function onBuildDragMove(e) {
    if (!buildDrag) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    buildDrag.ghost.style.left = (clientX - buildDrag.w / 2) + 'px';
    buildDrag.ghost.style.top = (clientY - buildDrag.h / 2) + 'px';
}

function onBuildDragEnd(e) {
    if (!buildDrag) return;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    buildDrag.ghost.remove();

    const canvas = buildRound && buildRound.canvas;
    if (canvas) {
        const rect = canvas.getBoundingClientRect();
        // The ghost (grid-painted, no PAD) is centered on the cursor, so its
        // top-left cell sits at cursor - size/2. Convert to a canvas grid cell
        // and snap.
        const CELL = currentBuildCell();
        // The ghost is centered on the cursor and includes PAD; its first cell
        // top-left sits at cursor - size/2 + inset. Snap that to a grid cell.
        const contentLeft = (clientX - buildDrag.w / 2 + buildDrag.inset) - rect.left;
        const contentTop = (clientY - buildDrag.h / 2 + buildDrag.inset) - rect.top;
        const col = Math.round(contentLeft / CELL);
        const row = Math.round(contentTop / CELL);
        // Only place if the drop happened over (or near) the stage.
        const stage = document.getElementById('buildStage');
        const sRect = stage.getBoundingClientRect();
        if (clientX >= sRect.left && clientX <= sRect.right &&
            clientY >= sRect.top && clientY <= sRect.bottom) {
            placeBuildPiece(buildDrag.value, buildDrag.trayIdx, col, row);
        }
    }
    buildDrag = null;
}

// Place a piece (default orientation) at grid (col,row), snapped. For the
// correct pieces we auto-orient so a valid solution is reachable; distractors
// just drop in their default orientation and will visibly misfit.
function placeBuildPiece(value, trayIdx, col, row) {
    if (!buildRound || buildRound.solved) return;

    // If this tray piece is already placed, remove the old placement first.
    buildRound.placed = buildRound.placed.filter(pl => {
        if (pl.trayIdx === trayIdx) { pl.el.remove(); return false; }
        return true;
    });

    const base = cellsForNumber(value, buildRound.style);

    // Decide where the piece lands and in what orientation.
    const placement = chooseBuildPlacement(base, value, col, row);

    const piece = renderPlacedPiece(value, trayIdx, placement.cells, placement);
    buildRound.placed.push({
        value, trayIdx, cells: placement.cells,
        rot: placement.rot, flip: placement.flip, el: piece
    });

    // Dim the used tray piece.
    const trayEl = document.querySelector(`.build-piece[data-tray-idx="${trayIdx}"]`);
    if (trayEl) trayEl.classList.add('used');

    updateBuildState();
}

// Decide where a dropped piece lands. Uses the PRECOMPUTED solution:
//
//  - If `value` is a correct piece and the drop is near its predefined
//    solution slot (and that slot isn't already taken), it snaps into that
//    exact slot in the solution's orientation. Because the solution is fixed,
//    the two correct pieces always compose into the natural silhouette (the
//    leftover looks exactly like the partner) regardless of drop order.
//  - Otherwise (distractor, or a correct piece dropped far from its slot) it
//    drops in default orientation at the snapped grid cell, so it visibly
//    overhangs / overlaps.
//
// Returns { cells, rot, flip }.
function chooseBuildPlacement(baseCells, value, col, row) {
    const dropC = col + centroidOffset(baseCells).c;
    const dropR = row + centroidOffset(baseCells).r;
    const SNAP_RADIUS = 3.5; // cells

    // Which solution slots correspond to this value (one, or two if a === b).
    const slots = solutionSlotsForValue(value);
    // Slots already occupied by a currently placed piece of this value.
    const takenSigs = new Set(
        buildRound.placed.filter(pl => pl.value === value)
            .map(pl => cellSetSignature(pl.cells))
    );

    let best = null, bestDist = Infinity;
    for (const slot of slots) {
        if (takenSigs.has(cellSetSignature(slot.cells))) continue;
        const cx = slot.cells.reduce((s, p) => s + p.c, 0) / slot.cells.length;
        const cy = slot.cells.reduce((s, p) => s + p.r, 0) / slot.cells.length;
        const d = Math.abs(cx - dropC) + Math.abs(cy - dropR);
        if (d < bestDist) { bestDist = d; best = slot; }
    }
    if (best && bestDist <= SNAP_RADIUS) {
        return { cells: best.cells.map(p => ({ c: p.c, r: p.r })), rot: best.rot, flip: best.flip, snapped: true };
    }

    // Misfit: drop at the grid cell in DEFAULT orientation, unchanged shape.
    // `snapped:false` tells the renderer to draw the real shape (not the cell
    // painter), so an incorrect drop never reshapes the piece.
    return { cells: baseCells.map(p => ({ c: p.c + col, r: p.r + row })), rot: 0, flip: 0, snapped: false };
}

// The predefined solution slot(s) for a value: { cells, rot, flip }. Returns
// both slots when the correct pair is value+value (e.g. 4+4).
function solutionSlotsForValue(value) {
    const sol = buildRound.solution;
    if (!sol) return [];
    const out = [];
    if (sol.aSlot.value === value) out.push(sol.aSlot);
    if (sol.bSlot.value === value) out.push(sol.bSlot);
    return out;
}

// Centroid of a normalized cell set relative to its (0,0) anchor.
function centroidOffset(cells) {
    const c = cells.reduce((s, p) => s + p.c, 0) / cells.length;
    const r = cells.reduce((s, p) => s + p.r, 0) / cells.length;
    return { c, r };
}

function renderPlacedPiece(value, trayIdx, cells, placement) {
    const minC = Math.min(...cells.map(p => p.c));
    const minR = Math.min(...cells.map(p => p.r));
    const piece = document.createElement('div');
    piece.className = 'build-placed';
    piece.dataset.value = value;
    piece.dataset.trayIdx = trayIdx;

    const CELL = currentBuildCell();
    if (placement && placement.snapped) {
        // Correct snap: faithful per-cell painter with the KNOWN orientation,
        // so composite teens (14) color correctly and rotated pieces align.
        const svg = paintCellsSVG(value, cells, placement.rot, placement.flip);
        piece.style.left = `${minC * CELL}px`;
        piece.style.top = `${minR * CELL}px`;
        piece.appendChild(svg);
    } else {
        // Misfit drop: show the REAL shape unchanged (default orientation), via
        // the same renderer as the tray/ghost. Positioned at the drop cell but
        // offset by the shape's PAD inset so its first cell lands on (minC,minR).
        const { el, inset } = buildShapeEl(value);
        piece.appendChild(el);
        piece.style.left = `${minC * CELL - inset}px`;
        piece.style.top = `${minR * CELL - inset}px`;
    }

    // Drag a placed piece back out (to the tray / reposition).
    piece.addEventListener('mousedown', (e) => pickUpPlacedPiece(e, trayIdx));
    piece.addEventListener('touchstart', (e) => pickUpPlacedPiece(e, trayIdx), { passive: false });

    // Insert BEFORE the perimeter overlay so the outline border stays on top
    // and remains visible even where a piece covers its cells.
    const overlay = buildRound.outlineSvgEl;
    if (overlay && overlay.parentNode === buildRound.canvas) {
        buildRound.canvas.insertBefore(piece, overlay);
    } else {
        buildRound.canvas.appendChild(piece);
    }
    return piece;
}

function pickUpPlacedPiece(e, trayIdx) {
    e.preventDefault();
    e.stopPropagation();
    if (!buildRound || buildRound.solved) return;
    // Remove the placement and re-enable its tray piece, then begin a drag.
    const pl = buildRound.placed.find(p => p.trayIdx === trayIdx);
    if (!pl) return;
    pl.el.remove();
    buildRound.placed = buildRound.placed.filter(p => p.trayIdx !== trayIdx);
    const trayEl = document.querySelector(`.build-piece[data-tray-idx="${trayIdx}"]`);
    if (trayEl) trayEl.classList.remove('used');
    updateBuildState();
    startBuildDrag(e, pl.value, trayIdx);
}

// Recompute misfit flags and the solved state after any placement change.
function updateBuildState() {
    if (!buildRound) return;
    const outlineSet = new Set(buildRound.outlineCells.map(cellKey));

    // Count coverage per cell to detect overlaps.
    const coverage = new Map();
    buildRound.placed.forEach(pl => {
        pl.cells.forEach(c => {
            const k = cellKey(c);
            coverage.set(k, (coverage.get(k) || 0) + 1);
        });
    });

    // Flag each placed piece as misfit if any of its cells fall outside the
    // outline or overlap another piece.
    buildRound.placed.forEach(pl => {
        const bad = pl.cells.some(c => {
            const k = cellKey(c);
            return !outlineSet.has(k) || coverage.get(k) > 1;
        });
        pl.el.classList.toggle('misfit', bad);
    });

    // Solved when every outline cell is covered exactly once and nothing
    // sits outside the outline.
    let solved = coverage.size === outlineSet.size;
    if (solved) {
        for (const k of outlineSet) {
            if (coverage.get(k) !== 1) { solved = false; break; }
        }
    }
    if (solved) {
        for (const k of coverage.keys()) {
            if (!outlineSet.has(k)) { solved = false; break; }
        }
    }

    const stage = document.getElementById('buildStage');
    const feedback = document.getElementById('buildFeedback');
    const nextBtn = document.getElementById('buildNext');

    if (solved) {
        buildRound.solved = true;
        stage.classList.add('solved');
        feedback.textContent = `🎉 You built ${buildRound.target}!`;
        nextBtn.textContent = 'Next ▶';
        // Transform the two pieces into the proper single number: replace them
        // with createShapeForNumber(target) filling the outline, so the result
        // reads as the number itself (one shape, one face) -- like the panel.
        showSolvedResult();
    } else {
        buildRound.solved = false;
        stage.classList.remove('solved');
        feedback.textContent = '';
        nextBtn.textContent = 'Skip';
    }
}

// On success, swap the placed pieces for the single target number shape,
// drawn with the real renderer (matches panel) and sized so its CELL GRID
// lines up with the outline. The real shapes include a PAD margin around the
// cells, so we scale by the native cell pitch (cell -> CELL) and position the
// shape at -PAD*scale; that makes the hole/cube grid coincide with the outline
// grid, with the shape's thin body margin sitting just inside the border.
function showSolvedResult() {
    if (!buildRound || !buildRound.canvas) return;
    const canvas = buildRound.canvas;
    const CELL = currentBuildCell();

    // Outline footprint in cells.
    const cells = buildRound.outlineCells;
    const cols = Math.max(...cells.map(p => p.c)) + 1;
    const rows = Math.max(...cells.map(p => p.r)) + 1;

    // Remove the individual placed pieces.
    buildRound.placed.forEach(pl => pl.el.remove());

    // Draw the target as a SINGLE number painted cell-by-cell over the exact
    // outline cells (default orientation), so it fills the outline perfectly --
    // every cell lands on the grid, with one set of colors and one face.
    const svg = paintCellsSVG(buildRound.target, buildRound.outlineCells, 0, 0);
    const el = document.createElement('div');
    el.className = 'build-result';
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.lineHeight = '0';
    el.appendChild(svg);

    // Insert before the perimeter overlay so the green outline stays on top.
    const overlay = buildRound.outlineSvgEl;
    if (overlay && overlay.parentNode === canvas) {
        canvas.insertBefore(el, overlay);
    } else {
        canvas.appendChild(el);
    }
}

function nextBuildRound() {
    newBuildRound();
    renderBuildMode();
}

document.addEventListener('mousemove', onBuildDragMove);
document.addEventListener('mouseup', onBuildDragEnd);
document.addEventListener('touchmove', onBuildDragMove, { passive: false });
document.addEventListener('touchend', onBuildDragEnd);

// ============ MODE SWITCHING ============

// The max-number slider caps operands in every quiz mode, so show it in any
// quiz operation (but not in learn mode).
function updateSumCapVisibility() {
    const control = document.getElementById('sumCapControl');
    if (!control) return;
    control.classList.toggle('hidden', currentMode !== 'quiz');
}

function switchMode(mode) {
    currentMode = mode;

    document.getElementById('learnBtn').classList.toggle('active', mode === 'learn');
    document.getElementById('quizBtn').classList.toggle('active', mode === 'quiz');
    document.getElementById('buildBtn')?.classList.toggle('active', mode === 'build');

    document.getElementById('learnMode').classList.toggle('hidden', mode !== 'learn');
    document.getElementById('quizMode').classList.toggle('hidden', mode !== 'quiz');
    document.getElementById('buildMode')?.classList.toggle('hidden', mode !== 'build');
    // Build has its own targets, so the Sum/Subtract/Compare toggle is only
    // meaningful in learn/quiz; hide it in build mode.
    document.getElementById('operationToggle').classList.toggle('hidden', mode === 'build');
    // Expose the active mode on the body so CSS can adapt the layout
    // (e.g. hide the shapes palette in quiz/build mode on mobile, where it
    // isn't used and would otherwise squeeze the content off-screen).
    document.body.classList.toggle('mode-quiz', mode === 'quiz');
    document.body.classList.toggle('mode-learn', mode === 'learn');
    document.body.classList.toggle('mode-build', mode === 'build');
    updateSumCapVisibility();

    if (mode === 'quiz') {
        // Defer so the quiz area has real dimensions (it was display:none until
        // the class toggle above) before renderShapeRow measures it.
        requestAnimationFrame(generateQuizQuestion);
    } else if (mode === 'build') {
        // Defer so the stage has real dimensions before we render into it.
        requestAnimationFrame(() => {
            newBuildRound();
            renderBuildMode();
        });
    }
}

function switchOperation(op) {
    currentOperation = op;
    document.getElementById('sumBtn').classList.toggle('active', op === 'sum');
    document.getElementById('subtractBtn').classList.toggle('active', op === 'subtract');
    document.getElementById('compareBtn').classList.toggle('active', op === 'compare');
    updateSumCapVisibility();
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
    } else if (currentMode === 'build') {
        // Valid targets differ per style, so start a fresh round.
        newBuildRound();
        renderBuildMode();
    }
}

function clearLearn() {
    learnShapes = [];
    renderLearnMode();
}

// ============ INIT ============

// ============ THEME ============

const THEME_KEY = 'numberExplorer.theme';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function resolveTheme() {
    // Explicit user choice wins; otherwise follow the system setting.
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDark.matches ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('themeBtn');
    if (btn) {
        btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
}

function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
}

// Apply as early as possible to avoid a flash of the wrong theme.
applyTheme(resolveTheme());

// Keep following the system when the user hasn't made an explicit choice.
prefersDark.addEventListener('change', () => {
    if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(prefersDark.matches ? 'dark' : 'light');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => {
        renderPanel();
        renderLearnMode();
    });

    // Reflect the initial mode on the body for layout-dependent CSS.
    document.body.classList.toggle('mode-quiz', currentMode === 'quiz');
    document.body.classList.toggle('mode-learn', currentMode === 'learn');

    applyTheme(resolveTheme());
    document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);

    document.getElementById('learnBtn')?.addEventListener('click', () => switchMode('learn'));
    document.getElementById('quizBtn')?.addEventListener('click', () => switchMode('quiz'));
    document.getElementById('buildBtn')?.addEventListener('click', () => switchMode('build'));
    document.getElementById('buildNext')?.addEventListener('click', nextBuildRound);
    document.getElementById('sumBtn')?.addEventListener('click', () => switchOperation('sum'));
    document.getElementById('subtractBtn')?.addEventListener('click', () => switchOperation('subtract'));
    document.getElementById('compareBtn')?.addEventListener('click', () => switchOperation('compare'));
    document.getElementById('numiconBtn')?.addEventListener('click', () => switchShapeStyle('numicon'));
    document.getElementById('numberblocksBtn')?.addEventListener('click', () => switchShapeStyle('numberblocks'));
    document.getElementById('quizNext')?.addEventListener('click', generateQuizQuestion);

    const sumCapSlider = document.getElementById('sumCapSlider');
    sumCapSlider?.addEventListener('input', () => {
        maxOperand = parseInt(sumCapSlider.value, 10);
        document.getElementById('sumCapValue').textContent = maxOperand;
        if (currentMode === 'quiz') {
            quizScore = 0;
            quizTotal = 0;
            generateQuizQuestion();
        }
    });

    window.addEventListener('resize', () => requestAnimationFrame(() => {
        renderPanel();
        // Re-fit learn-mode shapes to the resized drop zone.
        if (currentMode === 'learn') renderLearnMode();
        // Re-fit quiz shapes/cards to the resized area. Only re-render before
        // the user has answered, so we don't disrupt feedback on screen.
        if (currentMode === 'quiz' && !quizAnswered) generateQuizQuestion();
        // Build: re-fit the stage to the new size by re-rendering the current
        // round. Only when nothing is placed yet, so we never wipe a child's
        // in-progress (or solved) construction out from under them.
        if (currentMode === 'build' && buildRound &&
            buildRound.placed.length === 0 && !buildRound.solved) {
            renderBuildMode();
        }
    }));
});
