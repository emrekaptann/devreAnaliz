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
    print("DEBUG: Received payload:", data)
    try:
        circuit = Circuit()
        freq = data.get('frequency', 0)
        mode = data.get('mode', 'steady')
        
        for comp in data.get('components', []):
            ctype = comp['type']
            name = comp['name']
            n1 = str(comp['n1'])
            n2 = str(comp['n2'])
            
            # Diodes might not require a value
            val_str = comp.get('value', '0')
            val = parse_value(val_str) if val_str else 0.0
            
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
            elif ctype == 'D':
                circuit.add_diode(name, n1, n2)
            elif ctype == 'OP':
                n3 = str(comp['n3'])
                circuit.add_opamp(name, n1, n2, n3)
        
        if mode == 'transient':
            t_stop = float(data.get('t_stop', 0.01))
            t_step = float(data.get('t_step', 0.0001))
            time_points, history, current_history = circuit.solve_transient(t_stop, t_step, freq=freq)
            return jsonify({
                'mode': 'transient',
                'time_points': time_points,
                'voltages': history,
                'currents': current_history
            })
            
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
            'mode': 'steady',
            'voltages': resp_voltages,
            'currents': resp_currents
        })
        
    except Exception as e:
        err_msg = str(e)
        # Basit çeviri eşleştirmeleri
        translations = {
            "could not convert string to float": "Geçersiz sayısal değer girildi",
            "is not in list": "eleman listede bulunamadı",
            "Matrix is singular": "Matris tekil (devre tamamlanmamış veya topraklanmamış olabilir)",
            "n1": "n1 bağlantısı eksik",
            "n2": "n2 bağlantısı eksik",
            "n3": "n3 bağlantısı eksik",
            "value": "değer alanı eksik"
        }
        for eng, tr in translations.items():
            if eng in err_msg:
                err_msg = tr
                break
        return jsonify({'error': err_msg}), 400

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
