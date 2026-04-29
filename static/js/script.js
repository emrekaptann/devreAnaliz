class SchematicRenderer {
    constructor(svgId) {
        this.svg = document.getElementById(svgId);
        this.components = [];
        this.nodes = {}; // { id: { x, y } }
        this.wires = []; // { n1, n2 }
        this.isWiring = false;
        this.wireStartNode = null;
        this.draggingComp = null;
        this.dragOffset = { x: 0, y: 0 };
        this.gridSize = 20;
        this.setupEvents();
    }

    setupEvents() {
        this.svg.addEventListener('dragover', (e) => e.preventDefault());
        this.svg.addEventListener('drop', (e) => this.handleDrop(e));
        this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.svg.addEventListener('mouseup', () => this.stopDragging());
        this.svg.addEventListener('click', (e) => this.handleClick(e));
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    handleDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('comp-type');
        if (!type) return;

        const rect = this.svg.getBoundingClientRect();
        const x = this.snap(e.clientX - rect.left);
        const y = this.snap(e.clientY - rect.top);

        const compId = Date.now();
        const n1 = `n_${compId}_1`;
        const n2 = `n_${compId}_2`;

        this.nodes[n1] = { x: x - 40, y: y };
        this.nodes[n2] = { x: x + 40, y: y };

        const newComp = {
            id: compId,
            type: type,
            name: `${type}${this.components.length + 1}`,
            value: type === 'V' ? '10' : (type === 'R' ? '1k' : '1u'),
            n1: n1,
            n2: n2,
            phase: 0,
            x: x,
            y: y
        };

        this.components.push(newComp);
        this.render();
    }

    handleMouseMove(e) {
        const rect = this.svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.draggingComp) {
            const dx = this.snap(x + this.dragOffset.x) - this.draggingComp.x;
            const dy = this.snap(y + this.dragOffset.y) - this.draggingComp.y;

            if (dx !== 0 || dy !== 0) {
                this.draggingComp.x += dx;
                this.draggingComp.y += dy;
                this.nodes[this.draggingComp.n1].x += dx;
                this.nodes[this.draggingComp.n1].y += dy;
                this.nodes[this.draggingComp.n2].x += dx;
                this.nodes[this.draggingComp.n2].y += dy;
                this.render();
            }
            return;
        }

        if (this.isWiring && this.wireStartNode) {
            this.render();
            const startPos = this.nodes[this.wireStartNode];
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", startPos.x); line.setAttribute("y1", startPos.y);
            line.setAttribute("x2", x); line.setAttribute("y2", y);
            line.setAttribute("class", "wire-preview");
            this.svg.appendChild(line);
        }
    }

    handleClick(e) {
        if (this.isWiring && e.target.classList.contains('pin')) {
            const nodeId = e.target.dataset.node;
            if (!this.wireStartNode) {
                this.wireStartNode = nodeId;
                this.render(); // Highlight start node
            } else if (this.wireStartNode !== nodeId) {
                // Check if already wired
                const exists = this.wires.some(w => 
                    (w.n1 === this.wireStartNode && w.n2 === nodeId) ||
                    (w.n1 === nodeId && w.n2 === this.wireStartNode)
                );
                if (!exists) {
                    this.wires.push({ n1: this.wireStartNode, n2: nodeId });
                }
                this.wireStartNode = null;
                this.render();
            }
            return;
        }
        
        // Deselect wire tool if clicking empty space
        if (this.isWiring && e.target === this.svg) {
            this.wireStartNode = null;
            this.render();
        }
    }

    startDragging(comp, e) {
        if (this.isWiring) return;
        this.draggingComp = comp;
        const rect = this.svg.getBoundingClientRect();
        this.dragOffset.x = comp.x - (e.clientX - rect.left);
        this.dragOffset.y = comp.y - (e.clientY - rect.top);
    }

    stopDragging() {
        this.draggingComp = null;
    }

    render() {
        const defs = this.svg.querySelector('defs');
        this.svg.innerHTML = '';
        if (defs) this.svg.appendChild(defs);

        // Draw background grid
        for (let i = 0; i < this.svg.clientWidth; i += this.gridSize) {
            for (let j = 0; j < this.svg.clientHeight; j += this.gridSize) {
                const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dot.setAttribute("cx", i); dot.setAttribute("cy", j);
                dot.setAttribute("r", "0.5"); dot.setAttribute("fill", "var(--border)");
                this.svg.appendChild(dot);
            }
        }

        // Draw wires
        this.wires.forEach(w => {
            const p1 = this.nodes[w.n1];
            const p2 = this.nodes[w.n2];
            if (p1 && p2) {
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
                line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
                line.setAttribute("stroke", "var(--primary)");
                line.setAttribute("stroke-width", "2");
                this.svg.appendChild(line);
            }
        });

        // Draw components
        this.components.forEach(c => {
            const p1 = this.nodes[c.n1];
            const p2 = this.nodes[c.n2];
            this.drawComponent(c, p1, p2);
        });

        updateSidebarComponentList(this.components);
    }

    drawComponent(c, p1, p2) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("transform", `translate(${midX}, ${midY}) rotate(${angle})`);
        this.svg.appendChild(group);

        group.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.startDragging(c, e);
        });

        group.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.draggingComp) openEditModal(c);
        });

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.textContent = `${c.name} (${c.value})`;
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("y", -25);
        text.setAttribute("class", "comp-text");
        let labelRotate = 0;
        if (Math.abs(angle) > 90) labelRotate = 180;
        text.setAttribute("transform", `rotate(${labelRotate})`);
        group.appendChild(text);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "comp-symbol");
        let d = "";
        if (c.type === 'R') d = "M -15,0 L -12,-5 L -6,5 L 0,-5 L 6,5 L 12,-5 L 15,0";
        else if (c.type === 'C') d = "M -4,-10 L -4,10 M 4,-10 L 4,10 M -15,0 L -4,0 M 4,0 L 15,0";
        else if (c.type === 'L') d = "M -15,0 Q -10,-10 -5,0 Q 0,-10 5,0 Q 10,-10 15,0";
        else if (c.type === 'V' || c.type === 'I') {
            const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circ.setAttribute("r", "12"); circ.setAttribute("class", "comp-symbol");
            group.appendChild(circ);
            if (c.type === 'V') d = "M -8,0 L -2,0 M -5,-3 L -5,3 M 3,0 L 8,0";
            else d = "M -7,0 L 7,0 M 2,-3 L 7,0 L 2,3";
        }
        path.setAttribute("d", d);
        group.appendChild(path);

        // Terminals
        [p1, p2].forEach((p, i) => {
            const nodeId = i === 0 ? c.n1 : c.n2;
            const pin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            pin.setAttribute("cx", p.x); pin.setAttribute("cy", p.y);
            pin.setAttribute("r", "5"); pin.setAttribute("class", "pin");
            pin.setAttribute("data-node", nodeId);
            if (this.wireStartNode === nodeId) {
                pin.setAttribute("r", "8");
                pin.style.fill = "var(--primary)";
            }
            this.svg.appendChild(pin);
        });
    }

    getMNAComponents() {
        const nodeMap = {}; 
        const groups = [];
        const allNodeIds = Object.keys(this.nodes);
        if (allNodeIds.length === 0) return [];

        allNodeIds.forEach(n => groups.push(new Set([n])));
        this.wires.forEach(w => {
            let g1 = groups.find(g => g.has(w.n1));
            let g2 = groups.find(g => g.has(w.n2));
            if (g1 && g2 && g1 !== g2) {
                g2.forEach(n => g1.add(n));
                groups.splice(groups.indexOf(g2), 1);
            }
        });

        // Heuristic for Ground: lowest y-coordinate node or first group
        let gndGroup = groups[0];
        let lowestY = -Infinity;
        groups.forEach(g => {
            g.forEach(nid => {
                if (this.nodes[nid].y > lowestY) {
                    lowestY = this.nodes[nid].y;
                    gndGroup = g;
                }
            });
        });

        groups.forEach((g) => {
            const name = (g === gndGroup) ? '0' : `N${groups.indexOf(g) + 1}`;
            g.forEach(n => nodeMap[n] = name);
        });

        return this.components.map(c => ({
            ...c,
            n1: nodeMap[c.n1],
            n2: nodeMap[c.n2]
        }));
    }
}

let renderer;
let compToEdit = null;

document.addEventListener('DOMContentLoaded', () => {
    renderer = new SchematicRenderer('schematic-svg');

    // Toolbar Dragging
    const tools = document.querySelectorAll('.tool[draggable="true"]');
    tools.forEach(t => {
        t.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('comp-type', t.dataset.type);
        });
    });

    // Wire Tool
    const wireTool = document.getElementById('wire-tool');
    wireTool.addEventListener('click', () => {
        renderer.isWiring = !renderer.isWiring;
        wireTool.classList.toggle('active', renderer.isWiring);
        if (!renderer.isWiring) renderer.wireStartNode = null;
    });

    // Modal Events
    const modal = document.getElementById('edit-modal');
    const saveBtn = document.getElementById('modal-save');
    const deleteBtn = document.getElementById('modal-delete');
    const closeBtn = document.getElementById('modal-close');

    saveBtn.addEventListener('click', () => {
        if (compToEdit) {
            compToEdit.name = document.getElementById('edit-name').value;
            const valNum = document.getElementById('edit-value-num').value;
            const valUnit = document.getElementById('edit-value-unit').value;
            compToEdit.value = `${valNum}${valUnit}`;
            compToEdit.phase = parseFloat(document.getElementById('edit-phase').value || 0);
            renderer.render();
            modal.classList.add('hidden');
        }
    });

    deleteBtn.addEventListener('click', () => {
        if (compToEdit) {
            renderer.components = renderer.components.filter(c => c.id !== compToEdit.id);
            // Also cleanup standalone nodes/wires? Keeping it simple for now.
            renderer.render();
            modal.classList.add('hidden');
        }
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // Solve
    document.getElementById('solve-btn').addEventListener('click', async () => {
        const mnaComps = renderer.getMNAComponents();
        if (mnaComps.length === 0) return;

        const payload = {
            frequency: document.getElementById('ac-mode').classList.contains('active') ? 
                      parseFloat(document.getElementById('circuit-freq').value) : 0,
            components: mnaComps
        };

        const solveBtn = document.getElementById('solve-btn');
        solveBtn.disabled = true;
        solveBtn.innerText = 'Hesaplanıyor...';

        try {
            const res = await fetch('/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            else displayResults(data);
        } catch (e) {
            alert('Sunucu hatası');
        } finally {
            solveBtn.disabled = false;
            solveBtn.innerText = 'Hesapla';
        }
    });

    // Clear
    document.getElementById('clear-btn').addEventListener('click', () => {
        renderer.components = [];
        renderer.nodes = {};
        renderer.wires = [];
        renderer.render();
    });
    
    // Theme Toggle (re-applied logic)
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.innerText = '☀️';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.innerText = '🌙';
        }
    };
    applyTheme(savedTheme);
    themeToggle.addEventListener('click', () => {
        const isDark = !document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark ? 'dark' : 'light');
    });
});

function openEditModal(c) {
    compToEdit = c;
    const modal = document.getElementById('edit-modal');
    document.getElementById('edit-name').value = c.name;
    
    // Parse value like "10k" or "1.5" or "470u"
    const valStr = c.value || "";
    const match = valStr.match(/^([\d.]+)([pnumkM]?)$/);
    if (match) {
        document.getElementById('edit-value-num').value = match[1];
        document.getElementById('edit-value-unit').value = match[2];
    } else {
        document.getElementById('edit-value-num').value = valStr;
        document.getElementById('edit-value-unit').value = "";
    }

    const unitLabels = { 'R': 'Ω', 'C': 'F', 'L': 'H', 'V': 'V', 'I': 'A' };
    document.getElementById('unit-label').innerText = unitLabels[c.type] || '';
    
    const phaseGroup = document.getElementById('edit-phase-group');
    if (['V', 'I'].includes(c.type)) phaseGroup.classList.remove('hidden');
    else phaseGroup.classList.add('hidden');
    
    modal.classList.remove('hidden');
}

function updateSidebarComponentList(components) {
    const list = document.getElementById('component-list');
    if (components.length === 0) {
        list.innerHTML = '<p class="empty-msg">Sürükleyip eleman ekleyin...</p>';
        return;
    }
    list.innerHTML = components.map(c => `
        <div class="comp-item">
            <b>${c.name}</b>: ${c.value}
        </div>
    `).join('');
}

function displayResults(data) {
    const resultsContent = document.getElementById('results-content');
    let html = `<h3>Sonuçlar</h3><div class="result-grid">`;
    
    for (const [node, info] of Object.entries(data.voltages)) {
        html += `
            <div class="node-card">
                <h4>Düğüm ${node}</h4>
                <span class="val">${info.mag.toFixed(4)}V</span>
            </div>
        `;
    }
    
    html += `</div>`;
    resultsContent.innerHTML = html;
}
