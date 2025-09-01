import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LogarithmicScale,
  annotationPlugin
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
  const [copyStatus, setCopyStatus] = useState('');

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
  
  // Define code parameters and formulas - memoized to prevent useCallback dependency issues
  const codeLibrary = useMemo(() => ({
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
    yoked_1d: {
      name: '1D Yoked Surface Code',
      threshold: 0.011, // Same as surface code - inner patches behave like surface codes
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011;
        
        // Calculate inner patch distance
        const d_in = Math.floor(Math.sqrt(params.n / params.k));
        
        // Effective distance with 1D yoke: ~2x multiplier (conservative: 1.8)
        const mu_1d = 1.8;
        result.d = Math.floor(mu_1d * d_in);
        
        // Ancilla qubits calculation (similar to surface code but with yoke overhead)
        // Adding ~20% overhead for yoke connections
        result.n_ancilla = params.k * (Math.pow(d_in - 1, 2) + 2 * (d_in - 1)) * 1.2;
        
        // Calculate logical error rate with effective distance
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        
        result.k = params.k;
        result.n = params.n;
        
        return result;
      }
    },
    yoked_2d: {
      name: '2D Yoked Surface Code',
      threshold: 0.011, // Same as surface code
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011;
        
        // Calculate inner patch distance
        const d_in = Math.floor(Math.sqrt(params.n / params.k));
        
        // Effective distance with 2D yoke: ~4x multiplier (conservative: 3.2)
        const mu_2d = 3.2;
        result.d = Math.floor(mu_2d * d_in);
        
        // Ancilla qubits calculation with higher yoke overhead for 2D
        // Adding ~50% overhead for 2D yoke connections
        result.n_ancilla = params.k * (Math.pow(d_in - 1, 2) + 2 * (d_in - 1)) * 1.5;
        
        // Calculate logical error rate with effective distance
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        
        result.k = params.k;
        result.n = params.n;
        
        return result;
      }
    },
    color: {
      name: 'Color Code',
      threshold: 0.0036, // 0.36% (circuit-level noise)
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.0036; // Using circuit-level threshold
        
        // Calculate code distance based on number of data qubits per logical qubit
        // For triangular honeycomb (6.6.6) color codes, d approximately equals sqrt(n/k)
        result.d = Math.floor(Math.sqrt(params.n / params.k));
        
        // Calculate number of ancilla qubits for all logical qubits
        // Using similar structure to surface code for consistency
        result.n_ancilla = params.k * (Math.pow(result.d - 1, 2) + 2 * (result.d - 1));
        
        // Calculate logical error rate using the color code formula
        // LFR_color approximately equals A * k * (p/p_th_color)^ceil(d/2)
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        
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
  }), []); // Empty dependency array since this object is static
  
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
  }, [inputs, codeLibrary]);

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
  }, [results.d, inputs.d]); // Added inputs.d to dependencies
  
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

  // Function to copy results to clipboard
  const copyResultsToClipboard = async () => {
    if (!results || Object.keys(results).length === 0) return;

    let resultText = "Quantum Error Correction Results\n";
    resultText += "=====================================\n\n";
    
    // Input parameters
    resultText += "Input Parameters:\n";
    resultText += `Code: ${codeLibrary[inputs.code].name}\n`;
    resultText += `Physical Error Rate (p): ${inputs.p.toExponential(3)}\n`;
    resultText += `Target Logical Error Rate (ε_L): ${inputs.epsilon_L.toExponential(3)}\n`;
    resultText += `Number of Logical Qubits (k): ${inputs.k}\n\n`;
    
    // Results
    resultText += "Results:\n";
    
    if (results.n) {
      resultText += `Physical Data Qubits (n): ${Math.ceil(results.n).toLocaleString()}\n`;
    }
    
    if (results.n_ancilla) {
      resultText += `Physical Ancilla Qubits (n_a): ${Math.ceil(results.n_ancilla).toLocaleString()}\n`;
    }
    
    if (results.n && results.n_ancilla) {
      resultText += `Total Qubits (n+n_a): ${Math.ceil(results.n + results.n_ancilla).toLocaleString()}\n`;
    }
    
    if (results.k) {
      resultText += `Logical Qubits (k): ${results.k}\n`;
    }
    
    if (results.d) {
      resultText += `Code Distance (d): ${results.d}\n`;
    }
    
    if (results.epsilon_L) {
      resultText += `Logical Error Rate (ε_L): ${results.epsilon_L.toExponential(6)}\n`;
    }
    
    // Add code configuration summary
    if (results.n && results.k && results.d) {
      resultText += `\nCode Configuration: [[${Math.ceil(results.n)}, ${results.k}, ${results.d}]]`;
    }

    try {
      await navigator.clipboard.writeText(resultText);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    } catch (err) {
      console.error('Failed to copy results: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = resultText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus(''), 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
        setCopyStatus('Copy failed');
        setTimeout(() => setCopyStatus(''), 2000);
      }
      document.body.removeChild(textArea);
    }
  };
  
  // Function to generate plot data
  const generatePlotData = (code, epsilon_L, k = 1) => {
    const selectedCode = codeLibrary[code];
    if (!selectedCode) return null;

    const threshold = selectedCode.threshold;
    const pValues = [];
    const nValues = [];
    const kValues = []; // Store k values for tooltip

    // Generate 50 points from 1e-6 to threshold (stopping at threshold)
    for (let i = 0; i < 50; i++) {
      const p = Math.pow(10, Math.log10(1e-6) + (Math.log10(threshold * 0.99) - Math.log10(1e-6)) * (i / 49));
      
      // Skip if p >= threshold
      if (p >= threshold) {
        break;
      }
      
      pValues.push(p);

      // For each p, find n that gives the target epsilon_L
      let nMin = 10;
      let nMax = 1e10; // Increased upper bound to handle divergence near threshold
      let n = nMin;
      let minDiff = Infinity;
      let bestResult = null;

      // Binary search for the right n
      for (let j = 0; j < 30; j++) { // Increased iterations for better convergence
        n = Math.floor((nMin + nMax) / 2);
        const result = selectedCode.calculateParams({ p, n, k, epsilon_L });
        const diff = Math.abs(Math.log10(result.epsilon_L) - Math.log10(epsilon_L));

        if (diff < minDiff) {
          minDiff = diff;
          bestResult = result;
        }

        if (result.epsilon_L > epsilon_L) {
          nMin = n;
        } else {
          nMax = n;
        }
        
        // If we're requiring more than 1e9 qubits, we're probably too close to threshold
        if (nMin > 1e9) {
          break;
        }
      }

      // Skip this point if we need an unreasonably large number of qubits
      if (bestResult && bestResult.n > 1e9) {
        break; // Stop generating points when we need too many qubits
      }

      const physicalQubits = bestResult ? bestResult.n : n;
      
      // Calculate number of logical qubits based on code type
      let logicalQubits;
      if (code === 'hypergraph') {
        // For HGP codes, k >= 0.04n, so we use k = 0.04n
        logicalQubits = Math.max(1, Math.floor(0.04 * physicalQubits));
      } else if (code === 'lifted') {
        // For LP codes, k approximately equals 0.38n^0.85
        logicalQubits = Math.max(1, Math.floor(0.38 * Math.pow(physicalQubits, 0.85)));
      } else {
        // Surface, Yoked Surface, and Color codes encode 1 logical qubit
        logicalQubits = 1;
      }

      nValues.push(physicalQubits);
      kValues.push(logicalQubits);
    }

    return {
      pValues,
      nValues,
      kValues,
      threshold
    };
  };

  // Function to find required n for target epsilon_L
  const findRequiredN = (code, p, target_epsilon_L, k = 1) => {
    const selectedCode = codeLibrary[code];
    if (!selectedCode) return null;

    // Check if physical error rate exceeds threshold
    if (p >= selectedCode.threshold) {
      return null; // Code cannot work above threshold
    }

    let nMin = 10;
    let nMax = 1e6;
    let minDiff = Infinity;
    let bestResult = null;

    // Binary search for the right n
    for (let j = 0; j < 20; j++) {
      const n = Math.floor((nMin + nMax) / 2);
      const result = selectedCode.calculateParams({ p, n, k, epsilon_L: target_epsilon_L });
      const diff = Math.abs(Math.log10(result.epsilon_L) - Math.log10(target_epsilon_L));

      if (diff < minDiff) {
        minDiff = diff;
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
              // Also skip epsilon_L as it's moved to the plot section
              if (name === 'd' || name === 'epsilon_L') return null;
              
              return (
                <div key={name} className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    {name === 'p' ? 'Physical Error Probability (p)' :
                     name === 'n' ? 'Number of Physical Qubits (n)' :
                     name === 'k' ? 'Number of Logical Qubits (k)' :
                     name}
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
          </div>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Results</h2>
            {Object.keys(results).length > 0 && (
              <button
                onClick={() => copyResultsToClipboard()}
                className={`px-3 py-1 text-white text-sm rounded transition-colors ${
                  copyStatus === 'Copied!' ? 'bg-green-600' : 
                  copyStatus === 'Copy failed' ? 'bg-red-600' : 
                  'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Copy results to clipboard"
              >
                {copyStatus || 'Copy Results'}
              </button>
            )}
          </div>
          
          {Object.keys(results).length > 0 ? (
            <div className="space-y-4">
              {results.n && (
                <div className="border-b pb-2">
                  <span className="font-medium">Physical Data Qubits (<InlineMath math="n" />):</span> {Math.ceil(results.n).toLocaleString()}
                </div>
              )}
              
              {results.n_ancilla && (
                <div className="border-b pb-2">
                  <span className="font-medium">Physical Ancilla Qubits (<InlineMath math="n_a" />):</span> {Math.ceil(results.n_ancilla).toLocaleString()}
                </div>
              )}
              
              {results.n && results.n_ancilla && (
                <div className="border-b pb-2">
                  <span className="font-medium">Total Qubits (<InlineMath math="n+n_a" />):</span> {Math.ceil(results.n + results.n_ancilla).toLocaleString()}
                </div>
              )}
              
              {results.k && (
                <div className="border-b pb-2">
                  <span className="font-medium">Logical Qubits (<InlineMath math="k" />):</span> {results.k}
                </div>
              )}
              
              {results.d && (
                <div className="border-b pb-2">
                  <span className="font-medium">Code Distance (<InlineMath math="d" />):</span> {results.d}
                </div>
              )}
              
              {results.epsilon_L && (
                <div className="border-b pb-2">
                  <span className="font-medium">Logical Error Rate (<InlineMath math="\varepsilon_L" />):</span> {results.epsilon_L.toExponential(6)}
                </div>
              )}
              
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-blue-800">
                  For the {codeLibrary[inputs.code].name} with these parameters, you would need a [[<InlineMath math="n=" /> {Math.ceil(results.n)}, <InlineMath math="k=" /> {results.k}, <InlineMath math="d=" /> {results.d}]] code configuration.
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
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">
            Target Logical Error Rate (<InlineMath math="\varepsilon_L" />)
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="range"
              name="epsilon_L"
              min="0"
              max="100"
              value={toLogScale(inputs.epsilon_L, sliderRanges.epsilon_L.min, sliderRanges.epsilon_L.max)}
              onChange={handleInputChange}
              className="w-2/3"
            />
            <input
              type="text"
              value={inputs.epsilon_L.toExponential(2)}
              readOnly
              className="w-1/3 p-1 border rounded text-sm"
            />
          </div>
        </div>
        
        <div className="h-96">
          <Line
            data={{
              datasets: [
                {
                    label: `${codeLibrary['surface'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('surface', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('surface', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(75, 192, 192)',
                  backgroundColor: 'rgba(75, 192, 192, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                {
                    label: `${codeLibrary['hypergraph'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('hypergraph', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('hypergraph', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(255, 99, 132)',
                  backgroundColor: 'rgba(255, 99, 132, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                {
                    label: `${codeLibrary['lifted'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('lifted', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('lifted', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(255, 159, 64)',
                  backgroundColor: 'rgba(255, 159, 64, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                {
                    label: `${codeLibrary['color'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('color', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('color', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(147, 51, 234)',
                  backgroundColor: 'rgba(147, 51, 234, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                {
                    label: `${codeLibrary['yoked_1d'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('yoked_1d', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('yoked_1d', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                {
                    label: `${codeLibrary['yoked_2d'].name} (εₗ = ${inputs.epsilon_L.toExponential(1)})`,
                  data: generatePlotData('yoked_2d', inputs.epsilon_L, inputs.k)?.pValues.map((p, i) => {
                    const plotData = generatePlotData('yoked_2d', inputs.epsilon_L, inputs.k);
                    return {
                      x: p,
                      y: plotData?.nValues[i],
                      k: plotData?.kValues[i]
                    };
                  }),
                  borderColor: 'rgb(16, 185, 129)',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  tension: 0.1,
                  showLine: true
                },
                // Vertical threshold lines
                {
                  label: `Surface Code Threshold (${(codeLibrary['surface'].threshold * 100).toFixed(2)}%)`,
                  data: [
                    { x: codeLibrary['surface'].threshold, y: 10 },
                    { x: codeLibrary['surface'].threshold, y: 100 }
                  ],
                  borderColor: 'rgb(75, 192, 192)',
                  backgroundColor: 'rgb(75, 192, 192)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  showLine: true,
                  tension: 0
                },
                {
                  label: `Hypergraph Product Code Threshold (${(codeLibrary['hypergraph'].threshold * 100).toFixed(2)}%)`,
                  data: [
                    { x: codeLibrary['hypergraph'].threshold, y: 10 },
                    { x: codeLibrary['hypergraph'].threshold, y: 100 }
                  ],
                  borderColor: 'rgb(255, 99, 132)',
                  backgroundColor: 'rgb(255, 99, 132)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  showLine: true,
                  tension: 0
                },
                {
                  label: `Lifted Product Code Threshold (${(codeLibrary['lifted'].threshold * 100).toFixed(2)}%)`,
                  data: [
                    { x: codeLibrary['lifted'].threshold, y: 10 },
                    { x: codeLibrary['lifted'].threshold, y: 100 }
                  ],
                  borderColor: 'rgb(255, 159, 64)',
                  backgroundColor: 'rgb(255, 159, 64)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  showLine: true,
                  tension: 0
                },
                {
                  label: `Color Code Threshold (${(codeLibrary['color'].threshold * 100).toFixed(2)}%)`,
                  data: [
                    { x: codeLibrary['color'].threshold, y: 10 },
                    { x: codeLibrary['color'].threshold, y: 100 }
                  ],
                  borderColor: 'rgb(147, 51, 234)',
                  backgroundColor: 'rgb(147, 51, 234)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  showLine: true,
                  tension: 0
                }
              ]
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
                    title: (tooltipItems) => {
                      return 'QEC Code Requirements';
                    },
                    label: (context) => {
                      const datasetLabel = context.dataset.label;
                      if (datasetLabel && datasetLabel.includes('Threshold')) {
                        return `${datasetLabel}: p = ${context.parsed.x.toExponential(1)}`;
                      }
                      const codeName = context.dataset.label.split(' (')[0];
                      const p = context.parsed.x.toExponential(1);
                      const n = context.parsed.y.toExponential(1);
                      const k = context.raw.k.toExponential(1) || 1;
                      return `${codeName}: p = ${p}, n = ${n} physical qubits, k = ${k} logical qubits`;
                    }
                  }
                },
                legend: {
                  display: true,
                  position: 'top'
                }
              }
            }}
          />
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Code Thresholds (Vertical Dashed Lines):</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><span style={{color: 'rgb(75, 192, 192)'}} className="font-medium">Surface Code:</span> <InlineMath math="p_{\text{th}}" /> = {(codeLibrary['surface'].threshold * 100).toFixed(2)}%</li>
            <li><span style={{color: 'rgb(255, 99, 132)'}} className="font-medium">Hypergraph Product Code:</span> <InlineMath math="p_{\text{th}}" /> = {(codeLibrary['hypergraph'].threshold * 100).toFixed(2)}%</li>
            <li><span style={{color: 'rgb(255, 159, 64)'}} className="font-medium">Lifted Product Code:</span> <InlineMath math="p_{\text{th}}" /> = {(codeLibrary['lifted'].threshold * 100).toFixed(2)}%</li>
            <li><span style={{color: 'rgb(147, 51, 234)'}} className="font-medium">Color Code:</span> <InlineMath math="p_{\text{th}}" /> = {(codeLibrary['color'].threshold * 100).toFixed(2)}%</li>
          </ul>
          <p className="mt-2 text-xs italic">Note: The vertical dashed lines show each code's threshold. No quantum error correction code can work when the physical error rate exceeds its threshold, this is why the curves end at these lines.</p>
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="text-sm text-blue-800 font-medium mb-2">Logical Qubits Encoded by Each Code:</p>
            <p className="text-xs text-blue-700">
              • <strong>Surface and Color Codes:</strong> Encode k = 1 logical qubit per code block.<br/>
              • <strong>Hypergraph Product Code (HGP):</strong> Encodes k ≥ 0.04n logical qubits (we use k = 0.04n).<br/>
              • <strong>Lifted Product Code (LP):</strong> Encodes k ≈ 0.38n^0.85 logical qubits.<br/>
              <strong>Hover over data points</strong> to see the number of logical qubits (k) and physical qubits (n) for each code.
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow mt-6">
        <h2 className="text-xl font-semibold mb-4">Quantum Error Correction Table</h2>
        
        <h3 className="text-lg font-semibold mb-2">Intermediate Era</h3>
        <h4 className="text-md font-medium mb-2">KiloQuop Regime (<InlineMath math="\varepsilon_L = 10^{-3}" />)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (<InlineMath math="p" />)</th>
              <th className="py-2">Required Data Qubits (<InlineMath math="n" />)</th>
              <th className="py-2">Code Distance (<InlineMath math="d" />)</th>
              <th className="py-2">Ancilla Qubits (<InlineMath math="n_a" />)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved <InlineMath math="\varepsilon_L" /></th>
              <th className="py-2">Code Parameters <InlineMath math="[[n,k,d]]" /></th>
              <th className="py-2">Encoding Rate (<InlineMath math="k/n" />)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-3);
              if (!result) return null;
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-3);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
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
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {result.d}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Early FTQC Era</h3>
        <h4 className="text-md font-medium mb-2">MegaQuop Regime (<InlineMath math="\varepsilon_L = 10^{-6}" />)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (<InlineMath math="p" />)</th>
              <th className="py-2">Required Data Qubits (<InlineMath math="n" />)</th>
              <th className="py-2">Code Distance (<InlineMath math="d" />)</th>
              <th className="py-2">Ancilla Qubits (<InlineMath math="n_a" />)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved <InlineMath math="\varepsilon_L" /></th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (<InlineMath math="k/n" />)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-6);
              if (!result) return null;
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-6);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
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
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {result.d}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Large Scale FTQC Era</h3>
        <h4 className="text-md font-medium mb-2">GigaQuop Regime (<InlineMath math="\varepsilon_L = 10^{-9}" />)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (<InlineMath math="p" />)</th>
              <th className="py-2">Required Data Qubits (<InlineMath math="n" />)</th>
              <th className="py-2">Code Distance (<InlineMath math="d" />)</th>
              <th className="py-2">Ancilla Qubits (<InlineMath math="n_a" />)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved <InlineMath math="\varepsilon_L" /></th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (<InlineMath math="k/n" />)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-9);
              if (!result) return null;
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-9);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
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
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {result.d}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4 className="text-md font-medium mb-2">TeraQuop Regime (<InlineMath math="\varepsilon_L = 10^{-12}" />)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (<InlineMath math="p" />)</th>
              <th className="py-2">Required Data Qubits (<InlineMath math="n" />)</th>
              <th className="py-2">Code Distance (<InlineMath math="d" />)</th>
              <th className="py-2">Ancilla Qubits (<InlineMath math="n_a" />)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved <InlineMath math="\varepsilon_L" /></th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (<InlineMath math="k/n" />)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-12);
              if (!result) return null;
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-12);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
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
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {result.d}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3 className="text-lg font-semibold mb-2">Mature Era</h3>
        <h4 className="text-md font-medium mb-2">PetaQuop Regime (<InlineMath math="\varepsilon_L = 10^{-15}" />)</h4>
        <table className="min-w-full bg-white mb-6">
          <thead>
            <tr>
              <th className="py-2">Physical Error Rate (<InlineMath math="p" />)</th>
              <th className="py-2">Required Data Qubits (<InlineMath math="n" />)</th>
              <th className="py-2">Code Distance (<InlineMath math="d" />)</th>
              <th className="py-2">Ancilla Qubits (<InlineMath math="n_a" />)</th>
              <th className="py-2">Total Qubits</th>
              <th className="py-2">Achieved <InlineMath math="\varepsilon_L" /></th>
              <th className="py-2">Code Parameters [[n,k,d]]</th>
              <th className="py-2">Encoding Rate (<InlineMath math="k/n" />)</th>
            </tr>
          </thead>
          <tbody>
            {[5e-3, 1e-3, 1e-4, 1e-5].map(p => {
              const result = findRequiredN(inputs.code, p, 1e-15);
              if (!result) return null;
              const url = new URL(window.location.href);
              url.searchParams.set('code', inputs.code);
              url.searchParams.set('p', p);
              url.searchParams.set('epsilon_L', 1e-15);
              url.searchParams.set('n', Math.ceil(result.n));
              url.searchParams.set('k', 1);
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
                  <td className="border px-4 py-2">[[{Math.ceil(result.n)}, 1, {result.d}]]</td>
                  <td className="border px-4 py-2">{(1/Math.ceil(result.n)).toExponential(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-8 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Formula Reference</h2>
        <div className="text-sm text-gray-700 space-y-6">
          <div>
            <p className="font-bold mb-3">Surface Code:</p>
            <div className="bg-gray-50 p-4 rounded border">
              <BlockMath math="\varepsilon_L^{\text{surface}} = 0.03 \cdot k \cdot \left(\frac{p}{0.011}\right)^{\lceil\lfloor\sqrt{n/k}\rfloor/2\rceil}" />
            </div>
            <p className="mt-3">Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><InlineMath math="\varepsilon_L" /> = Logical Failure Rate</li>
              <li><InlineMath math="k" /> = Number of logical qubits</li>
              <li><InlineMath math="p" /> = Physical error probability</li>
              <li><InlineMath math="n" /> = Number of physical qubits</li>
              <li><InlineMath math="d" /> = Code distance, approximately <InlineMath math="\sqrt{n/k}" /> for surface code</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">Source: <a href="https://arxiv.org/abs/0910.4074" className="text-blue-600 hover:underline">Surface code quantum communication (Fowler et al., 2010)</a></p>
          </div>

          <div>
            <p className="font-bold mb-3">Hypergraph Product Code:</p>
            <div className="bg-gray-50 p-4 rounded border">
              <BlockMath math="\varepsilon_L^{\text{HGP}} = 0.07 \cdot \left(\frac{p}{0.006}\right)^{0.47 \cdot n^{0.27}}" />
            </div>
            <p className="mt-3">Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><InlineMath math="\varepsilon_L" /> = Logical Failure Rate</li>
              <li><InlineMath math="p" /> = Physical error probability</li>
              <li><InlineMath math="n" /> = Number of physical qubits</li>
              <li>Threshold <InlineMath math="p_{\text{th}} \approx 0.006" /> or 0.6%</li>
            </ul>
          </div>

          <div>
            <p className="font-bold mb-3">Lifted Product Code:</p>
            <div className="bg-gray-50 p-4 rounded border">
              <BlockMath math="\varepsilon_L^{\text{LP}} = 2.3 \cdot \left(\frac{p}{0.0066}\right)^{0.11 \cdot n^{0.60}}" />
            </div>
            <p className="mt-3">Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><InlineMath math="\varepsilon_L" /> = Logical Failure Rate</li>
              <li><InlineMath math="p" /> = Physical error probability</li>
              <li><InlineMath math="n" /> = Number of physical qubits</li>
              <li>Threshold <InlineMath math="p_{\text{th}} \approx 0.0066" /> or 0.66%</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">Source for HGP and LP codes: <a href="https://arxiv.org/abs/2308.08648v1" className="text-blue-600 hover:underline">Constant-Overhead Fault-Tolerant Quantum Computation with Reconfigurable Atom Arrays (Xu et al., 2023)</a></p>
          </div>

          <div>
            <p className="font-bold mb-3">Color Code:</p>
            <div className="bg-gray-50 p-4 rounded border">
              <BlockMath math="\varepsilon_L^{\text{color}} = 0.03 \cdot k \cdot \left(\frac{p}{0.0036}\right)^{\lceil d/2 \rceil}" />
            </div>
            <p className="mt-3">Where:</p>
            <ul className="list-disc pl-6 mt-2">
              <li><InlineMath math="\varepsilon_L" /> = Logical Failure Rate</li>
              <li><InlineMath math="k" /> = Number of logical qubits</li>
              <li><InlineMath math="p" /> = Physical error probability</li>
              <li><InlineMath math="d" /> = Code distance, approximately <InlineMath math="\sqrt{n/k}" /> for triangular color codes</li>
              <li>Threshold <InlineMath math="p_{\text{th}} \approx 0.0036" /> or 0.36% (<a href="https://doi.org/10.1103/PRXQuantum.5.030352" className="text-blue-600 hover:underline">circuit-level noise</a>)</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">Color code formula for triangular honeycomb (6.6.6) patches. Steane code [[7,1,3]] is the d=3 member.</p>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <p className="font-medium"><InlineMath math="\varepsilon_L" />: probability that any of the logical qubits fails per code cycle</p>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>Inspiration from: <a href="https://quantumcomputingreport.com/nisq-versus-ftqc-in-the-2025-2029-timeframe/" className="text-blue-600 hover:underline">Quantum Computing Report - NISQ Versus FTQC in the 2025-2029 Timeframe</a></p>
        </div>
      </div>
      <div className="mt-4 text-sm text-gray-500">
      <p>Copyright © 2025 <a href="https://francoismarieleregent.xyz/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">François-Marie Le Régent</a>. Distributed under an MIT license.</p>
    </div>
    </div>
  );
};

export default QuantumCalculator;

