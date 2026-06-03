import math
import cmath

class MatrixSolver:
    """A simple Gaussian elimination solver for real and complex matrices."""
    @staticmethod
    def solve(A, b):
        n = len(A)
        # Augment matrix A with vector b
        for i in range(n):
            A[i].append(b[i])
        
        # Gaussian elimination
        for i in range(n):
            # Pivot search
            max_el = abs(A[i][i])
            max_row = i
            for k in range(i + 1, n):
                if abs(A[k][i]) > max_el:
                    max_el = abs(A[k][i])
                    max_row = k
            
            # Swap rows
            A[i], A[max_row] = A[max_row], A[i]
            
            # Pivot value check
            if abs(A[i][i]) < 1e-18:
                raise ValueError("Birden Fazla Devre Tespit Edildi!")
                
            # Eliminate column below pivot
            for k in range(i + 1, n):
                c = -A[k][i] / A[i][i]
                for j in range(i, n + 1):
                    if i == j:
                        A[k][j] = 0
                    else:
                        A[k][j] += c * A[i][j]
        
        # Back substitution
        x = [0] * n
        for i in range(n - 1, -1, -1):
            x[i] = A[i][n] / A[i][i]
            for k in range(i - 1, -1, -1):
                A[k][n] -= A[k][i] * x[i]
        return x

class Component:
    def __init__(self, name, n1, n2, value):
        self.name = name
        self.n1 = n1
        self.n2 = n2
        self.value = value

class Resistor(Component):
    def add_to_mna(self, matrix, b, nodes_map, freq=0):
        g = 1.0 / self.value
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        if i1 != -1: matrix[i1][i1] += g
        if i2 != -1: matrix[i2][i2] += g
        if i1 != -1 and i2 != -1:
            matrix[i1][i2] -= g
            matrix[i2][i1] -= g

class Capacitor(Component):
    def add_to_mna(self, matrix, b, nodes_map, freq=0):
        if freq == 0: # DC: Open circuit
            return
        # AC: Impedance Z = 1 / (j * omega * C)
        omega = 2 * math.pi * freq
        g = complex(0, omega * self.value)
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        if i1 != -1: matrix[i1][i1] += g
        if i2 != -1: matrix[i2][i2] += g
        if i1 != -1 and i2 != -1:
            matrix[i1][i2] -= g
            matrix[i2][i1] -= g

class Inductor(Component):
    def add_to_mna(self, matrix, b, nodes_map, freq=0):
        if freq == 0: # DC: Short circuit (behave like very small resistor or handle in MNA)
            # Short circuit is tricky in MNA if not handled as a voltage source with 0V.
            # For simplicity in DC, we'll treat it as a tiny resistor.
            g = 1e9 
            i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
            if i1 != -1: matrix[i1][i1] += g
            if i2 != -1: matrix[i2][i2] += g
            if i1 != -1 and i2 != -1:
                matrix[i1][i2] -= g
                matrix[i2][i1] -= g
            return
        # AC: Impedance Z = j * omega * L
        omega = 2 * math.pi * freq
        g = 1.0 / complex(0, omega * self.value)
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        if i1 != -1: matrix[i1][i1] += g
        if i2 != -1: matrix[i2][i2] += g
        if i1 != -1 and i2 != -1:
            matrix[i1][i2] -= g
            matrix[i2][i1] -= g

class VoltageSource(Component):
    def __init__(self, name, n1, n2, value, phase=0):
        super().__init__(name, n1, n2, value)
        self.phase = phase

    def add_to_mna(self, matrix, b, nodes_map, freq=0, source_idx=0):
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        val = self.value
        if freq > 0:
            val = cmath.rect(self.value, math.radians(self.phase))
        
        row = len(nodes_map) - 1 + source_idx # -1 because '0' node is not in map index
        if i1 != -1:
            matrix[i1][row] += 1
            matrix[row][i1] += 1
        if i2 != -1:
            matrix[i2][row] -= 1
            matrix[row][i2] -= 1
        b[row] = val

class CurrentSource(Component):
    def __init__(self, name, n1, n2, value, phase=0):
        super().__init__(name, n1, n2, value)
        self.phase = phase

    def add_to_mna(self, matrix, b, nodes_map, freq=0):
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        val = self.value
        if freq > 0:
            val = cmath.rect(self.value, math.radians(self.phase))
        
        if i1 != -1: b[i1] -= val
        if i2 != -1: b[i2] += val

class Diode(Component):
    def __init__(self, name, n1, n2, Is=1e-12, n=1, Vt=0.02585):
        super().__init__(name, n1, n2, 0.0)
        self.Is = Is
        self.n = n
        self.Vt = Vt
        self.vd = 0.6  # Initial guess

    def get_linearized(self):
        # Limit vd to prevent overflow in exp
        limit_vd = min(self.vd, 0.8)
        val_exp = math.exp(limit_vd / (self.n * self.Vt))
        i_d = self.Is * (val_exp - 1)
        g_eq = (self.Is / (self.n * self.Vt)) * val_exp
        i_eq = i_d - g_eq * limit_vd
        return g_eq, i_eq

    def add_to_mna(self, matrix, b, nodes_map, freq=0):
        # Fallback if evaluated without Newton-Raphson
        # Behave as a 100 Ohm resistor
        g = 1.0 / 100.0
        i1, i2 = nodes_map[self.n1], nodes_map[self.n2]
        if i1 != -1: matrix[i1][i1] += g
        if i2 != -1: matrix[i2][i2] += g
        if i1 != -1 and i2 != -1:
            matrix[i1][i2] -= g
            matrix[i2][i1] -= g

class OpAmp(Component):
    def __init__(self, name, n1, n2, n3, gain=1e5):
        # n1: non-inverting (+), n2: inverting (-), n3: output
        super().__init__(name, n1, n2, gain)
        self.n3 = n3
        self.gain = gain

    def add_to_mna(self, matrix, b, nodes_map, freq=0, source_idx=0):
        i1, i2, i3 = nodes_map[self.n1], nodes_map[self.n2], nodes_map[self.n3]
        row = len(nodes_map) - 1 + source_idx
        
        if i3 != -1:
            matrix[i3][row] += 1
            
        if i1 != -1:
            matrix[row][i1] -= 1
        if i2 != -1:
            matrix[row][i2] += 1
        if i3 != -1:
            matrix[row][i3] += 1.0 / self.gain

class Circuit:
    def __init__(self):
        self.components = []
        self.nodes = set()

    def add_resistor(self, name, n1, n2, value):
        self.components.append(Resistor(name, n1, n2, value))
        self.nodes.update([n1, n2])

    def add_capacitor(self, name, n1, n2, value):
        self.components.append(Capacitor(name, n1, n2, value))
        self.nodes.update([n1, n2])

    def add_inductor(self, name, n1, n2, value):
        self.components.append(Inductor(name, n1, n2, value))
        self.nodes.update([n1, n2])

    def add_v_source(self, name, n1, n2, value, phase=0):
        self.components.append(VoltageSource(name, n1, n2, value, phase))
        self.nodes.update([n1, n2])

    def add_i_source(self, name, n1, n2, value, phase=0):
        self.components.append(CurrentSource(name, n1, n2, value, phase))
        self.nodes.update([n1, n2])

    def add_diode(self, name, n1, n2, Is=1e-12, n=1):
        self.components.append(Diode(name, n1, n2, Is, n))
        self.nodes.update([n1, n2])

    def add_opamp(self, name, n1, n2, n3, gain=1e5):
        self.components.append(OpAmp(name, n1, n2, n3, gain))
        self.nodes.update([n1, n2, n3])

    def solve(self, freq=0):
        # Map nodes to indices, 0 is always ground
        sorted_nodes = sorted([n for n in self.nodes if n != '0'])
        nodes_map = {n: i for i, n in enumerate(sorted_nodes)}
        nodes_map['0'] = -1
        
        num_nodes = len(sorted_nodes)
        v_sources = [c for c in self.components if isinstance(c, (VoltageSource, OpAmp))]
        num_v = len(v_sources)
        size = num_nodes + num_v
        
        diodes = [c for c in self.components if isinstance(c, Diode)]
        
        # If we are running AC, we first need DC operating point for diodes
        if freq > 0 and len(diodes) > 0:
            # Solve DC first
            self.solve(freq=0)
            
        if len(diodes) > 0 and freq == 0:
            # Newton-Raphson Solver for DC
            max_iter = 100
            converged = False
            for iteration in range(max_iter):
                matrix = [[0.0 for _ in range(size)] for _ in range(size)]
                b = [0.0 for _ in range(size)]
                
                v_idx = 0
                for c in self.components:
                    if isinstance(c, (VoltageSource, OpAmp)):
                        c.add_to_mna(matrix, b, nodes_map, freq=0, source_idx=v_idx)
                        v_idx += 1
                    elif not isinstance(c, Diode):
                        c.add_to_mna(matrix, b, nodes_map, freq=0)
                        
                for d in diodes:
                    g_eq, i_eq = d.get_linearized()
                    i1, i2 = nodes_map[d.n1], nodes_map[d.n2]
                    if i1 != -1: matrix[i1][i1] += g_eq
                    if i2 != -1: matrix[i2][i2] += g_eq
                    if i1 != -1 and i2 != -1:
                        matrix[i1][i2] -= g_eq
                        matrix[i2][i1] -= g_eq
                    if i1 != -1: b[i1] -= i_eq
                    if i2 != -1: b[i2] += i_eq
                    
                try:
                    results = MatrixSolver.solve(matrix, b)
                except ValueError as e:
                    return f"Hata: {e}"
                    
                max_diff = 0
                for d in diodes:
                    v1 = results[nodes_map[d.n1]] if nodes_map[d.n1] != -1 else 0.0
                    v2 = results[nodes_map[d.n2]] if nodes_map[d.n2] != -1 else 0.0
                    vd_new = v1 - v2
                    diff = abs(vd_new - d.vd)
                    if diff > max_diff:
                        max_diff = diff
                    # Limit step
                    change = vd_new - d.vd
                    if abs(change) > 0.1:
                        change = 0.1 * (1.0 if change > 0 else -1.0)
                    d.vd += change
                    
                if max_diff < 1e-5:
                    converged = True
                    break
        else:
            # Standard Linear Solver (DC/AC)
            matrix = [[0.0 + 0j if freq > 0 else 0.0 for _ in range(size)] for _ in range(size)]
            b = [0.0 + 0j if freq > 0 else 0.0 for _ in range(size)]
            
            v_idx = 0
            for c in self.components:
                if isinstance(c, (VoltageSource, OpAmp)):
                    c.add_to_mna(matrix, b, nodes_map, freq, v_idx)
                    v_idx += 1
                elif isinstance(c, Diode):
                    # For AC small-signal, we use the bias conductance
                    g_eq = (c.Is / (c.n * c.Vt)) * math.exp(min(c.vd, 0.8) / (c.n * c.Vt))
                    i1, i2 = nodes_map[c.n1], nodes_map[c.n2]
                    if i1 != -1: matrix[i1][i1] += g_eq
                    if i2 != -1: matrix[i2][i2] += g_eq
                    if i1 != -1 and i2 != -1:
                        matrix[i1][i2] -= g_eq
                        matrix[i2][i1] -= g_eq
                else:
                    c.add_to_mna(matrix, b, nodes_map, freq)
                    
            try:
                results = MatrixSolver.solve(matrix, b)
            except ValueError as e:
                return f"Hata: {e}"

        # Parse results
        node_voltages = {n: results[nodes_map[n]] if nodes_map[n] != -1 else 0.0 for n in self.nodes}
        source_currents = {}
        for i, v_src in enumerate(v_sources):
            source_currents[v_src.name] = results[num_nodes + i]
            
        return node_voltages, source_currents

    def solve_transient(self, t_stop, t_step, freq=0):
        steps = int(t_stop / t_step) + 1
        time_points = [i * t_step for i in range(steps)]
        
        sorted_nodes = sorted([n for n in self.nodes if n != '0'])
        nodes_map = {n: i for i, n in enumerate(sorted_nodes)}
        nodes_map['0'] = -1
        
        num_nodes = len(sorted_nodes)
        v_sources = [c for c in self.components if isinstance(c, (VoltageSource, OpAmp))]
        num_v = len(v_sources)
        size = num_nodes + num_v
        
        # State variables
        cap_voltages = {c.name: 0.0 for c in self.components if isinstance(c, Capacitor)}
        ind_currents = {c.name: 0.0 for c in self.components if isinstance(c, Inductor)}
        
        diodes = [c for c in self.components if isinstance(c, Diode)]
        for d in diodes:
            d.vd = 0.6
            
        history = {n: [] for n in self.nodes}
        current_history = {c.name: [] for c in v_sources}
        
        for t in time_points:
            max_iter = 100
            converged = False
            
            for iteration in range(max_iter):
                matrix = [[0.0 for _ in range(size)] for _ in range(size)]
                b = [0.0 for _ in range(size)]
                
                # Stamp resistors
                for c in self.components:
                    if isinstance(c, Resistor):
                        c.add_to_mna(matrix, b, nodes_map, freq=0)
                        
                # Stamp capacitors
                for c in self.components:
                    if isinstance(c, Capacitor):
                        g_eq = c.value / t_step
                        i_eq = g_eq * cap_voltages[c.name]
                        i1, i2 = nodes_map[c.n1], nodes_map[c.n2]
                        if i1 != -1: matrix[i1][i1] += g_eq
                        if i2 != -1: matrix[i2][i2] += g_eq
                        if i1 != -1 and i2 != -1:
                            matrix[i1][i2] -= g_eq
                            matrix[i2][i1] -= g_eq
                        if i1 != -1: b[i1] += i_eq
                        if i2 != -1: b[i2] -= i_eq
                        
                # Stamp inductors
                for c in self.components:
                    if isinstance(c, Inductor):
                        g_eq = t_step / c.value
                        i_eq = ind_currents[c.name]
                        i1, i2 = nodes_map[c.n1], nodes_map[c.n2]
                        if i1 != -1: matrix[i1][i1] += g_eq
                        if i2 != -1: matrix[i2][i2] += g_eq
                        if i1 != -1 and i2 != -1:
                            matrix[i1][i2] -= g_eq
                            matrix[i2][i1] -= g_eq
                        if i1 != -1: b[i1] -= i_eq
                        if i2 != -1: b[i2] += i_eq
                        
                # Stamp current sources
                for c in self.components:
                    if isinstance(c, CurrentSource):
                        val = c.value
                        if freq > 0:
                            val = c.value * math.sin(2 * math.pi * freq * t + math.radians(c.phase))
                        i1, i2 = nodes_map[c.n1], nodes_map[c.n2]
                        if i1 != -1: b[i1] -= val
                        if i2 != -1: b[i2] += val
                        
                # Stamp voltage sources and OpAmps
                v_idx = 0
                for c in self.components:
                    if isinstance(c, VoltageSource):
                        val = c.value
                        if freq > 0:
                            val = c.value * math.sin(2 * math.pi * freq * t + math.radians(c.phase))
                        i1, i2 = nodes_map[c.n1], nodes_map[c.n2]
                        row = len(nodes_map) - 1 + v_idx
                        if i1 != -1:
                            matrix[i1][row] += 1
                            matrix[row][i1] += 1
                        if i2 != -1:
                            matrix[i2][row] -= 1
                            matrix[row][i2] -= 1
                        b[row] = val
                        v_idx += 1
                    elif isinstance(c, OpAmp):
                        i1, i2, i3 = nodes_map[c.n1], nodes_map[c.n2], nodes_map[c.n3]
                        row = len(nodes_map) - 1 + v_idx
                        if i3 != -1:
                            matrix[i3][row] += 1
                        if i1 != -1:
                            matrix[row][i1] -= 1
                        if i2 != -1:
                            matrix[row][i2] += 1
                        if i3 != -1:
                            matrix[row][i3] += 1.0 / c.gain
                        b[row] = 0.0
                        v_idx += 1
                        
                # Stamp linearized diodes
                for d in diodes:
                    g_eq, i_eq = d.get_linearized()
                    i1, i2 = nodes_map[d.n1], nodes_map[d.n2]
                    if i1 != -1: matrix[i1][i1] += g_eq
                    if i2 != -1: matrix[i2][i2] += g_eq
                    if i1 != -1 and i2 != -1:
                        matrix[i1][i2] -= g_eq
                        matrix[i2][i1] -= g_eq
                    if i1 != -1: b[i1] -= i_eq
                    if i2 != -1: b[i2] += i_eq
                    
                try:
                    results = MatrixSolver.solve(matrix, b)
                except ValueError as e:
                    return f"Hata: {e}"
                    
                if len(diodes) == 0:
                    converged = True
                    break
                    
                max_diff = 0
                for d in diodes:
                    v1 = results[nodes_map[d.n1]] if nodes_map[d.n1] != -1 else 0.0
                    v2 = results[nodes_map[d.n2]] if nodes_map[d.n2] != -1 else 0.0
                    vd_new = v1 - v2
                    diff = abs(vd_new - d.vd)
                    if diff > max_diff:
                        max_diff = diff
                    change = vd_new - d.vd
                    if abs(change) > 0.1:
                        change = 0.1 * (1.0 if change > 0 else -1.0)
                    d.vd += change
                    
                if max_diff < 1e-5:
                    converged = True
                    break
                    
            # Update state histories
            for node in self.nodes:
                val = results[nodes_map[node]] if nodes_map[node] != -1 else 0.0
                history[node].append(val)
                
            v_idx = 0
            for c in v_sources:
                current_history[c.name].append(results[num_nodes + v_idx])
                v_idx += 1
                
            # Update state values for next step
            for c in self.components:
                if isinstance(c, Capacitor):
                    v1 = results[nodes_map[c.n1]] if nodes_map[c.n1] != -1 else 0.0
                    v2 = results[nodes_map[c.n2]] if nodes_map[c.n2] != -1 else 0.0
                    cap_voltages[c.name] = v1 - v2
                elif isinstance(c, Inductor):
                    v1 = results[nodes_map[c.n1]] if nodes_map[c.n1] != -1 else 0.0
                    v2 = results[nodes_map[c.n2]] if nodes_map[c.n2] != -1 else 0.0
                    ind_currents[c.name] += (t_step / c.value) * (v1 - v2)
                    
        return time_points, history, current_history

if __name__ == "__main__":
    # Test DC: Voltage Divider
    c = Circuit()
    c.add_v_source("V1", "1", "0", 10)
    c.add_resistor("R1", "1", "2", 1000)
    c.add_resistor("R2", "2", "0", 1000)
    
    dv_res, dv_curr = c.solve()
    print("DC Voltage Divider (10V, 1k, 1k):")
    for node, v in dv_res.items():
        print(f"  Node {node}: {v:.2f} V")
    for src, i in dv_curr.items():
        print(f"  Source {src} current: {i:.4f} A")
        
    # Test AC RLC Resonance
    print("\nAC RLC Resonance (f=fc ≈ 159Hz, R=10, L=10m, C=100u):")
    c_rlc = Circuit()
    c_rlc.add_v_source("V1", "in", "0", 1)
    c_rlc.add_resistor("R1", "in", "mid", 10)
    c_rlc.add_inductor("L1", "mid", "out", 10e-3)
    c_rlc.add_capacitor("C1", "out", "0", 100e-6)
    
    # Resonance frequency fc = 1 / (2*pi*sqrt(L*C)) ≈ 159.15 Hz
    freq_res = 159.15
    rlc_res, rlc_curr = c_rlc.solve(freq=freq_res)
    for node, v in rlc_res.items():
        mag, phase = cmath.polar(v)
        print(f"  Node {node}: {mag:.3f} V ∠ {math.degrees(phase):.1f}°")

    # Test DC Current Source
    print("\nDC Current Source with Resistors:")
    c_curr = Circuit()
    c_curr.add_i_source("I1", "0", "1", 0.01) # 10mA source
    c_curr.add_resistor("R1", "1", "0", 1000)
    c_curr.add_resistor("R2", "1", "0", 1000)
    
    curr_res, curr_src = c_curr.solve()
    print("  Node 1 voltage (expecting 5V since 10mA through 500 ohms):")
    for node, v in curr_res.items():
        if node != '0':
            print(f"  Node {node}: {v:.2f} V")
