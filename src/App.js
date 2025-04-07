import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale
);

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Function to parse URL parameters
const getUrlParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const params = {};
  for (const [key, value] of searchParams.entries()) {
    // Convert string values to appropriate types
    if (key === 'code') {
      params[key] = value;
    } else {
      params[key] = parseFloat(value);
    }
  }
  return params;
};

// Function to update URL with current state
const updateUrl = debounce((params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value.toString());
    }
  });
  const newUrl = `${window.location.pathname}?${searchParams.toString()}`;
  window.history.replaceState({}, '', newUrl);
}, 1000); // Debounce URL updates by 1 second

const QuantumCalculator = () => {
  const [inputs, setInputs] = useState({
    code: 'surface',
    p: 0.001, // Default: 0.1%
    epsilon_L: 1e-6, // Default: 10^-6
    n: 1000, // Default: 1000 physical qubits
    k: 10, // Default: 10 logical qubits
    d: 3 // Default: distance 3
  });
  
  const [results, setResults] = useState({});
  const [error, setError] = useState('');

  // Convert value to log scale for slider
  const toLogScale = (value, min, max) => {
    const minLog = Math.log10(min);
    const maxLog = Math.log10(max);
    return (Math.log10(value) - minLog) / (maxLog - minLog) * 100;
  };

  // Convert from log scale slider value back to actual value
  const fromLogScale = (value, min, max) => {
    const minLog = Math.log10(min);
    const maxLog = Math.log10(max);
    return Math.pow(10, minLog + (value / 100) * (maxLog - minLog));
  };

  // Define slider ranges and steps
  const sliderRanges = {
    p: { min: 1e-6, max: 1e-1 },
    epsilon_L: { min: 1e-15, max: 1e-3 },
    n: { min: 10, max: 1e6 },
    k: { min: 1, max: 1000 }
  };
  
  // Define code parameters and formulas
  const codeLibrary = {
    surface: {
      name: 'Surface Code',
      threshold: 0.011, // 1.1%
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011; // Using fixed threshold
        
        // Calculate code distance based on number of data qubits per logical qubit
        result.d = Math.floor(Math.sqrt(params.n / params.k));
        
        // Calculate number of ancilla qubits for all logical qubits
        // Each logical qubit requires (d-1)^2 + 2(d-1) ancilla qubits
        result.n_ancilla = params.k * (Math.pow(result.d - 1, 2) + 2 * (result.d - 1));
        
        // Calculate logical error rate
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, result.d / 2);
        
        // Always include k and n in results
        result.k = params.k;
        result.n = params.n;
        
        return result;
      }
    },
    hypergraph: {
      name: 'Hypergraph Product Code',
      threshold: 0.006, // 0.6%
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.006;
        
        // Calculate logical error rate
        result.epsilon_L = 0.07 * Math.pow(p_ratio, 0.47 * Math.pow(params.n, 0.27));
        
        // Include n in results
        result.n = params.n;
        
        return result;
      }
    },
    lifted: {
      name: 'Lifted Product Code',
      threshold: 0.0066, // 0.66%
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.0066;
        
        // Calculate logical error rate
        result.epsilon_L = 2.3 * Math.pow(p_ratio, 0.11 * Math.pow(params.n, 0.60));
        
        // Include n in results
        result.n = params.n;
        
        return result;
      }
    }
  };
  
  // Memoize calculateResults to prevent unnecessary recalculations
  const calculateResults = useCallback(() => {
    setError('');
    
    try {
      const selectedCode = codeLibrary[inputs.code];
      if (!selectedCode) {
        setError(`Code "${inputs.code}" is not supported.`);
        return;
      }
      
      const params = {
        ...inputs,
        p: parseFloat(inputs.p),
        epsilon_L: parseFloat(inputs.epsilon_L),
        n: parseInt(inputs.n),
        k: parseInt(inputs.k),
        d: parseInt(inputs.d)
      };
      
      const calculatedResults = selectedCode.calculateParams(params);
      setResults(calculatedResults);
    } catch (e) {
      setError(`Calculation error: ${e.message}`);
    }
  }, [inputs]);

  // Load initial state from URL parameters only once
  useEffect(() => {
    const urlParams = getUrlParams();
    if (Object.keys(urlParams).length > 0) {
      setInputs(prev => ({
        ...prev,
        ...urlParams
      }));
    }
  }, []); // Empty dependency array means this runs once on mount

  // Update URL when inputs change
  useEffect(() => {
    updateUrl(inputs);
  }, [inputs]); // Only depends on inputs

  // Calculate results when inputs change
  useEffect(() => {
    calculateResults();
  }, [calculateResults]); // Only depends on the memoized calculateResults function

  // Update code distance in inputs when results change
  useEffect(() => {
    if (results.d && results.d !== inputs.d) {
      setInputs(prev => ({
        ...prev,
        d: results.d
      }));
    }
  }, [results.d]); // Only depends on results.d
  
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    let parsedValue = value;
    if (type === 'range') {
      // Convert from slider value to actual value using log scale
      parsedValue = fromLogScale(parseFloat(value), sliderRanges[name].min, sliderRanges[name].max);
    } else if (value && !isNaN(value)) {
      parsedValue = parseFloat(value);
    }
    
    setInputs(prev => {
      const newInputs = {
        ...prev,
        [name]: parsedValue
      };
      
      // If code changes, update p_th with default value for that code
      if (name === 'code' && codeLibrary[value]) {
        newInputs.p_th = codeLibrary[value].defaultThreshold;
      }
      
      return newInputs;
    });
  };
  
  // Function to generate plot data
  const generatePlotData = (code, epsilon_L, k = 1) => {
    const selectedCode = codeLibrary[code];
    if (!selectedCode) return null;

    const threshold = selectedCode.threshold;
    const pValues = [];
    const nValues = [];

    // Generate 50 points from 1e-6 to threshold
    for (let i = 0; i < 50; i++) {
      const p = Math.pow(10, Math.log10(1e-6) + (Math.log10(threshold) - Math.log10(1e-6)) * (i / 49));
      pValues.push(p);

      // For each p, find n that gives the target epsilon_L
      let nMin = 10;
      let nMax = 1e6;
      let n = nMin;
      let bestN = nMin;
      let minDiff = Infinity;

      // Binary search for the right n
      for (let j = 0; j < 20; j++) {
        n = Math.floor((nMin + nMax) / 2);
        const result = selectedCode.calculateParams({ p, n, k, epsilon_L });
        const diff = Math.abs(Math.log10(result.epsilon_L) - Math.log10(epsilon_L));

        if (diff < minDiff) {
          minDiff = diff;
          bestN = n;
        }

        if (result.epsilon_L > epsilon_L) {
          nMin = n;
        } else {
          nMax = n;
        }
      }

      nValues.push(bestN);
    }

    return {
      pValues,
      nValues
    };
  };

  // Function to find required n for target epsilon_L
  const findRequiredN = (code, p, target_epsilon_L, k = 1) => {
    const selectedCode = codeLibrary[code];
    if (!selectedCode) return null;

    let nMin = 10;
    let nMax = 1e6;
    let bestN = nMin;
    let minDiff = Infinity;
    let bestResult = null;

    // Binary search for the right n
    for (let j = 0; j < 20; j++) {
      const n = Math.floor((nMin + nMax) / 2);
      const result = selectedCode.calculateParams({ p, n, k, epsilon_L: target_epsilon_L });
      const diff = Math.abs(Math.log10(result.epsilon_L) - Math.log10(target_epsilon_L));

      if (diff < minDiff) {
        minDiff = diff;
        bestN = n;
        bestResult = result;
      }

      if (result.epsilon_L > target_epsilon_L) {
        nMin = n;
      } else {
        nMax = n;
      }
    }

    return bestResult;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gray-50 rounded-lg shadow">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              This website is still work in progress. If you find bugs or errors, please create issues on the 
              <a href="https://github.com/francois-marie/quantum-resource-estimator" className="font-medium underline ml-1" target="_blank" rel="noopener noreferrer">
                GitHub repository
              </a>.
            </p>
          </div>
        </div>
      </div>

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
          
          <div className="space-y-4">
            {Object.entries(sliderRanges).map(([name, range]) => {
              // Skip the distance slider as it's calculated
              if (name === 'd') return null;
              
              return (
                <div key={name} className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    {name === 'p' ? 'Physical Error Probability (p)' :
                     name === 'epsilon_L' ? 'Target Logical Error Rate (ε_L)' :
                     name === 'n' ? 'Number of Physical Qubits (n)' :
                     name === 'k' ? 'Number of Logical Qubits (k)' :
                     'Code Distance (d)'}
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      name={name}
                      min="0"
                      max="100"
                      value={toLogScale(inputs[name], range.min, range.max)}
                      onChange={handleInputChange}
                      className="w-2/3"
                    />
                    <input
                      type="text"
                      value={inputs[name].toExponential(2)}
                      readOnly
                      className="w-1/3 p-1 border rounded text-sm"
                    />
                  </div>
                </div>
              );
            })}
            
            {/* Display calculated code distance */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Code Distance (d) - Calculated
              </label>
              <input
                type="text"
                value={inputs.d}
                readOnly
                className="w-full p-1 border rounded text-sm bg-gray-100"
              />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4">
              {results.n && (
                <div className="border-b pb-2">
                  <span className="font-medium">Physical Data Qubits (n):</span> {Math.ceil(results.n).toLocaleString()}
                </div>
              )}
              
              {results.n_ancilla && (
                <div className="border-b pb-2">
                  <span className="font-medium">Physical Ancilla Qubits (n_a):</span> {Math.ceil(results.n_ancilla).toLocaleString()}
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
              
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  For the {codeLibrary[inputs.code].name} with these parameters, you would need a [[{Math.ceil(results.n)}, {results.k}, {results.d}]] code configuration.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Adjust the parameters to see results.
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow mt-6">
        <h2 className="text-xl font-semibold mb-4">Required Physical Qubits vs Error Rate</h2>
        <div className="h-96">
          <Line
            data={{
              labels: generatePlotData(inputs.code, inputs.epsilon_L, inputs.k)?.pValues.map(p => p.toExponential(1)),
              datasets: [{
                label: `${codeLibrary[inputs.code].name} (ε_L = ${inputs.epsilon_L.toExponential(1)})`,
                data: generatePlotData(inputs.code, inputs.epsilon_L, inputs.k)?.nValues,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: 'logarithmic',
                  title: {
                    display: true,
                    text: 'Physical Error Rate (p)'
                  }
                },
                y: {
                  type: 'logarithmic',
                  title: {
                    display: true,
                    text: 'Required Physical Qubits (n)'
                  }
                }
              },
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      return `n = ${context.parsed.y.toExponential(1)} qubits`;
                    }
                  }
                }
              }
            }}
          />
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow mt-6">
        <h2 className="text-xl font-semibold mb-4">Quantum Error Correction Table</h2>
        
        <h3 className="text-lg font-semibold mb-2">Intermediate Era</h3>
        <h4 className="text-md font-medium mb-2">KiloQuop Regime (ε_L = 1e-3)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (p)</th>
              <th className="py-2">Required Data Qubits (n)</th>
              <th className="py-2">Code Distance (d)</th>
              <th className="py-2">Ancilla Qubits (n_a)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved ε_L</th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (k/n)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-3);
              if (!result) return null;
              const d_approx = Math.floor(Math.sqrt(result.n));
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-3);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
              url.searchParams.set('d', d_approx);
              return (
                <tr key={p} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = url.toString()}>
                  <td className="border px-4 py-2 text-blue-600 hover:underline">
                    <a href={url.toString()}>{p.toExponential(1)}</a>
                  </td>
                  <td className="border px-4 py-2">{Math.ceil(result.n)}</td>
                  <td className="border px-4 py-2">{result.d}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n_ancilla || 0)}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n + (result.n_ancilla || 0))}</td>
                  <td className="border px-4 py-2">{result.epsilon_L.toExponential(1)}</td>
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {d_approx}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Early FTQC Era</h3>
        <h4 className="text-md font-medium mb-2">MegaQuop Regime (ε_L = 1e-6)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (p)</th>
              <th className="py-2">Required Data Qubits (n)</th>
              <th className="py-2">Code Distance (d)</th>
              <th className="py-2">Ancilla Qubits (n_a)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved ε_L</th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (k/n)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-6);
              if (!result) return null;
              const d_approx = Math.floor(Math.sqrt(result.n));
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-6);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
              url.searchParams.set('d', d_approx);
              return (
                <tr key={p} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = url.toString()}>
                  <td className="border px-4 py-2 text-blue-600 hover:underline">
                    <a href={url.toString()}>{p.toExponential(1)}</a>
                  </td>
                  <td className="border px-4 py-2">{Math.ceil(result.n)}</td>
                  <td className="border px-4 py-2">{result.d}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n_ancilla || 0)}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n + (result.n_ancilla || 0))}</td>
                  <td className="border px-4 py-2">{result.epsilon_L.toExponential(1)}</td>
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {d_approx}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Large Scale FTQC Era</h3>
        <h4 className="text-md font-medium mb-2">GigaQuop Regime (ε_L = 1e-9)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (p)</th>
              <th className="py-2">Required Data Qubits (n)</th>
              <th className="py-2">Code Distance (d)</th>
              <th className="py-2">Ancilla Qubits (n_a)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved ε_L</th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (k/n)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-9);
              if (!result) return null;
              const d_approx = Math.floor(Math.sqrt(result.n));
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-9);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
              url.searchParams.set('d', d_approx);
              return (
                <tr key={p} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = url.toString()}>
                  <td className="border px-4 py-2 text-blue-600 hover:underline">
                    <a href={url.toString()}>{p.toExponential(1)}</a>
                  </td>
                  <td className="border px-4 py-2">{Math.ceil(result.n)}</td>
                  <td className="border px-4 py-2">{result.d}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n_ancilla || 0)}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n + (result.n_ancilla || 0))}</td>
                  <td className="border px-4 py-2">{result.epsilon_L.toExponential(1)}</td>
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {d_approx}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4 className="text-md font-medium mb-2">TeraQuop Regime (ε_L = 1e-12)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (p)</th>
              <th className="py-2">Required Data Qubits (n)</th>
              <th className="py-2">Code Distance (d)</th>
              <th className="py-2">Ancilla Qubits (n_a)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved ε_L</th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (k/n)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-12);
              if (!result) return null;
              const d_approx = Math.floor(Math.sqrt(result.n));
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-12);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
              url.searchParams.set('d', d_approx);
              return (
                <tr key={p} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = url.toString()}>
                  <td className="border px-4 py-2 text-blue-600 hover:underline">
                    <a href={url.toString()}>{p.toExponential(1)}</a>
                  </td>
                  <td className="border px-4 py-2">{Math.ceil(result.n)}</td>
                  <td className="border px-4 py-2">{result.d}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n_ancilla || 0)}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n + (result.n_ancilla || 0))}</td>
                  <td className="border px-4 py-2">{result.epsilon_L.toExponential(1)}</td>
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {d_approx}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Mature Era</h3>
        <h4 className="text-md font-medium mb-2">PetaQuop Regime (ε_L = 1e-15)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (p)</th>
              <th className="py-2">Required Data Qubits (n)</th>
              <th className="py-2">Code Distance (d)</th>
              <th className="py-2">Ancilla Qubits (n_a)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved ε_L</th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (k/n)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-15);
              if (!result) return null;
              const d_approx = Math.floor(Math.sqrt(result.n));
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-15);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
              url.searchParams.set('d', d_approx);
              return (
                <tr key={p} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = url.toString()}>
                  <td className="border px-4 py-2 text-blue-600 hover:underline">
                    <a href={url.toString()}>{p.toExponential(1)}</a>
                  </td>
                  <td className="border px-4 py-2">{Math.ceil(result.n)}</td>
                  <td className="border px-4 py-2">{result.d}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n_ancilla || 0)}</td>
                  <td className="border px-4 py-2">{Math.ceil(result.n + (result.n_ancilla || 0))}</td>
                  <td className="border px-4 py-2">{result.epsilon_L.toExponential(1)}</td>
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {d_approx}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Formula Reference</h2>
        <div className="text-sm text-gray-700 space-y-4">
          <div>
            <p><b>Surface Code:</b> LFR(surface) = 0.03k(p/0.011)^⌈⌊√(n/k)⌋/2⌉</p>
            <p>Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>LFR = Logical Failure Rate (ε_L)</li>
              <li>k = Number of logical qubits</li>
              <li>p = Physical error probability</li>
              <li>n = Number of physical qubits</li>
              <li>d = Code distance, approximately √(n/k) for surface code</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">Source: <a href="https://arxiv.org/abs/0910.4074" className="text-blue-600 hover:underline">Surface code quantum communication (Fowler et al., 2010)</a></p>
          </div>

          <div>
            <p><b>Hypergraph Product Code:</b> LFR(HGP) = 0.07(p/0.006)^(0.47n^0.27)</p>
            <p>Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>LFR = Logical Failure Rate (ε_L)</li>
              <li>p = Physical error probability</li>
              <li>n = Number of physical qubits</li>
              <li>Threshold ≈ 0.006 or 0.6%</li>
            </ul>
          </div>

          <div>
            <p><b>Lifted Product Code:</b> LFR(LP) = 2.3(p/0.0066)^(0.11n^0.60)</p>
            <p>Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>LFR = Logical Failure Rate (ε_L)</li>
              <li>p = Physical error probability</li>
              <li>n = Number of physical qubits</li>
              <li>Threshold ≈ 0.0066 or 0.66%</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">Source for HGP and LP codes: <a href="https://arxiv.org/abs/2308.08648v1" className="text-blue-600 hover:underline">Constant-Overhead Fault-Tolerant Quantum Computation with Reconfigurable Atom Arrays (Xu et al., 2023)</a></p>
          </div>
          <p><b>LFR:</b> probability that any of the logical qubits fails per code cycle</p>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>Inspiration from: <a href="https://quantumcomputingreport.com/nisq-versus-ftqc-in-the-2025-2029-timeframe/" className="text-blue-600 hover:underline">Quantum Computing Report - NISQ Versus FTQC in the 2025-2029 Timeframe</a></p>
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-500">
      <p>Copyright © 2025 François-Marie Le Régent. Distributed under an MIT license.</p>
    </div>
    </div>
  );
};

export default QuantumCalculator;

