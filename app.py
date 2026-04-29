from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from devreAnalizi import Circuit
import cmath

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

def parse_value(val_str):
    if not isinstance(val_str, str):
        return float(val_str)
    
    val_str = val_str.strip().lower()
    suffixes = {
        'k': 1e3,
        'm': 1e6, # Meg
        'g': 1e9,
        't': 1e12,
        'u': 1e-6, # Micro
        'n': 1e-9, # Nano
        'p': 1e-12, # Pico
        'f': 1e-15, # Femto
    }
    
    # Handle the 'm' vs 'meg' ambiguity common in SPICE
    # But here we'll keep it simple: m is milli, meg is mega
    if val_str.endswith('meg'):
        return float(val_str[:-3]) * 1e6
    if val_str.endswith('mil'):
        return float(val_str[:-3]) * 25.4e-6 # Just for fun, usually not needed
        
    # Standard SPICE-like suffixes
    for suffix, multiplier in suffixes.items():
        if val_str.endswith(suffix):
            # Special case for 'm' vs 'M'
            # In many systems 'm' is milli. Let's check for 'm' at the end specifically.
            # Usually: m=milli, Meg=mega. But here we'll use lowercase m=milli, uppercase M=mega?
            # Actually let's use: k=kilo, m=milli, u=micro, n=nano, p=pico, M=mega (checked via MEG)
            if suffix == 'm':
                return float(val_str[:-1]) * 1e-3
            return float(val_str[:-1]) * multiplier
            
    return float(val_str)

@app.route('/solve', methods=['POST'])
def solve_circuit():
    data = request.json
    try:
        circuit = Circuit()
        freq = data.get('frequency', 0)
        
        for comp in data.get('components', []):
            ctype = comp['type']
            name = comp['name']
            n1 = str(comp['n1'])
            n2 = str(comp['n2'])
            val = parse_value(comp['value'])
            
            if ctype == 'R':
                circuit.add_resistor(name, n1, n2, val)
            elif ctype == 'C':
                circuit.add_capacitor(name, n1, n2, val)
            elif ctype == 'L':
                circuit.add_inductor(name, n1, n2, val)
            elif ctype == 'V':
                phase = float(comp.get('phase', 0))
                circuit.add_v_source(name, n1, n2, val, phase)
            elif ctype == 'I':
                phase = float(comp.get('phase', 0))
                circuit.add_i_source(name, n1, n2, val, phase)
        
        results = circuit.solve(freq=freq)
        
        if isinstance(results, str): # Error message
            return jsonify({'error': results}), 400
            
        node_voltages, source_currents = results
        
        # Prepare response
        resp_voltages = {}
        for node, v in node_voltages.items():
            if isinstance(v, complex):
                mag, phase = cmath.polar(v)
                resp_voltages[node] = {
                    'real': v.real,
                    'imag': v.imag,
                    'mag': mag,
                    'phase': cmath.phase(v) * 180 / 3.141592653589793
                }
            else:
                resp_voltages[node] = {
                    'real': v,
                    'mag': abs(v),
                    'phase': 0 if v >= 0 else 180
                }
                
        resp_currents = {}
        for src, i in source_currents.items():
            if isinstance(i, complex):
                mag, phase = cmath.polar(i)
                resp_currents[src] = {
                    'real': i.real,
                    'mag': mag,
                    'phase': cmath.phase(i) * 180 / 3.141592653589793
                }
            else:
                resp_currents[src] = {
                    'real': i,
                    'mag': abs(i),
                    'phase': 0 if i >= 0 else 180
                }
        
        return jsonify({
            'voltages': resp_voltages,
            'currents': resp_currents
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
