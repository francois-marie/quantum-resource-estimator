import React, { useState } from 'react';

const QuantumCalculator = () => {
  const [inputs, setInputs] = useState({
    code: 'surface',
    p: '',
    p_th: '',
    epsilon_L: '',
    n: '',
    k: '',
    p_over_pth: '',
    d: ''
  });
  
  const [results, setResults] = useState({});
  const [error, setError] = useState('');
  
  // Define code parameters and formulas
  const codeLibrary = {
    surface: {
      name: 'Surface Code',
      defaultThreshold: 0.01, // 1%
      calculateParams: (params) => {
        // Surface code formula: LFR(surface) = 0.03k(p/0.011)^⌈⌊√(n/k)⌋/2⌉
        // Various calculations depending on what's provided
        let result = {};
        
        // Case: calculate n given p, p_th, epsilon_L, k
        if (params.k && (params.p_over_pth || (params.p && params.p_th)) && params.epsilon_L) {
          const p_ratio = params.p_over_pth || (params.p / params.p_th);
          // Solve for d: epsilon_L = 0.03*k*(p_ratio*0.011/0.011)^(d/2)
          // Simplifies to: epsilon_L = 0.03*k*(p_ratio)^(d/2)
          // Therefore: d = 2*log(epsilon_L/(0.03*k))/log(p_ratio)
          const d_calculated = Math.ceil(2 * Math.log(params.epsilon_L / (0.03 * params.k)) / Math.log(p_ratio));
          result.d = Math.max(3, d_calculated); // d must be at least 3 for surface code
          
          // n = k * d^2 for surface code (approximately)
          result.n = params.k * Math.pow(result.d, 2);
        }
        
        // Case: calculate epsilon_L given p, p_th, n, k
        else if (params.k && (params.p_over_pth || (params.p && params.p_th)) && params.n) {
          const p_ratio = params.p_over_pth || (params.p / params.p_th);
          const d_estimated = Math.floor(Math.sqrt(params.n / params.k));
          result.d = d_estimated;
          
          // Calculate epsilon_L = 0.03*k*(p_ratio)^(d/2)
          result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, d_estimated / 2);
        }
        
        // Case: calculate k given p, p_th, epsilon_L, n
        else if (params.n && (params.p_over_pth || (params.p && params.p_th)) && params.epsilon_L) {
          const p_ratio = params.p_over_pth || (params.p / params.p_th);
          
          // Try different k values to find one that works
          for (let k_try = 1; k_try < params.n; k_try++) {
            const d_estimated = Math.floor(Math.sqrt(params.n / k_try));
            if (d_estimated >= 3) { // Ensure d is valid
              const calculatedEpsilon = 0.03 * k_try * Math.pow(p_ratio, d_estimated / 2);
              if (calculatedEpsilon <= params.epsilon_L) {
                result.k = k_try;
                result.d = d_estimated;
                result.epsilon_L_actual = calculatedEpsilon;
                break;
              }
            }
          }
        }
        
        return result;
      }
    },
    // Add more codes as needed
    steane: {
      name: 'Steane Code',
      defaultThreshold: 0.001, // 0.1%
      calculateParams: (params) => {
        // Placeholder for Steane code calculations
        // Implement specific formulas here
        return {};
      }
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Convert scientific notation to numbers
    let parsedValue = value;
    if (value && !isNaN(value)) {
      parsedValue = parseFloat(value);
    }
    
    setInputs({
      ...inputs,
      [name]: parsedValue
    });
    
    // If code changes, update p_th with default value for that code
    if (name === 'code' && codeLibrary[value]) {
      setInputs(prev => ({
        ...prev,
        p_th: codeLibrary[value].defaultThreshold
      }));
    }
  };
  
  const calculateResults = () => {
    setError('');
    
    // Validate required inputs based on available parameters
    const requiredSets = [
      ['code', 'p', 'p_th', 'epsilon_L', 'k'],
      ['code', 'p_over_pth', 'epsilon_L', 'k'],
      ['code', 'p', 'p_th', 'n', 'k'],
      ['code', 'p_over_pth', 'n', 'k'],
      ['code', 'p', 'p_th', 'epsilon_L', 'n'],
      ['code', 'p_over_pth', 'epsilon_L', 'n']
    ];
    
    const inputKeys = Object.keys(inputs).filter(key => inputs[key] !== '');
    let validInput = false;
    
    for (const requiredSet of requiredSets) {
      if (requiredSet.every(key => inputKeys.includes(key))) {
        validInput = true;
        break;
      }
    }
    
    if (!validInput) {
      setError('Please provide enough parameters to perform the calculation.');
      return;
    }
    
    // Get the selected code
    const selectedCode = codeLibrary[inputs.code];
    if (!selectedCode) {
      setError(`Code "${inputs.code}" is not supported.`);
      return;
    }
    
    // Create normalized parameters for calculation
    const params = {
      ...inputs,
      p: parseFloat(inputs.p),
      p_th: parseFloat(inputs.p_th),
      epsilon_L: parseFloat(inputs.epsilon_L),
      n: parseInt(inputs.n),
      k: parseInt(inputs.k),
      p_over_pth: inputs.p_over_pth ? parseFloat(inputs.p_over_pth) : (inputs.p && inputs.p_th ? inputs.p / inputs.p_th : null),
      d: parseInt(inputs.d)
    };
    
    try {
      // Calculate the results
      const calculatedResults = selectedCode.calculateParams(params);
      setResults(calculatedResults);
    } catch (e) {
      setError(`Calculation error: ${e.message}`);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">Quantum Error Correction Resource Estimator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Input Parameters</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Quantum Error Correction Code</label>
            <select 
              name="code" 
              value={inputs.code} 
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
            >
              {Object.keys(codeLibrary).map(code => (
                <option key={code} value={code}>{codeLibrary[code].name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Physical Error Probability (p)</label>
              <input 
                type="text" 
                name="p" 
                value={inputs.p} 
                onChange={handleInputChange}
                placeholder="e.g., 0.001 or 1e-3" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Accuracy Threshold (p_th)</label>
              <input 
                type="text" 
                name="p_th" 
                value={inputs.p_th} 
                onChange={handleInputChange}
                placeholder="e.g., 0.01 or 1%" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Target Logical Error Rate (ε_L)</label>
              <input 
                type="text" 
                name="epsilon_L" 
                value={inputs.epsilon_L} 
                onChange={handleInputChange}
                placeholder="e.g., 1e-6" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Ratio p/p_th</label>
              <input 
                type="text" 
                name="p_over_pth" 
                value={inputs.p_over_pth} 
                onChange={handleInputChange}
                placeholder="e.g., 0.1" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Number of Physical Qubits (n)</label>
              <input 
                type="text" 
                name="n" 
                value={inputs.n} 
                onChange={handleInputChange}
                placeholder="e.g., 10000" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Number of Logical Qubits (k)</label>
              <input 
                type="text" 
                name="k" 
                value={inputs.k} 
                onChange={handleInputChange}
                placeholder="e.g., 100" 
                className="w-full p-2 border rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Code Distance (d)</label>
              <input 
                type="text" 
                name="d" 
                value={inputs.d} 
                onChange={handleInputChange}
                placeholder="e.g., 10" 
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          
          <button 
            onClick={calculateResults}
            className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Calculate
          </button>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4">
              {results.n && (
                <div className="border-b pb-2">
                  <span className="font-medium">Physical Qubits (n):</span> {Math.ceil(results.n).toLocaleString()}
                </div>
              )}
              
              {results.k && (
                <div className="border-b pb-2">
                  <span className="font-medium">Logical Qubits (k):</span> {results.k}
                </div>
              )}
              
              {results.d && (
                <div className="border-b pb-2">
                  <span className="font-medium">Code Distance (d):</span> {results.d}
                </div>
              )}
              
              {results.epsilon_L && (
                <div className="border-b pb-2">
                  <span className="font-medium">Logical Error Rate (ε_L):</span> {results.epsilon_L.toExponential(6)}
                </div>
              )}
              
              {results.epsilon_L_actual && (
                <div className="border-b pb-2">
                  <span className="font-medium">Actual Logical Error Rate:</span> {results.epsilon_L_actual.toExponential(6)}
                </div>
              )}
              
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  For the {codeLibrary[inputs.code].name} with these parameters, you would need a [[{Math.ceil(results.n)}, {results.k}, {results.d}]] code configuration.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Enter parameters and click "Calculate" to see results.
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow mt-6">
        <h2 className="text-xl font-semibold mb-4">Quantum Error Correction Table</h2>
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2">Physical Fidelities</th>
              <th className="py-2">Physical Error Rate (PER)</th>
              <th className="py-2">Surface Code [[n,k,d]]</th>
              <th className="py-2">Distance (d)</th>
              <th className="py-2">Encoding Rate (inc. ancillas)</th>
              <th className="py-2">Logical Error Rate (LER)</th>
              <th className="py-2">Regime</th>
              <th className="py-2">GQI Era</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-4 py-2">99.5%</td>
              <td className="border px-4 py-2">5.0E-03</td>
              <td className="border px-4 py-2">[[144,1,12]]</td>
              <td className="border px-4 py-2">12</td>
              <td className="border px-4 py-2">287</td>
              <td className="border px-4 py-2">1.1E-03</td>
              <td className="border px-4 py-2">KiloQuop</td>
              <td className="border px-4 py-2">Intermediate</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.9%</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">none</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">thousands of quantum operations</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.99%</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2">none</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.999%</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2">none</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.5%</td>
              <td className="border px-4 py-2">5.0E-03</td>
              <td className="border px-4 py-2">[[1024,1,32]]</td>
              <td className="border px-4 py-2">32</td>
              <td className="border px-4 py-2">2047</td>
              <td className="border px-4 py-2">1.1E-06</td>
              <td className="border px-4 py-2">MegaQuop</td>
              <td className="border px-4 py-2">Early FTQC</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.9%</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">[[81,1,9]]</td>
              <td className="border px-4 py-2">9</td>
              <td className="border px-4 py-2">161</td>
              <td className="border px-4 py-2">1.0E-06</td>
              <td className="border px-4 py-2">millions of quantum operations</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.99%</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2">[[16,1,4]]</td>
              <td className="border px-4 py-2">4</td>
              <td className="border px-4 py-2">31</td>
              <td className="border px-4 py-2">1.0E-06</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.999%</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2">[[9,1,3]]</td>
              <td className="border px-4 py-2">3</td>
              <td className="border px-4 py-2">17</td>
              <td className="border px-4 py-2">1.0E-07</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.5%</td>
              <td className="border px-4 py-2">5.0E-03</td>
              <td className="border px-4 py-2">[[2704,1,52]]</td>
              <td className="border px-4 py-2">52</td>
              <td className="border px-4 py-2">5407</td>
              <td className="border px-4 py-2">1.1E-09</td>
              <td className="border px-4 py-2">GigaQuop</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.9%</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">[[225,1,15]]</td>
              <td className="border px-4 py-2">15</td>
              <td className="border px-4 py-2">449</td>
              <td className="border px-4 py-2">1.0E-09</td>
              <td className="border px-4 py-2">billions of quantum operations</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.99%</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2">[[49,1,7]]</td>
              <td className="border px-4 py-2">7</td>
              <td className="border px-4 py-2">97</td>
              <td className="border px-4 py-2">1.0E-09</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.999%</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2">[[25,1,5]]</td>
              <td className="border px-4 py-2">5</td>
              <td className="border px-4 py-2">49</td>
              <td className="border px-4 py-2">1.0E-10</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.5%</td>
              <td className="border px-4 py-2">5.0E-03</td>
              <td className="border px-4 py-2">[[5184,1,72]]</td>
              <td className="border px-4 py-2">72</td>
              <td className="border px-4 py-2">10367</td>
              <td className="border px-4 py-2">1.0E-12</td>
              <td className="border px-4 py-2">TeraQuop</td>
              <td className="border px-4 py-2">Large Scale FTQC</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.9%</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">[[441,1,21]]</td>
              <td className="border px-4 py-2">21</td>
              <td className="border px-4 py-2">881</td>
              <td className="border px-4 py-2">1.0E-12</td>
              <td className="border px-4 py-2">trillions of quantum operations</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.99%</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2">[[100,1,10]]</td>
              <td className="border px-4 py-2">10</td>
              <td className="border px-4 py-2">199</td>
              <td className="border px-4 py-2">1.0E-12</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.999%</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2">[[49,1,7]]</td>
              <td className="border px-4 py-2">7</td>
              <td className="border px-4 py-2">97</td>
              <td className="border px-4 py-2">1.0E-13</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.5%</td>
              <td className="border px-4 py-2">5.0E-03</td>
              <td className="border px-4 py-2">[[8464,1,92]]</td>
              <td className="border px-4 py-2">92</td>
              <td className="border px-4 py-2">16927</td>
              <td className="border px-4 py-2">1.0E-15</td>
              <td className="border px-4 py-2">PetaQuop</td>
              <td className="border px-4 py-2">Mature</td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.9%</td>
              <td className="border px-4 py-2">1.0E-03</td>
              <td className="border px-4 py-2">[[729,1,27]]</td>
              <td className="border px-4 py-2">27</td>
              <td className="border px-4 py-2">1457</td>
              <td className="border px-4 py-2">1.0E-15</td>
              <td className="border px-4 py-2">quadrillions of quantum operations</td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.99%</td>
              <td className="border px-4 py-2">1.0E-04</td>
              <td className="border px-4 py-2">[[169,1,13]]</td>
              <td className="border px-4 py-2">13</td>
              <td className="border px-4 py-2">337</td>
              <td className="border px-4 py-2">1.0E-15</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
            <tr>
              <td className="border px-4 py-2">99.999%</td>
              <td className="border px-4 py-2">1.0E-05</td>
              <td className="border px-4 py-2">[[81,1,9]]</td>
              <td className="border px-4 py-2">9</td>
              <td className="border px-4 py-2">161</td>
              <td className="border px-4 py-2">1.0E-16</td>
              <td className="border px-4 py-2"></td>
              <td className="border px-4 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Formula Reference</h2>
        <div className="text-sm text-gray-700">
          <p><b>Surface Code:</b> LFR(surface) = 0.03k(p/p_th)^⌈⌊√(n/k)⌋/2⌉</p>
          <p>Where:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>LFR = Logical Failure Rate (ε_L)</li>
            <li>k = Number of logical qubits</li>
            <li>p = Physical error probability</li>
            <li>p_th = Threshold error rate (≈ 0.01 or 1% for surface code)</li>
            <li>n = Number of physical qubits</li>
            <li>d = Code distance, approximately √(n/k) for surface code</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default QuantumCalculator;
