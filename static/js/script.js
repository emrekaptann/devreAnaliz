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
        let n1, n2, n3 = null;

        if (type === 'OP') {
            n1 = `n_${compId}_1`; // In+
            n2 = `n_${compId}_2`; // In-
            n3 = `n_${compId}_3`; // Out
            this.nodes[n1] = { x: x - 40, y: y - 20 };
            this.nodes[n2] = { x: x - 40, y: y + 20 };
            this.nodes[n3] = { x: x + 40, y: y };
        } else {
            n1 = `n_${compId}_1`;
            n2 = `n_${compId}_2`;
            this.nodes[n1] = { x: x - 40, y: y };
            this.nodes[n2] = { x: x + 40, y: y };
        }

        // Set default value based on component type
        let defaultValue = '1k';
        if (type === 'V') defaultValue = '10';
        else if (type === 'I') defaultValue = '1';
        else if (type === 'C') defaultValue = '1u';
        else if (type === 'L') defaultValue = '10m';
        else if (type === 'D') defaultValue = ''; // Diode does not need value
        else if (type === 'OP') defaultValue = '1e5'; // Op-Amp gain

        const newComp = {
            id: compId,
            type: type,
            name: `${type}${this.components.length + 1}`,
            value: defaultValue,
            n1: n1,
            n2: n2,
            phase: 0,
            x: x,
            y: y
        };
        if (n3) {
            newComp.n3 = n3;
        }

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
            v_divider: {
                comps: [
                    { type: 'V', name: 'V', val: '12', dx: -60, dy: 0, rot: 90 },
                    { type: 'R', name: 'R1', val: '1k', dx: 60, dy: -60, rot: 90 },
                    { type: 'R', name: 'R2', val: '2k', dx: 60, dy: 60, rot: 90 }
                ],
                wires: [
                    { n1: 0, p1: 1, n2: 1, p2: 1 },
                    { n1: 0, p1: 2, n2: 2, p2: 2 },
                    { n1: 1, p1: 2, n2: 2, p2: 1 }
                ]
            },
            i_divider: {
                comps: [
                    { type: 'I', name: 'I', val: '2', dx: -80, dy: 0, rot: 90 },
                    { type: 'R', name: 'R1', val: '1k', dx: 0, dy: 0, rot: 90 },
                    { type: 'R', name: 'R2', val: '1k', dx: 80, dy: 0, rot: 90 }
                ],
                wires: [
                    { n1: 0, p1: 1, n2: 1, p2: 1 }, { n1: 1, p1: 1, n2: 2, p2: 1 },
                    { n1: 0, p1: 2, n2: 1, p2: 2 }, { n1: 1, p1: 2, n2: 2, p2: 2 }
                ]
            },
            bridge: {
                comps: [
                    { type: 'V', name: 'V', val: '10', dx: -120, dy: 0, rot: 90 },
                    { type: 'R', name: 'R', val: '1k', dx: -28, dy: -28, rot: -45 },
                    { type: 'R', name: 'R', val: '1k', dx: 28, dy: -28, rot: 45 },
                    { type: 'R', name: 'R', val: '1k', dx: -28, dy: 28, rot: 45 },
                    { type: 'R', name: 'R', val: '1k', dx: 28, dy: 28, rot: -45 },
                    { type: 'R', name: 'R', val: '1k', dx: 0, dy: 0, rot: 0 }
                ],
                wires: [
                    { n1: 1, p1: 2, n2: 2, p2: 1 },
                    { n1: 3, p1: 2, n2: 4, p2: 1 },
                    { n1: 1, p1: 1, n2: 3, p2: 1 },
                    { n1: 2, p1: 2, n2: 4, p2: 2 },
                    { n1: 5, p1: 1, n2: 1, p2: 1 },
                    { n1: 5, p1: 2, n2: 2, p2: 2 },
                    { n1: 0, p1: 1, n2: 1, p2: 2 },
                    { n1: 0, p1: 2, n2: 3, p2: 2 }
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
            
            const angleRad = (c.rot || 0) * Math.PI / 180;
            this.nodes[n1] = { 
                x: cx - Math.round(Math.cos(angleRad) * 40), 
                y: cy - Math.round(Math.sin(angleRad) * 40) 
            };
            this.nodes[n2] = { 
                x: cx + Math.round(Math.cos(angleRad) * 40), 
                y: cy + Math.round(Math.sin(angleRad) * 40) 
            };

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
                    if (c.n3) affectedNodes.add(c.n3);
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
        if (e.target === this.svg || e.target.classList.contains('dot') || e.target.classList.contains('grid-bg')) {
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

    deleteComponents(compIds) {
        if (!compIds || compIds.size === 0) return;
        
        const deletedCompNodeIds = new Set();
        this.components.forEach(c => {
            if (compIds.has(c.id)) {
                deletedCompNodeIds.add(c.n1);
                deletedCompNodeIds.add(c.n2);
                if (c.n3) deletedCompNodeIds.add(c.n3);
            }
        });

        this.components = this.components.filter(c => !compIds.has(c.id));

        deletedCompNodeIds.forEach(nid => {
            delete this.nodes[nid];
        });

        this.wires = this.wires.filter(w => !deletedCompNodeIds.has(w.n1) && !deletedCompNodeIds.has(w.n2));
        
        this.selectedIds.clear();
        this.selectedWireIndices.clear();
        this.lastNodeMap = null;
        this.render();
        clearResults();
    }

    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            let changed = false;
            
            if (this.selectedIds.size > 0) {
                this.deleteComponents(this.selectedIds);
                changed = true;
            }

            if (this.selectedWireIndices.size > 0) {
                this.wires = this.wires.filter((w, idx) => !this.selectedWireIndices.has(idx));
                this.selectedWireIndices.clear();
                changed = true;
            }

            if (changed) {
                this.lastNodeMap = null;
                this.render();
                clearResults();
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

    runDRC() {
        const warnings = [];
        const floatingNodeIds = new Set();
        const burnedResistorIds = new Set();
        
        // 1. Check for unconnected / floating node pins
        const nodeConnectionCounts = {};
        for (const nid in this.nodes) {
            nodeConnectionCounts[nid] = 0;
        }
        this.components.forEach(c => {
            if (nodeConnectionCounts[c.n1] !== undefined) nodeConnectionCounts[c.n1]++;
            if (nodeConnectionCounts[c.n2] !== undefined) nodeConnectionCounts[c.n2]++;
            if (c.n3 && nodeConnectionCounts[c.n3] !== undefined) nodeConnectionCounts[c.n3]++;
        });
        this.wires.forEach(w => {
            if (nodeConnectionCounts[w.n1] !== undefined) nodeConnectionCounts[w.n1]++;
            if (nodeConnectionCounts[w.n2] !== undefined) nodeConnectionCounts[w.n2]++;
        });
        for (const nid in nodeConnectionCounts) {
            if (nodeConnectionCounts[nid] <= 1) {
                floatingNodeIds.add(nid);
            }
        }
        if (floatingNodeIds.size > 0) {
            warnings.push({
                type: 'floating_node',
                message: `Uyarı: Boşta Duran Bağlantı! Bazı pinler devreye bağlanmamıştır (sarı noktalar).`
            });
        }

        // 2. Check for short circuited voltage sources
        if (this.lastNodeMap) {
            this.components.forEach(c => {
                if (c.type === 'V') {
                    const n1Mapped = this.lastNodeMap[c.n1];
                    const n2Mapped = this.lastNodeMap[c.n2];
                    if (n1Mapped && n2Mapped && n1Mapped === n2Mapped) {
                        warnings.push({
                            type: 'short_circuit',
                            message: `Kritik Hata: Gerilim kaynağı ${c.name} kısa devre edilmiş!`,
                            compId: c.id
                        });
                    }
                }
            });
        }

        // 3. Check for burned resistors (> 0.25W)
        if (this.lastSolveResults && this.lastSolveResults.voltages && this.lastNodeMap) {
            const voltages = this.lastSolveResults.voltages;
            this.components.forEach(c => {
                if (c.type === 'R') {
                    const n1Mapped = this.lastNodeMap[c.n1];
                    const n2Mapped = this.lastNodeMap[c.n2];
                    const v1Info = voltages[n1Mapped];
                    const v2Info = voltages[n2Mapped];
                    const v1 = v1Info ? (v1Info.mag !== undefined ? v1Info.mag : Math.abs(v1Info.real || v1Info || 0)) : 0;
                    const v2 = v2Info ? (v2Info.mag !== undefined ? v2Info.mag : Math.abs(v2Info.real || v2Info || 0)) : 0;
                    const vDrop = v1 - v2;
                    const r = parseValue(c.value);
                    const p = (vDrop * vDrop) / r;
                    if (p > 0.25) {
                        burnedResistorIds.add(c.id);
                        warnings.push({
                            type: 'overload',
                            message: `Direnç Aşırı Güç: ${c.name} direnci 0.25W sınırını aştı (${p.toFixed(3)}W)! Yanma riski!`,
                            compId: c.id
                        });
                    }
                }
            });
        }

        return { warnings, floatingNodeIds, burnedResistorIds };
    }

    render() {
        const drc = this.runDRC();
        this.floatingNodeIds = drc.floatingNodeIds;
        this.burnedResistorIds = drc.burnedResistorIds;
        this.drcWarnings = drc.warnings;

        const defs = this.svg.querySelector('defs');
        this.svg.innerHTML = '';
        if (defs) this.svg.appendChild(defs);

        // Draw background grid using SVG Pattern
        const gridRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        gridRect.setAttribute("width", "100%");
        gridRect.setAttribute("height", "100%");
        gridRect.setAttribute("fill", "url(#gridPattern)");
        gridRect.setAttribute("class", "grid-bg");
        this.svg.appendChild(gridRect);

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
                line.setAttribute("stroke-width", this.selectedWireIndices.has(idx) ? "4" : "2.5");
                if (this.selectedWireIndices.has(idx)) {
                    line.style.filter = "drop-shadow(0 0 5px var(--secondary))";
                }
                this.svg.appendChild(line);

                // Add current flow animation overlay
                if (this.lastSolveResults && this.lastSolveResults.voltages && this.lastNodeMap) {
                    const nodeName1 = this.lastNodeMap[w.n1];
                    const nodeName2 = this.lastNodeMap[w.n2];
                    const v1Info = nodeName1 ? this.lastSolveResults.voltages[nodeName1] : null;
                    const v2Info = nodeName2 ? this.lastSolveResults.voltages[nodeName2] : null;
                    
                    const v1 = v1Info ? (v1Info.mag !== undefined ? v1Info.mag : Math.abs(v1Info.real || v1Info)) : 0;
                    const v2 = v2Info ? (v2Info.mag !== undefined ? v2Info.mag : Math.abs(v2Info.real || v2Info)) : 0;
                    
                    // Only animate if there is potential (voltage) in the node group
                    if (v1 > 0.01 || v2 > 0.01) {
                        const flowLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        flowLine.setAttribute("x1", p1.x); flowLine.setAttribute("y1", p1.y);
                        flowLine.setAttribute("x2", p2.x); flowLine.setAttribute("y2", p2.y);
                        flowLine.setAttribute("stroke", "var(--secondary)");
                        flowLine.setAttribute("stroke-width", "2");
                        flowLine.setAttribute("class", "wire-flow-animation");
                        this.svg.appendChild(flowLine);
                    }
                }
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
        this.components.forEach(c => {
            usedNodeIds.add(c.n1);
            usedNodeIds.add(c.n2);
            if (c.n3) usedNodeIds.add(c.n3);
        });
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

            // Highlight floating nodes in yellow/orange
            if (this.floatingNodeIds && this.floatingNodeIds.has(nid)) {
                circle.style.stroke = "#eab308";
                circle.style.strokeWidth = "2.5px";
                circle.setAttribute("r", "7");
            }

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
        let angle = 0;
        let midX = c.x;
        let midY = c.y;
        
        if (c.type !== 'OP') {
            angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
            midX = (p1.x + p2.x) / 2;
            midY = (p1.y + p2.y) / 2;
        }

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
        let valDisplay = c.value ? ` (${c.value})` : "";
        text.textContent = `${c.name}${valDisplay}`;
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("y", c.type === 'OP' ? -40 : -25);
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
        if (this.burnedResistorIds && this.burnedResistorIds.has(c.id)) {
            path.classList.add('burned-resistor');
        }
        let d = "";
        if (c.type === 'R') d = "M -40,0 L -20,0 L -15,-8 L -5,8 L 5,-8 L 15,8 L 20,0 L 40,0";
        else if (c.type === 'C') d = "M -40,0 L -6,0 M -6,-15 L -6,15 M 6,-15 L 6,15 M 6,0 L 40,0";
        else if (c.type === 'L') d = "M -40,0 L -20,0 A 6.66 6.66 0 0 1 -6.66 0 A 6.66 6.66 0 0 1 6.66 0 A 6.66 6.66 0 0 1 20 0 L 40,0";
        else if (c.type === 'V' || c.type === 'I') {
            const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circ.setAttribute("r", "16"); circ.setAttribute("class", "comp-symbol");
            circ.setAttribute("data-comp-id", c.id);
            group.appendChild(circ);
            if (c.type === 'V') d = "M -40,0 L -16,0 M 16,0 L 40,0 M -10,0 L -4,0 M -7,-3 L -7,3 M 4,0 L 10,0";
            else d = "M -40,0 L -16,0 M 16,0 L 40,0 M -10,0 L 10,0 M 4,-5 L 10,0 L 4,5";
        }
        else if (c.type === 'D') {
            d = "M -40,0 L -10,0 M -10,-12 L 10,0 L -10,12 Z M 10,-12 L 10,12 M 10,0 L 40,0";
        }
        else if (c.type === 'OP') {
            d = "M -20,-30 L 20,0 L -20,30 Z M -40,-20 L -20,-20 M -40,20 L -20,20 M 20,0 L 40,0 M -15,-12 L -9,-12 M -12,-15 L -12,-9 M -15,12 L -9,12";
        }
        path.setAttribute("d", d);
        group.appendChild(path);

        // Terminals
        const pins = [];
        pins.push({ p: p1, nodeId: c.n1 });
        pins.push({ p: p2, nodeId: c.n2 });
        if (c.n3 && this.nodes[c.n3]) {
            pins.push({ p: this.nodes[c.n3], nodeId: c.n3 });
        }

        pins.forEach(({ p, nodeId }) => {
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
            if (c.n3) usedNodeIds.add(c.n3);
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
        return this.components.map(c => {
            const mapped = {
                ...c,
                n1: nodeMap[c.n1],
                n2: nodeMap[c.n2]
            };
            if (c.n3) {
                mapped.n3 = nodeMap[c.n3];
            }
            return mapped;
        });
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
    window.renderer = renderer;

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
            renderer.deleteComponents(new Set([compToEdit.id]));
            modal.classList.add('hidden');
        }
    });

    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // Solve
    document.getElementById('solve-btn').addEventListener('click', async () => {
        const mnaComps = renderer.getMNAComponents();
        if (mnaComps.length === 0) return;

        let mode = 'steady';
        if (document.getElementById('transient-mode').classList.contains('active')) {
            mode = 'transient';
        }

        const payload = {
            mode: mode,
            frequency: (mode === 'transient' || document.getElementById('ac-mode').classList.contains('active')) ? 
                      parseFloat(document.getElementById('circuit-freq').value || 1000) : 0,
            t_stop: parseFloat(document.getElementById('transient-stop').value || 0.01),
            t_step: parseFloat(document.getElementById('transient-step').value || 0.0001),
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
                renderer.lastSolveResults = data;
                displayResults(data);
                renderer.render(); // Ensure labels and flow overlay appear immediately
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
        renderer.lastSolveResults = null;
        if (window.chartInstance) {
            window.chartInstance.destroy();
            window.chartInstance = null;
        }
        renderer.render();
        clearResults();
    });

    // Mode Toggles
    const dcMode = document.getElementById('dc-mode');
    const acMode = document.getElementById('ac-mode');
    const transientMode = document.getElementById('transient-mode');
    const freqConfig = document.getElementById('freq-config');
    const transientConfig = document.getElementById('transient-config');
    const chartContainer = document.getElementById('chart-container');
    
    dcMode.addEventListener('click', () => {
        dcMode.classList.add('active');
        acMode.classList.remove('active');
        transientMode.classList.remove('active');
        freqConfig.classList.add('hidden');
        transientConfig.classList.add('hidden');
        chartContainer.classList.add('hidden');
        if (window.chartInstance) { window.chartInstance.destroy(); window.chartInstance = null; }
        renderer.lastSolveResults = null;
        clearResults();
        renderer.render();
    });
    
    acMode.addEventListener('click', () => {
        acMode.classList.add('active');
        dcMode.classList.remove('active');
        transientMode.classList.remove('active');
        freqConfig.classList.remove('hidden');
        transientConfig.classList.add('hidden');
        chartContainer.classList.add('hidden');
        if (window.chartInstance) { window.chartInstance.destroy(); window.chartInstance = null; }
        renderer.lastSolveResults = null;
        clearResults();
        renderer.render();
    });

    transientMode.addEventListener('click', () => {
        transientMode.classList.add('active');
        dcMode.classList.remove('active');
        acMode.classList.remove('active');
        freqConfig.classList.add('hidden');
        transientConfig.classList.remove('hidden');
        chartContainer.classList.remove('hidden');
        renderer.lastSolveResults = null;
        clearResults();
        renderer.render();
    });

    // Save JSON
    document.getElementById('save-json-btn').addEventListener('click', () => {
        const payload = {
            components: renderer.components,
            nodes: renderer.nodes,
            wires: renderer.wires
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = `devre_tasarimi_${Date.now()}.json`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);
    });

    // Load JSON
    const fileInput = document.getElementById('json-file-input');
    document.getElementById('load-json-btn').addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed.components && parsed.nodes && parsed.wires) {
                    renderer.components = parsed.components;
                    renderer.nodes = parsed.nodes;
                    renderer.wires = parsed.wires;
                    renderer.lastNodeMap = null;
                    renderer.lastSolveResults = null;
                    if (window.chartInstance) {
                        window.chartInstance.destroy();
                        window.chartInstance = null;
                    }
                    renderer.render();
                    clearResults();
                } else {
                    alert("Hata: Geçersiz dosya formatı.");
                }
            } catch (err) {
                alert("JSON okuma hatası.");
            }
        };
        reader.readAsText(file);
        fileInput.value = ""; // Reset
    });

    // Export PNG
    document.getElementById('export-png-btn').addEventListener('click', () => {
        const svgElement = document.getElementById('schematic-svg');
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgElement);
        
        const isDark = document.body.classList.contains('dark-mode');
        const bgColor = isDark ? '#161b22' : '#e9ecef';
        const primaryColor = isDark ? '#00d2ff' : '#007bff';
        const textColor = isDark ? '#e0e0e0' : '#212529';
        const accentColor = isDark ? '#ff416c' : '#dc3545';
        
        const styleText = `
            text { font-family: 'Outfit', sans-serif; fill: ${textColor}; }
            .comp-symbol { stroke: ${primaryColor}; fill: none; stroke-width: 2px; }
            .comp-text { fill: ${textColor}; font-size: 12px; }
            .pin { fill: rgba(120, 120, 120, 0.2); stroke: rgba(120, 120, 120, 0.4); }
            .node-point { fill: ${accentColor}; }
            .node-label-svg { fill: ${textColor}; font-size: 10px; font-weight: bold; }
            line, path { stroke: ${primaryColor}; stroke-width: 2.5px; fill: none; }
        `;
        const styleElement = `<style>${styleText}</style>`;
        svgString = svgString.replace('</svg>', `${styleElement}</svg>`);

        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URL = window.URL || window.webkitURL || window;
        const blobURL = URL.createObjectURL(svgBlob);
        
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const rect = svgElement.getBoundingClientRect();
            canvas.width = rect.width || 800;
            canvas.height = rect.height || 600;
            const context = canvas.getContext('2d');
            
            context.fillStyle = bgColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0);
            
            const pngURL = canvas.toDataURL('image/png');
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", pngURL);
            downloadAnchor.setAttribute("download", `devre_semasi_${Date.now()}.png`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);
            
            URL.revokeObjectURL(blobURL);
        };
        image.src = blobURL;
    });
    
    // Theme Toggle (re-applied logic)
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }

        // Dynamically update active chart colors if it exists
        if (window.chartInstance) {
            const isDarkTheme = (theme === 'dark');
            const textCol = isDarkTheme ? '#e0e0e0' : '#212529';
            const gridCol = isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

            window.chartInstance.options.scales.x.title.color = textCol;
            window.chartInstance.options.scales.x.ticks.color = textCol;
            window.chartInstance.options.scales.x.grid.color = gridCol;

            window.chartInstance.options.scales.y.title.color = textCol;
            window.chartInstance.options.scales.y.ticks.color = textCol;
            window.chartInstance.options.scales.y.grid.color = gridCol;

            window.chartInstance.options.plugins.legend.labels.color = textCol;
            window.chartInstance.update();
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
        'I': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="16" x2="12" y2="8"></line><polyline points="9 11 12 8 15 11"></polyline></svg>',
        'D': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 6 14 12 6 18"></polygon><line x1="14" y1="6" x2="14" y2="18"></line></svg>',
        'OP': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="4 4 16 12 4 20"></polygon></svg>'
    };
    list.innerHTML = components.map(c => `
        <div class="sidebar-comp-item" 
             style="cursor: pointer;"
             onmouseenter="window.renderer.highlightComponent(${c.id}, true)"
             onmouseleave="window.renderer.highlightComponent(${c.id}, false)"
             onclick="const comp = window.renderer.components.find(x=>x.id==${c.id}); if(comp) openEditModal(comp);">
            <div class="sidebar-comp-icon">${typeIcons[c.type] || '⚙️'}</div>
            <div class="sidebar-comp-info">
                <span class="sidebar-comp-name">${c.name}</span>
                <span class="sidebar-comp-val">${c.value || 'Aktif'}</span>
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

function plotTransient(data) {
    const resultsContent = document.getElementById('results-content');
    const ctx = document.getElementById('osc-chart').getContext('2d');
    if (window.chartInstance) {
        window.chartInstance.destroy();
    }
    
    const timePoints = data.time_points;
    const voltages = data.voltages;
    
    // Prepare datasets
    const datasets = [];
    const colors = [
        '#00f0ff', // Cyanish
        '#ff007f', // Rose/Neon pink
        '#39ff14', // Neon Green
        '#ffad00', // Orange
        '#8b00ff', // Violet
        '#ffea00'  // Yellow
    ];
    let colorIdx = 0;
    
    // Object to store measurement statistics for each node
    const stats = {};
    
    for (const [node, pts] of Object.entries(voltages)) {
        if (node === '0') continue; // Ground is always 0V
        datasets.push({
            label: `Düğüm ${node}`,
            data: pts,
            borderColor: colors[colorIdx % colors.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
        });
        colorIdx++;
        
        // Calculate statistics
        const maxV = Math.max(...pts);
        const minV = Math.min(...pts);
        const vpp = maxV - minV;
        
        const sumSq = pts.reduce((acc, val) => acc + val*val, 0);
        const vrms = Math.sqrt(sumSq / pts.length);
        const meanV = pts.reduce((acc, val) => acc + val, 0) / pts.length;
        
        // Frequency estimation using mean crossings
        let freq = 0;
        if (vpp > 0.05) { // Only estimate for non-flat signals
            const mean = meanV;
            let crossings = [];
            for (let i = 1; i < pts.length; i++) {
                const prev = pts[i-1] - mean;
                const curr = pts[i] - mean;
                if (prev * curr < 0) {
                    const t = timePoints[i-1] + (timePoints[i] - timePoints[i-1]) * (Math.abs(prev) / (Math.abs(prev) + Math.abs(curr)));
                    crossings.push(t);
                }
            }
            if (crossings.length >= 2) {
                let periods = [];
                for (let i = 2; i < crossings.length; i += 2) {
                    periods.push(crossings[i] - crossings[i-2]);
                }
                const avgPeriod = periods.length > 0 ? 
                    (periods.reduce((a,b)=>a+b, 0) / periods.length) : 
                    (2 * (crossings[1] - crossings[0]));
                freq = avgPeriod > 0 ? 1 / avgPeriod : 0;
            }
        }
        
        stats[node] = { maxV, minV, vpp, vrms, freq, meanV };
    }
    
    const isDark = document.body.classList.contains('dark-mode');
    const chartTextColor = isDark ? '#e0e0e0' : '#212529';
    const chartGridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    window.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timePoints.map(t => t.toFixed(5)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Zaman (sn)', color: chartTextColor },
                    grid: { color: chartGridColor },
                    ticks: { color: chartTextColor, maxTicksLimit: 10 }
                },
                y: {
                    title: { display: true, text: 'Gerilim (V)', color: chartTextColor },
                    grid: { color: chartGridColor },
                    ticks: { color: chartTextColor }
                }
            },
            plugins: {
                legend: {
                    labels: { color: chartTextColor }
                }
            }
        }
    });
    
    // Build DRC Warnings panel if any
    let drcHtml = "";
    if (renderer.drcWarnings && renderer.drcWarnings.length > 0) {
        drcHtml += `<div class="drc-panel">`;
        drcHtml += `<h4 style="color: #ef4444; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01"></svg>
            Tasarım Kuralı Denetimi (DRC)
        </h4>`;
        renderer.drcWarnings.forEach(w => {
            const color = w.type === 'short_circuit' ? '#ef4444' : '#eab308';
            drcHtml += `<div class="drc-item" style="border-left: 3px solid ${color};">
                ${w.message}
            </div>`;
        });
        drcHtml += `</div>`;
    }
    
    // Build Osiloskop Measurements HTML
    let oscMetricsHtml = `<h3 class="result-section-title">Osiloskop Ölçümleri</h3>`;
    for (const [node, m] of Object.entries(stats)) {
        const freqText = m.freq > 0 ? (m.freq >= 1000 ? `${(m.freq/1000).toFixed(2)} kHz` : `${m.freq.toFixed(1)} Hz`) : "DC / 0 Hz";
        
        // Compute additional metrics
        const meanV = m.meanV;
        const crestFactor = m.vrms > 0.01 ? (Math.max(Math.abs(m.maxV), Math.abs(m.minV)) / m.vrms) : 1.0;
        const color = colors[(parseInt(node)-1) % colors.length] || '#00f0ff';
        
        oscMetricsHtml += `
            <div class="node-section-header" style="margin-top: 1.5rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem;">
                <h4 style="color: var(--primary); font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color};"></span>
                    Düğüm ${node} Sinyal Analizi
                </h4>
            </div>
            
            <div class="node-card" style="border-left: 4px solid var(--primary); margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Tepeden Tepeye Gerilim (Vpp)</h4>
                    <span class="node-usage">Sinyalin maksimum ve minimum voltaj seviyeleri arasındaki tepe farkı</span>
                </div>
                <span class="val">${m.vpp.toFixed(3)} V</span>
            </div>

            <div class="node-card" style="border-left: 4px solid var(--secondary); margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Etkin Gerilim Değeri (Vrms)</h4>
                    <span class="node-usage">Dalga formunun alternatif akımdaki efektif voltaj karşılığı</span>
                </div>
                <span class="val">${m.vrms.toFixed(3)} V</span>
            </div>

            <div class="node-card" style="border-left: 4px solid var(--accent); margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Maksimum Potansiyel (Vmax)</h4>
                    <span class="node-usage">Sinyalin ulaştığı tepe pozitif genlik seviyesi</span>
                </div>
                <span class="val">${m.maxV.toFixed(3)} V</span>
            </div>

            <div class="node-card" style="border-left: 4px solid #8b00ff; margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Minimum Potansiyel (Vmin)</h4>
                    <span class="node-usage">Sinyalin ulaştığı dip negatif/sıfır genlik seviyesi</span>
                </div>
                <span class="val">${m.minV.toFixed(3)} V</span>
            </div>

            <div class="node-card" style="border-left: 4px solid #ffad00; margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Sinyal Frekansı (f)</h4>
                    <span class="node-usage">Sinyalin saniyedeki periyodik salınım frekansı</span>
                </div>
                <span class="val" style="font-size: 1rem;">${freqText}</span>
            </div>

            <div class="node-card" style="border-left: 4px solid #00f0ff; margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Ortalama Gerilim (DC Offset)</h4>
                    <span class="node-usage">Sinyalin sıfır referansına göre ortalama DC kayması</span>
                </div>
                <span class="val">${meanV.toFixed(3)} V</span>
            </div>

            <div class="node-card" style="border-left: 4px solid #ff007f; margin-bottom: 0.5rem; cursor: default;">
                <div class="node-info-main">
                    <h4>Tepe Faktörü (Crest Factor)</h4>
                    <span class="node-usage">Maksimum genliğin etkin değere oranı (Sinyalin sivrilik derecesi)</span>
                </div>
                <span class="val">${crestFactor.toFixed(3)}</span>
            </div>
        `;
    }
    
    resultsContent.innerHTML = drcHtml + `
        <div class="summary-card" style="margin-bottom: 15px;">
            <h4>Osiloskop Simülasyon Raporu</h4>
            <span class="summary-val">${timePoints[timePoints.length-1].toFixed(4)} Saniye</span>
            <span class="summary-note">Simülasyon toplam ${timePoints.length} veri noktasında hesaplandı.</span>
        </div>
    ` + oscMetricsHtml;
}

function displayResults(data) {
    if (data.time_points) {
        plotTransient(data);
        return;
    }

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
        const v1Info = voltages[c.n1];
        const v2Info = voltages[c.n2];
        const v1 = v1Info ? (v1Info.mag !== undefined ? v1Info.mag : Math.abs(v1Info.real || v1Info || 0)) : 0;
        const v2 = v2Info ? (v2Info.mag !== undefined ? v2Info.mag : Math.abs(v2Info.real || v2Info || 0)) : 0;
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
                 onmouseenter="window.renderer.highlightComponent(${c.id}, true)" 
                 onmouseleave="window.renderer.highlightComponent(${c.id}, false)">
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
        const val = info ? (info.mag !== undefined ? info.mag : (info.real || info || 0)) : 0;
        
        nodesHtml += `
            <div class="${cardClass}" 
                 onmouseenter="window.renderer.highlightNodeGroup('${node}', true)" 
                 onmouseleave="window.renderer.highlightNodeGroup('${node}', false)">
                <div class="node-info-main">
                    <h4>${displayName}</h4>
                    <span class="node-usage">${isGnd ? "0V Referans Noktası" : "Ölçülen Potansiyel"}</span>
                </div>
                <span class="val">${val.toFixed(3)} V</span>
            </div>
        `;
    }

    let drcHtml = "";
    if (renderer.drcWarnings && renderer.drcWarnings.length > 0) {
        drcHtml += `<div class="drc-panel">`;
        drcHtml += `<h4 style="color: #ef4444; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01"></svg>
            Tasarım Kuralı Denetimi (DRC)
        </h4>`;
        renderer.drcWarnings.forEach(w => {
            const color = w.type === 'short_circuit' ? '#ef4444' : '#eab308';
            drcHtml += `<div class="drc-item" style="border-left: 3px solid ${color};">
                ${w.message}
            </div>`;
        });
        drcHtml += `</div>`;
    }

    resultsContent.innerHTML = drcHtml + summaryHtml + nodesHtml + html;
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
