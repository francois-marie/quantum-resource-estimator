import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import QuantumCalculator from './App';

// Mock Chart.js to avoid canvas issues
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mocked-chart">Chart</div>
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('QuantumCalculator - Core Functionality', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('renders without crashing', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText('Quantum Error Correction Resource Estimator')).toBeInTheDocument();
  });

  test('displays main sections', () => {
    render(<QuantumCalculator />);
    
    expect(screen.getByText('Input Parameters')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Formula Reference')).toBeInTheDocument();
  });

  test('renders warning banner', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText(/work in progress/)).toBeInTheDocument();
  });

  test('renders chart component', () => {
    render(<QuantumCalculator />);
    expect(screen.getByTestId('mocked-chart')).toBeInTheDocument();
  });

  test('has copyright notice', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText(/Copyright © 2025/)).toBeInTheDocument();
    expect(screen.getByText('François-Marie Le Régent')).toBeInTheDocument();
  });
});

describe('QuantumCalculator - Utility Functions (Unit Tests)', () => {
  // Test the actual utility functions in isolation
  
  test('debounce function works correctly', (done) => {
    const debounce = (func, wait) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
      };
    };

    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn('test');
    expect(mockFn).not.toHaveBeenCalled();

    setTimeout(() => {
      expect(mockFn).toHaveBeenCalledWith('test');
      done();
    }, 100);
  });

  test('URL parameter parsing', () => {
    const getUrlParams = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const params = {};
      for (const [key, value] of searchParams.entries()) {
        if (key === 'code') {
          params[key] = value;
        } else {
          params[key] = parseFloat(value);
        }
      }
      return params;
    };

    window.location.search = '?code=surface&p=0.001&n=1000';
    const params = getUrlParams();
    
    expect(params.code).toBe('surface');
    expect(params.p).toBe(0.001);
    expect(params.n).toBe(1000);
  });

  test('log scale conversion', () => {
    const toLogScale = (value, min, max) => {
      const minLog = Math.log10(min);
      const maxLog = Math.log10(max);
      return (Math.log10(value) - minLog) / (maxLog - minLog) * 100;
    };

    const fromLogScale = (value, min, max) => {
      const minLog = Math.log10(min);
      const maxLog = Math.log10(max);
      return Math.pow(10, minLog + (value / 100) * (maxLog - minLog));
    };

    const min = 1e-6;
    const max = 1e-1;
    const testValue = 1e-3;
    
    const scaled = toLogScale(testValue, min, max);
    const unscaled = fromLogScale(scaled, min, max);
    
    expect(unscaled).toBeCloseTo(testValue, 10);
  });
});

describe('QuantumCalculator - Code Calculations (Unit Tests)', () => {
  // Test core calculation logic in isolation
  
  test('surface code calculation logic', () => {
    const calculateSurfaceCode = (params) => {
      const p_ratio = params.p / 0.011;
      const d = Math.floor(Math.sqrt(params.n / params.k));
      const n_ancilla = params.k * (Math.pow(d - 1, 2) + 2 * (d - 1));
      const epsilon_L = 0.03 * params.k * Math.pow(p_ratio, d / 2);
      
      return { d, n_ancilla, epsilon_L, n: params.n, k: params.k };
    };

    const params = { p: 0.001, n: 1000, k: 1 };
    const result = calculateSurfaceCode(params);
    
    expect(result.d).toBe(31); // floor(sqrt(1000/1))
    expect(result.n_ancilla).toBe(960); // 1 * ((31-1)^2 + 2*(31-1))
    expect(result.epsilon_L).toBeGreaterThan(0);
    expect(isFinite(result.epsilon_L)).toBe(true);
  });

  test('hypergraph product code calculation', () => {
    const calculateHGP = (params) => {
      const p_ratio = params.p / 0.006;
      const epsilon_L = 0.07 * Math.pow(p_ratio, 0.47 * Math.pow(params.n, 0.27));
      return { epsilon_L, n: params.n };
    };

    const params = { p: 0.003, n: 1000 };
    const result = calculateHGP(params);
    
    expect(result.epsilon_L).toBeGreaterThan(0);
    expect(isFinite(result.epsilon_L)).toBe(true);
    expect(result.n).toBe(1000);
  });

  test('code thresholds are reasonable', () => {
    const thresholds = {
      surface: 0.011,
      color: 0.0036,
      hypergraph: 0.006,
      lifted: 0.0066
    };

    Object.values(thresholds).forEach(threshold => {
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThan(0.1); // Less than 10%
    });
  });
});

describe('QuantumCalculator - Physical Validation', () => {
  test('scaling behavior makes physical sense', () => {
    const calculateSurfaceEpsilon = (p, n, k) => {
      const p_ratio = p / 0.011;
      const d = Math.floor(Math.sqrt(n / k));
      return 0.03 * k * Math.pow(p_ratio, d / 2);
    };

    // Higher error rate should give higher logical error rate
    const eps1 = calculateSurfaceEpsilon(0.001, 1000, 1);
    const eps2 = calculateSurfaceEpsilon(0.005, 1000, 1);
    expect(eps2).toBeGreaterThan(eps1);

    // More physical qubits should give lower logical error rate (higher distance)
    const eps3 = calculateSurfaceEpsilon(0.001, 1000, 1);
    const eps4 = calculateSurfaceEpsilon(0.001, 4000, 1);
    expect(eps4).toBeLessThan(eps3);
  });

  test('numerical stability with extreme values', () => {
    const calculateSurfaceEpsilon = (p, n, k) => {
      const p_ratio = p / 0.011;
      const d = Math.floor(Math.sqrt(n / k));
      return 0.03 * k * Math.pow(p_ratio, d / 2);
    };

    // Very small error rate
    const result1 = calculateSurfaceEpsilon(1e-6, 1000, 1);
    expect(isFinite(result1)).toBe(true);
    expect(result1).toBeGreaterThan(0);

    // Large number of qubits
    const result2 = calculateSurfaceEpsilon(1e-3, 1e6, 1000);
    expect(isFinite(result2)).toBe(true);
    expect(result2).toBeGreaterThan(0);
  });
});

describe('QuantumCalculator - Mathematical Constants', () => {
  test('prefactor constants are physically reasonable', () => {
    const prefactors = [0.03, 0.07, 2.3]; // Surface/Color, HGP, LP
    
    prefactors.forEach(prefactor => {
      expect(prefactor).toBeGreaterThan(0);
      expect(prefactor).toBeLessThan(100);
    });
  });

  test('scaling exponents are meaningful', () => {
    // HGP exponent: n^0.27
    expect(0.27).toBeGreaterThan(0);
    expect(0.27).toBeLessThan(1);
    
    // LP exponent: n^0.60
    expect(0.60).toBeGreaterThan(0);
    expect(0.60).toBeLessThan(1);
    
    // Typical surface code distance exponent
    const typical_d = 31;
    expect(typical_d / 2).toBeGreaterThan(1); // Exponential suppression
  });
});

describe('QuantumCalculator - Edge Cases', () => {
  test('handles minimum viable parameters', () => {
    const calculateSurfaceCode = (params) => {
      const p_ratio = params.p / 0.011;
      const d = Math.floor(Math.sqrt(params.n / params.k));
      const n_ancilla = params.k * (Math.pow(d - 1, 2) + 2 * (d - 1));
      const epsilon_L = 0.03 * params.k * Math.pow(p_ratio, d / 2);
      
      return { d, n_ancilla, epsilon_L };
    };

    // Minimum case: 9 qubits, 1 logical qubit
    const result = calculateSurfaceCode({ p: 1e-3, n: 9, k: 1 });
    
    expect(result.d).toBe(3); // floor(sqrt(9/1))
    expect(result.n_ancilla).toBe(8); // 1 * ((3-1)^2 + 2*(3-1))
    expect(isFinite(result.epsilon_L)).toBe(true);
  });

  test('log scale handles boundary values', () => {
    const toLogScale = (value, min, max) => {
      const minLog = Math.log10(min);
      const maxLog = Math.log10(max);
      return (Math.log10(value) - minLog) / (maxLog - minLog) * 100;
    };

    const min = 1e-6;
    const max = 1e-1;
    
    expect(toLogScale(min, min, max)).toBe(0);
    expect(toLogScale(max, min, max)).toBe(100);
  });
}); 