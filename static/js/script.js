let templateCounter = 0;

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
        this.selectedIds = new Set();
        this.selectedWireIndices = new Set();
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.lastNodeMap = null; // Store node mapping for labels
        this.setupEvents();
    }

    setupEvents() {
        this.svg.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        this.svg.addEventListener('drop', (e) => this.handleDrop(e));
        this.svg.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.svg.addEventListener('mouseup', () => this.stopDragging());
        this.svg.addEventListener('click', (e) => this.handleClick(e));
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    snap(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    handleDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('comp-type');
        const template = e.dataTransfer.getData('template-type');
        
        const rect = this.svg.getBoundingClientRect();
        const x = this.snap(e.clientX - rect.left);
        const y = this.snap(e.clientY - rect.top);

        if (template) {
            this.loadTemplate(template, x, y);
            return;
        }

        if (!type) return;

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

    loadTemplate(type, x, y) {
        templateCounter++;
        const tpl = {
            series: {
                comps: [
                    { type: 'V', name: 'V', val: '12', dx: -60, dy: 0, rot: 90 },
                    { type: 'R', name: 'R', val: '1k', dx: 60, dy: 0, rot: 90 }
                ],
                wires: [
                    { n1: 0, p1: 1, n2: 1, p2: 1 },
                    { n1: 0, p1: 2, n2: 1, p2: 2 }
                ]
            },
            parallel: {
                comps: [
                    { type: 'V', name: 'V', val: '10', dx: -80, dy: 0, rot: 90 },
                    { type: 'R', name: 'R', val: '2k', dx: 0, dy: 0, rot: 90 },
                    { type: 'R', name: 'R', val: '2k', dx: 80, dy: 0, rot: 90 }
                ],
                wires: [
                    { n1: 0, p1: 1, n2: 1, p2: 1 }, { n1: 1, p1: 1, n2: 2, p2: 1 },
                    { n1: 0, p1: 2, n2: 1, p2: 2 }, { n1: 1, p1: 2, n2: 2, p2: 2 }
                ]
            },
            bridge: {
                comps: [
                    { type: 'V', name: 'V', val: '10', dx: -120, dy: 0, rot: 90 },
                    { type: 'R', name: 'R', val: '1k', dx: -40, dy: -40, rot: 0 },
                    { type: 'R', name: 'R', val: '1k', dx: 40, dy: -40, rot: 0 },
                    { type: 'R', name: 'R', val: '1k', dx: -40, dy: 40, rot: 0 },
                    { type: 'R', name: 'R', val: '1k', dx: 40, dy: 40, rot: 0 },
                    { type: 'R', name: 'R', val: '1k', dx: 0, dy: 0, rot: 90 }
                ],
                wires: [
                    { n1: 0, p1: 1, n2: 1, p2: 1 }, { n1: 1, p1: 1, n2: 2, p2: 1 },
                    { n1: 1, p1: 2, n2: 5, p2: 1 }, { n1: 2, p1: 2, n2: 5, p2: 2 },
                    { n1: 5, p1: 1, n2: 3, p2: 1 }, { n1: 5, p1: 2, n2: 4, p2: 1 },
                    { n1: 3, p1: 2, n2: 4, p2: 2 }, { n1: 4, p1: 2, n2: 0, p2: 2 }
                ]
            }
        };

        const config = tpl[type];
        if (!config) return;

        const newComps = config.comps.map((c, idx) => {
            const id = Date.now() + idx + (templateCounter * 100);
            const cx = x + c.dx;
            const cy = y + c.dy;
            const n1 = `n_${id}_1`;
            const n2 = `n_${id}_2`;
            
            if (c.rot === 90) {
                this.nodes[n1] = { x: cx, y: cy - 40 };
                this.nodes[n2] = { x: cx, y: cy + 40 };
            } else {
                this.nodes[n1] = { x: cx - 40, y: cy };
                this.nodes[n2] = { x: cx + 40, y: cy };
            }

            return { 
                id, 
                type: c.type, 
                name: `${c.name}${this.components.length + idx + 1}`, 
                value: c.val, 
                n1, n2, x: cx, y: cy, phase: 0 
            };
        });

        config.wires.forEach(w => {
            const node1 = w.p1 === 1 ? newComps[w.n1].n1 : newComps[w.n1].n2;
            const node2 = w.p2 === 1 ? newComps[w.n2].n1 : newComps[w.n2].n2;
            this.wires.push({ n1: node1, n2: node2 });
        });

        this.components.push(...newComps);
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
                const compsToMove = this.selectedIds.has(this.draggingComp.id) ? 
                                    this.components.filter(c => this.selectedIds.has(c.id)) : 
                                    [this.draggingComp];
                
                const affectedNodes = new Set();
                compsToMove.forEach(c => {
                    c.x += dx;
                    c.y += dy;
                    affectedNodes.add(c.n1);
                    affectedNodes.add(c.n2);
                });

                affectedNodes.forEach(nid => {
                    this.nodes[nid].x += dx;
                    this.nodes[nid].y += dy;
                });

                this.render();
            }
            return;
        }

        if (this.isSelecting) {
            this.selectionEnd = { x, y };
            this.updateSelection();
            this.render();
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

    handleMouseDown(e) {
        const rect = this.svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // If clicking background or grid dot, start selection
        if (e.target === this.svg || e.target.classList.contains('dot')) {
            this.isSelecting = true;
            this.selectionStart = { x, y };
            this.selectionEnd = { x, y };
            if (!e.shiftKey) {
                this.selectedIds.clear();
                this.selectedWireIndices.clear();
            }
            this.render();
        }
    }

    updateSelection() {
        const x1 = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const y1 = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const x2 = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const y2 = Math.max(this.selectionStart.y, this.selectionEnd.y);

        this.components.forEach(c => {
            if (c.x > x1 && c.x < x2 && c.y > y1 && c.y < y2) {
                this.selectedIds.add(c.id);
            }
        });

        this.wires.forEach((w, idx) => {
            const p1 = this.nodes[w.n1];
            const p2 = this.nodes[w.n2];
            if (!p1 || !p2) return; // Safety check
            if (p1.x > x1 && p1.x < x2 && p1.y > y1 && p1.y < y2 &&
                p2.x > x1 && p2.x < x2 && p2.y > y1 && p2.y < y2) {
                this.selectedWireIndices.add(idx);
            }
        });
    }

    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedIds.size > 0 || this.selectedWireIndices.size > 0) {
                // Delete selected components and their wires
                const deletedCompNodeIds = new Set();
                this.components.forEach(c => {
                    if (this.selectedIds.has(c.id)) {
                        deletedCompNodeIds.add(c.n1);
                        deletedCompNodeIds.add(c.n2);
                    }
                });

                this.components = this.components.filter(c => !this.selectedIds.has(c.id));
                
                // Delete selected wires OR wires connected to deleted components
                this.wires = this.wires.filter((w, idx) => {
                    if (this.selectedWireIndices.has(idx)) return false;
                    if (deletedCompNodeIds.has(w.n1) || deletedCompNodeIds.has(w.n2)) return false;
                    return true;
                });

                this.selectedIds.clear();
                this.selectedWireIndices.clear();
                this.lastNodeMap = null; // Clear labels
                this.render();
                clearResults(); // Reset results panel
            }
        }
    }

    startDragging(comp, e) {
        if (this.isWiring) return;
        this.draggingComp = comp;
        const rect = this.svg.getBoundingClientRect();
        this.dragOffset.x = comp.x - (e.clientX - rect.left);
        this.dragOffset.y = comp.y - (e.clientY - rect.top);

        if (!this.selectedIds.has(comp.id)) {
            if (!e.shiftKey) {
                this.selectedIds.clear();
                this.selectedWireIndices.clear();
            }
            this.selectedIds.add(comp.id);
        }
    }

    stopDragging() {
        const needsRender = this.draggingComp !== null || this.isSelecting;
        this.draggingComp = null;
        this.isSelecting = false;
        if (needsRender) this.render();
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
                dot.setAttribute("class", "dot");
                this.svg.appendChild(dot);
            }
        }

        // Draw Selection Box
        if (this.isSelecting) {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const x = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const y = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const w = Math.abs(this.selectionStart.x - this.selectionEnd.x);
            const h = Math.abs(this.selectionStart.y - this.selectionEnd.y);
            rect.setAttribute("x", x); rect.setAttribute("y", y);
            rect.setAttribute("width", w); rect.setAttribute("height", h);
            rect.setAttribute("fill", "rgba(0, 123, 255, 0.1)");
            rect.setAttribute("stroke", "var(--primary)");
            rect.setAttribute("stroke-dasharray", "4");
            this.svg.appendChild(rect);
        }

        // Draw wires
        this.wires.forEach((w, idx) => {
            const p1 = this.nodes[w.n1];
            const p2 = this.nodes[w.n2];
            if (p1 && p2) {
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
                line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
                line.setAttribute("stroke", this.selectedWireIndices.has(idx) ? "var(--secondary)" : "var(--primary)");
                line.setAttribute("stroke-width", this.selectedWireIndices.has(idx) ? "4" : "2");
                if (this.selectedWireIndices.has(idx)) {
                    line.style.filter = "drop-shadow(0 0 5px var(--secondary))";
                }
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

        // Draw node points and labels (Drawn last to be on top)
        const usedNodeIds = new Set();
        this.components.forEach(c => { usedNodeIds.add(c.n1); usedNodeIds.add(c.n2); });
        this.wires.forEach(w => { usedNodeIds.add(w.n1); usedNodeIds.add(w.n2); });

        const activeNodes = this.lastNodeMap ? Object.keys(this.lastNodeMap) : Array.from(usedNodeIds);
        activeNodes.forEach(nid => {
            const p = this.nodes[nid];
            if (!p) return;
            const nodeName = this.lastNodeMap ? this.lastNodeMap[nid] : null;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y);
            circle.setAttribute("r", nodeName ? "8" : "4"); // Increased r for visibility
            circle.setAttribute("class", "node-point");
            circle.setAttribute("data-node-id", nid);
            circle.style.pointerEvents = "none"; // Don't block pin clicks for wiring
            if (nodeName) circle.setAttribute("data-node-group", nodeName);
            
            // Ground node special color
            if (nodeName === '0') circle.style.stroke = "var(--secondary)";

            this.svg.appendChild(circle);

            if (nodeName) {
                const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                label.textContent = nodeName === '0' ? 'GND' : nodeName;
                label.setAttribute("x", p.x + 10);
                label.setAttribute("y", p.y - 10);
                label.setAttribute("class", "node-label-svg");
                if (nodeName === '0') label.style.fill = "var(--secondary)";
                this.svg.appendChild(label);
            }
        });
    }

    drawComponent(c, p1, p2) {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const outerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        outerGroup.setAttribute("transform", `translate(${midX}, ${midY}) rotate(${angle})`);
        this.svg.appendChild(outerGroup);

        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute("class", "comp-group");
        group.setAttribute("data-comp-id", c.id);
        outerGroup.appendChild(group);

        let mousedownPos = { x: 0, y: 0 };
        group.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            mousedownPos = { x: e.clientX, y: e.clientY };
            this.startDragging(c, e);
        });

        group.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            const dx = Math.abs(e.clientX - mousedownPos.x);
            const dy = Math.abs(e.clientY - mousedownPos.y);
            // Sadece tıklandıysa (sürüklenme yoksa) modalı aç
            if (dx < 3 && dy < 3) {
                openEditModal(c);
            }
            this.stopDragging();
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
        path.setAttribute("data-comp-id", c.id);
        if (this.selectedIds.has(c.id)) {
            path.style.stroke = "var(--secondary)";
            path.style.strokeWidth = "3px";
            path.style.filter = "drop-shadow(0 0 8px var(--secondary))";
        }
        let d = "";
        if (c.type === 'R') d = "M -15,0 L -12,-5 L -6,5 L 0,-5 L 6,5 L 12,-5 L 15,0";
        else if (c.type === 'C') d = "M -4,-10 L -4,10 M 4,-10 L 4,10 M -15,0 L -4,0 M 4,0 L 15,0";
        else if (c.type === 'L') d = "M -15,0 Q -10,-10 -5,0 Q 0,-10 5,0 Q 10,-10 15,0";
        else if (c.type === 'V' || c.type === 'I') {
            const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circ.setAttribute("r", "12"); circ.setAttribute("class", "comp-symbol");
            circ.setAttribute("data-comp-id", c.id);
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
            // Direct click handler for wiring - bypasses delegation issues
            pin.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.isWiring) return;
                if (!this.wireStartNode) {
                    this.wireStartNode = nodeId;
                    this.render();
                } else if (this.wireStartNode !== nodeId) {
                    const exists = this.wires.some(w => 
                        (w.n1 === this.wireStartNode && w.n2 === nodeId) ||
                        (w.n1 === nodeId && w.n2 === this.wireStartNode)
                    );
                    if (!exists) {
                        this.wires.push({ n1: this.wireStartNode, n2: nodeId });
                    }
                    this.wireStartNode = null;
                    this.lastNodeMap = null;
                    this.render();
                }
            });
            pin.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevent selection/dragging when clicking pins
            });
            this.svg.appendChild(pin);
        });
    }

    getMNAComponents() {
        const nodeMap = {}; 
        const groups = [];
        
        // Only consider nodes that are actually used by current components or wires
        const usedNodeIds = new Set();
        this.components.forEach(c => {
            usedNodeIds.add(c.n1);
            usedNodeIds.add(c.n2);
        });
        this.wires.forEach(w => {
            usedNodeIds.add(w.n1);
            usedNodeIds.add(w.n2);
        });

        if (usedNodeIds.size === 0) return [];

        const activeNodes = Array.from(usedNodeIds);
        activeNodes.forEach(n => groups.push(new Set([n])));
        
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
                if (this.nodes[nid] && this.nodes[nid].y > lowestY) {
                    lowestY = this.nodes[nid].y;
                    gndGroup = g;
                }
            });
        });

        groups.forEach((g) => {
            const name = (g === gndGroup) ? '0' : `N${groups.indexOf(g) + 1}`;
            g.forEach(n => nodeMap[n] = name);
        });

        this.lastNodeMap = nodeMap; // Save for rendering labels
        return this.components.map(c => ({
            ...c,
            n1: nodeMap[c.n1],
            n2: nodeMap[c.n2]
        }));
    }

    highlightNodeGroup(groupName, active) {
        const points = this.svg.querySelectorAll(`[data-node-group="${groupName}"]`);
        points.forEach(p => {
            if (active) {
                p.classList.add('active-highlight');
                p.setAttribute('r', '12');
            } else {
                p.classList.remove('active-highlight');
                p.setAttribute('r', '6');
            }
        });
    }

    highlightComponent(compId, active) {
        const symbols = this.svg.querySelectorAll(`[data-comp-id="${compId}"]`);
        symbols.forEach(s => {
            if (active) {
                s.classList.add('active-highlight');
            } else {
                s.classList.remove('active-highlight');
            }
        });
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

    const templates = document.querySelectorAll('.template-item[draggable="true"]');
    templates.forEach(t => {
        t.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('template-type', t.dataset.template);
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

        console.log("DEBUG: Sending payload to /solve:", payload);

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
            if (data.error) {
                console.error("DEBUG: Server returned error:", data.error);
                alert("Analiz Hatası: " + data.error);
            } else {
                displayResults(data);
                renderer.render(); // Ensure labels appear immediately
            }
        } catch (e) {
            console.error("DEBUG: Fetch error:", e);
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
        renderer.lastNodeMap = null;
        renderer.render();
        clearResults();
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
    const typeIcons = { 
        'R': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 12 6 12 8 6 12 18 16 6 18 12 22 12"></polyline></svg>',
        'C': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="10" y2="12"></line><line x1="14" y1="12" x2="22" y2="12"></line><line x1="10" y1="6" x2="10" y2="18"></line><line x1="14" y1="6" x2="14" y2="18"></line></svg>',
        'L': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3a3 3 0 0 1 6 0a3 3 0 0 1 6 0h3"></path></svg>',
        'V': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="10" y1="10" x2="14" y2="10"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>',
        'I': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="16" x2="12" y2="8"></line><polyline points="9 11 12 8 15 11"></polyline></svg>'
    };
    list.innerHTML = components.map(c => `
        <div class="sidebar-comp-item" 
             style="cursor: pointer;"
             onmouseenter="renderer.highlightComponent('${c.id}', true)"
             onmouseleave="renderer.highlightComponent('${c.id}', false)"
             onclick="const comp = renderer.components.find(x=>x.id==='${c.id}'); if(comp) openEditModal(comp);">
            <div class="sidebar-comp-icon">${typeIcons[c.type] || '⚙️'}</div>
            <div class="sidebar-comp-info">
                <span class="sidebar-comp-name">${c.name}</span>
                <span class="sidebar-comp-val">${c.value}</span>
            </div>
        </div>
    `).join('');
}

function parseValue(valStr) {
    if (typeof valStr !== 'string') return parseFloat(valStr);
    valStr = valStr.trim().toLowerCase();
    const suffixes = { 'k': 1e3, 'm': 1e-3, 'u': 1e-6, 'n': 1e-9, 'p': 1e-12, 'meg': 1e6 };
    for (const [s, m] of Object.entries(suffixes)) {
        if (valStr.endsWith(s)) return parseFloat(valStr.slice(0, -s.length)) * m;
    }
    return parseFloat(valStr);
}

function displayResults(data) {
    const resultsContent = document.getElementById('results-content');
    const components = renderer.getMNAComponents();
    const voltages = data.voltages;
    const currents = data.currents;
    
    let totalConsumed = 0;
    let totalSupplied = 0;

    let html = ``;

    // Components Section
    html += `<h3 class="result-section-title">Eleman Analizi</h3>`;
    components.forEach(c => {
        const v1 = voltages[c.n1]?.mag || 0;
        const v2 = voltages[c.n2]?.mag || 0;
        const vDrop = v1 - v2;
        
        let i = 0;
        let p = 0;
        let explanation = "";
        let status = "consuming";
        let statusText = "Tüketiyor";

        if (c.type === 'R') {
            const r = parseValue(c.value);
            i = Math.abs(vDrop / r);
            p = vDrop * (v1 - v2) / r; // P = V^2 / R
            p = Math.abs(p);
            totalConsumed += p;
            explanation = `Bu direnç üzerinden ${i.toFixed(4)}A akım akıyor. ${p.toFixed(4)}W enerjiyi ısıya dönüştürüyor.`;
        } else if (c.type === 'V') {
            const srcCurrent = currents[c.name]?.real || 0;
            // Power delivered by voltage source: P = V * I_source
            // In MNA, I_source is into n1. So P = -V * I_source if it delivers?
            // Let's use magnitude for simplicity in "beginner mode" but check direction
            i = Math.abs(srcCurrent);
            p = Math.abs(parseValue(c.value) * i);
            status = "delivering";
            statusText = "Üretiyor";
            totalSupplied += p;
            explanation = `Bu kaynak devreye ${p.toFixed(2)}W güç sağlıyor. Voltajı sabit ${c.value}V'da tutuyor.`;
        } else if (c.type === 'I') {
            i = parseValue(c.value);
            p = Math.abs(vDrop * i);
            status = "delivering";
            statusText = "Üretiyor";
            totalSupplied += p;
            explanation = `Bu akım kaynağı devreye ${p.toFixed(2)}W güç pompalıyor.`;
        } else {
            explanation = `${c.name} elemanı analiz edildi.`;
        }

        html += `
            <div class="comp-card ${status}" 
                 onmouseenter="renderer.highlightComponent('${c.id}', true)" 
                 onmouseleave="renderer.highlightComponent('${c.id}', false)">
                <div class="comp-card-header">
                    <span class="comp-id">${c.name}</span>
                    <span class="status-badge ${status}">${statusText}</span>
                </div>
                <div class="comp-metrics">
                    <div class="metric">
                        <span class="metric-label">Gerilim (ΔV)</span>
                        <span class="metric-val">${Math.abs(vDrop).toFixed(3)} V</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Akım (I)</span>
                        <span class="metric-val">${i.toFixed(4)} A</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Güç (P)</span>
                        <span class="metric-val">${p.toFixed(4)} W</span>
                    </div>
                </div>
                <p class="explanation-text">${explanation}</p>
            </div>
        `;
    });

    // Summary at the top
    const summaryHtml = `
        <div class="summary-card">
            <h4>Sistem Güç Dengesi</h4>
            <span class="summary-val">${totalSupplied.toFixed(2)} W Üretiliyor</span>
            <span class="summary-note">Devredeki kaynaklar toplam ${totalSupplied.toFixed(4)}W güç sağlıyor.</span>
        </div>
    `;

    // Nodes Section
    let nodesHtml = `<h3 class="result-section-title">Düğüm Gerilimleri</h3>`;
    for (const [node, info] of Object.entries(voltages)) {
        const isGnd = node === '0';
        const displayName = isGnd ? "Referans (GND)" : `Düğüm ${node}`;
        const cardClass = isGnd ? "node-card gnd" : "node-card";
        
        nodesHtml += `
            <div class="${cardClass}" 
                 onmouseenter="renderer.highlightNodeGroup('${node}', true)" 
                 onmouseleave="renderer.highlightNodeGroup('${node}', false)">
                <div class="node-info-main">
                    <h4>${displayName}</h4>
                    <span class="node-usage">${isGnd ? "0V Referans Noktası" : "Ölçülen Potansiyel"}</span>
                </div>
                <span class="val">${info.mag.toFixed(3)} V</span>
            </div>
        `;
    }

    resultsContent.innerHTML = summaryHtml + nodesHtml + html;
}

function clearResults() {
    const resultsContent = document.getElementById('results-content');
    if (!resultsContent) return;
    resultsContent.innerHTML = `
        <div class="placeholder-results">
            <div class="pulse-icon">📊</div>
            <p>Sonuçlar burada görünecek.</p>
        </div>
    `;
}
