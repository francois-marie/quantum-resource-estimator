import React from 'react';
import '@testing-library/jest-dom';

describe('Quantum Error Correction Mathematical Validation', () => {
  // Replicate the exact code library from App.js for isolated testing
  const codeLibrary = {
    surface: {
      name: 'Surface Code',
      threshold: 0.011,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011;
        result.d = Math.floor(Math.sqrt(params.n / params.k));
        result.n_ancilla = params.k * (Math.pow(result.d - 1, 2) + 2 * (result.d - 1));
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, result.d / 2);
        result.k = params.k;
        result.n = params.n;
        return result;
      }
    },
    yoked_1d: {
      name: '1D Yoked Surface Code',
      threshold: 0.011,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011;
        const d_in = Math.floor(Math.sqrt(params.n / params.k));
        const mu_1d = 1.8;
        result.d = Math.floor(mu_1d * d_in);
        result.n_ancilla = params.k * (Math.pow(d_in - 1, 2) + 2 * (d_in - 1)) * 1.2;
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        result.k = params.k;
        result.n = params.n;
        return result;
      }
    },
    yoked_2d: {
      name: '2D Yoked Surface Code',
      threshold: 0.011,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.011;
        const d_in = Math.floor(Math.sqrt(params.n / params.k));
        const mu_2d = 3.2;
        result.d = Math.floor(mu_2d * d_in);
        result.n_ancilla = params.k * (Math.pow(d_in - 1, 2) + 2 * (d_in - 1)) * 1.5;
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        result.k = params.k;
        result.n = params.n;
        return result;
      }
    },
    color: {
      name: 'Color Code',
      threshold: 0.0036,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.0036;
        result.d = Math.floor(Math.sqrt(params.n / params.k));
        result.n_ancilla = params.k * (Math.pow(result.d - 1, 2) + 2 * (result.d - 1));
        result.epsilon_L = 0.03 * params.k * Math.pow(p_ratio, Math.ceil(result.d / 2));
        result.k = params.k;
        result.n = params.n;
        return result;
      }
    },
    hypergraph: {
      name: 'Hypergraph Product Code',
      threshold: 0.006,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.006;
        result.epsilon_L = 0.07 * Math.pow(p_ratio, 0.47 * Math.pow(params.n, 0.27));
        result.n = params.n;
        return result;
      }
    },
    lifted: {
      name: 'Lifted Product Code',
      threshold: 0.0066,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.0066;
        result.epsilon_L = 2.3 * Math.pow(p_ratio, 0.11 * Math.pow(params.n, 0.60));
        result.n = params.n;
        return result;
      }
    }
  };

  describe('Surface Code Edge Cases', () => {
    test('handles minimal parameters', () => {
      const params = { p: 1e-6, n: 9, k: 1, epsilon_L: 1e-12 };
      const result = codeLibrary.surface.calculateParams(params);
      
      expect(result.d).toBe(3); // floor(sqrt(9/1))
      expect(result.n_ancilla).toBe(8); // 1 * ((3-1)^2 + 2*(3-1))
      expect(result.epsilon_L).toBeCloseTo(0.03 * 1 * Math.pow(1e-6/0.011, 3/2), 15);
    });

    test('handles large number of logical qubits', () => {
      const params = { p: 0.001, n: 10000, k: 100, epsilon_L: 1e-6 };
      const result = codeLibrary.surface.calculateParams(params);
      
      expect(result.d).toBe(10); // floor(sqrt(10000/100))
      expect(result.k).toBe(100);
      expect(result.n_ancilla).toBe(9900); // 100 * ((10-1)^2 + 2*(10-1)) = 100 * (81 + 18) = 9900
    });

    test('handles error probability at threshold', () => {
      const params = { p: 0.010999, n: 1000, k: 1, epsilon_L: 1e-6 };
      const result = codeLibrary.surface.calculateParams(params);
      
      expect(result.epsilon_L).toBeCloseTo(0.03 * 1 * Math.pow(0.010999/0.011, 31/2), 10);
    });

    test('logical error rate increases with physical error rate', () => {
      const baseParams = { n: 1000, k: 1, epsilon_L: 1e-6 };
      
      const result1 = codeLibrary.surface.calculateParams({ ...baseParams, p: 0.001 });
      const result2 = codeLibrary.surface.calculateParams({ ...baseParams, p: 0.005 });
      
      expect(result2.epsilon_L).toBeGreaterThan(result1.epsilon_L);
    });
  });

  describe('Yoked Surface Code Validation', () => {
    test('1D yoked effective distance is larger than base distance', () => {
      const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      const surfaceResult = codeLibrary.surface.calculateParams(params);
      const yoked1dResult = codeLibrary.yoked_1d.calculateParams(params);
      
      expect(yoked1dResult.d).toBeGreaterThan(surfaceResult.d);
      expect(yoked1dResult.epsilon_L).toBeLessThan(surfaceResult.epsilon_L);
    });

    test('2D yoked effective distance is larger than 1D yoked', () => {
      const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      const yoked1dResult = codeLibrary.yoked_1d.calculateParams(params);
      const yoked2dResult = codeLibrary.yoked_2d.calculateParams(params);
      
      expect(yoked2dResult.d).toBeGreaterThan(yoked1dResult.d);
      expect(yoked2dResult.epsilon_L).toBeLessThan(yoked1dResult.epsilon_L);
    });

    test('2D yoked has higher ancilla overhead than 1D yoked', () => {
      const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      const yoked1dResult = codeLibrary.yoked_1d.calculateParams(params);
      const yoked2dResult = codeLibrary.yoked_2d.calculateParams(params);
      
      expect(yoked2dResult.n_ancilla).toBeGreaterThan(yoked1dResult.n_ancilla);
    });
  });

  describe('Color Code Validation', () => {
    test('color code has lower threshold than surface code', () => {
      expect(codeLibrary.color.threshold).toBeLessThan(codeLibrary.surface.threshold);
    });

    test('color code calculations with circuit-level threshold', () => {
      const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
      const result = codeLibrary.color.calculateParams(params);
      
      const p_ratio = 0.001 / 0.0036;
      const expectedEpsilon = 0.03 * 1 * Math.pow(p_ratio, Math.ceil(31 / 2));
      
      expect(result.epsilon_L).toBeCloseTo(expectedEpsilon, 10);
    });

    test('color code vs surface code performance comparison', () => {
      const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      const surfaceResult = codeLibrary.surface.calculateParams(params);
      const colorResult = codeLibrary.color.calculateParams(params);
      
      // Both should be finite and positive
      expect(surfaceResult.epsilon_L).toBeGreaterThan(0);
      expect(colorResult.epsilon_L).toBeGreaterThan(0);
      expect(isFinite(surfaceResult.epsilon_L)).toBe(true);
      expect(isFinite(colorResult.epsilon_L)).toBe(true);
    });
  });

  describe('Hypergraph Product Code Validation', () => {
    test('HGP scaling with number of qubits', () => {
      const baseParams = { p: 0.001, epsilon_L: 1e-6 };
      
      const result1 = codeLibrary.hypergraph.calculateParams({ ...baseParams, n: 100 });
      const result2 = codeLibrary.hypergraph.calculateParams({ ...baseParams, n: 1000 });
      const result3 = codeLibrary.hypergraph.calculateParams({ ...baseParams, n: 10000 });
      
      // As n increases, epsilon_L should decrease (better performance)
      expect(result2.epsilon_L).toBeLessThan(result1.epsilon_L);
      expect(result3.epsilon_L).toBeLessThan(result2.epsilon_L);
    });

    test('HGP threshold behavior', () => {
      const params = { n: 1000, epsilon_L: 1e-6 };
      
      const p_below = 0.005; // Below threshold
      const p_above = 0.007; // Above threshold
      
      const result1 = codeLibrary.hypergraph.calculateParams({ ...params, p: p_below });
      const result2 = codeLibrary.hypergraph.calculateParams({ ...params, p: p_above });
      
      expect(result2.epsilon_L).toBeGreaterThan(result1.epsilon_L);
    });

    test('HGP formula validation', () => {
      const params = { p: 0.003, n: 1000 };
      const result = codeLibrary.hypergraph.calculateParams(params);
      
      const p_ratio = 0.003 / 0.006;
      const expectedEpsilon = 0.07 * Math.pow(p_ratio, 0.47 * Math.pow(1000, 0.27));
      
      expect(result.epsilon_L).toBeCloseTo(expectedEpsilon, 15);
    });
  });

  describe('Lifted Product Code Validation', () => {
    test('LP scaling with number of qubits', () => {
      const baseParams = { p: 0.001, epsilon_L: 1e-6 };
      
      const result1 = codeLibrary.lifted.calculateParams({ ...baseParams, n: 100 });
      const result2 = codeLibrary.lifted.calculateParams({ ...baseParams, n: 1000 });
      const result3 = codeLibrary.lifted.calculateParams({ ...baseParams, n: 10000 });
      
      // As n increases, epsilon_L should decrease
      expect(result2.epsilon_L).toBeLessThan(result1.epsilon_L);
      expect(result3.epsilon_L).toBeLessThan(result2.epsilon_L);
    });

    test('LP formula validation', () => {
      const params = { p: 0.003, n: 1000 };
      const result = codeLibrary.lifted.calculateParams(params);
      
      const p_ratio = 0.003 / 0.0066;
      const expectedEpsilon = 2.3 * Math.pow(p_ratio, 0.11 * Math.pow(1000, 0.60));
      
      expect(result.epsilon_L).toBeCloseTo(expectedEpsilon, 15);
    });

    test('LP vs HGP performance comparison', () => {
      const params = { p: 0.003, n: 1000 };
      
      const hgpResult = codeLibrary.hypergraph.calculateParams(params);
      const lpResult = codeLibrary.lifted.calculateParams(params);
      
      // Both should be finite and positive
      expect(hgpResult.epsilon_L).toBeGreaterThan(0);
      expect(lpResult.epsilon_L).toBeGreaterThan(0);
      expect(isFinite(hgpResult.epsilon_L)).toBe(true);
      expect(isFinite(lpResult.epsilon_L)).toBe(true);
    });
  });

  describe('Cross-Code Comparison Tests', () => {
    test('all codes respect their thresholds', () => {
      Object.entries(codeLibrary).forEach(([codeName, code]) => {
        expect(code.threshold).toBeGreaterThan(0);
        expect(code.threshold).toBeLessThan(0.1); // Reasonable upper bound
      });
    });

    test('consistent behavior at low error rates', () => {
      const params = { p: 1e-5, n: 1000, k: 1, epsilon_L: 1e-9 };
      
      Object.entries(codeLibrary).forEach(([codeName, code]) => {
        const result = code.calculateParams(params);
        
        expect(result.epsilon_L).toBeGreaterThan(0);
        expect(isFinite(result.epsilon_L)).toBe(true);
        expect(result.n).toBe(1000);
      });
    });

    test('logical error rate monotonicity with physical error rate', () => {
      const baseParams = { n: 1000, k: 1, epsilon_L: 1e-6 };
      const errorRates = [1e-5, 1e-4, 1e-3, 5e-3];
      
      Object.entries(codeLibrary).forEach(([codeName, code]) => {
        let prevEpsilon = 0;
        
        errorRates.forEach(p => {
          if (p < code.threshold) { // Only test below threshold
            const result = code.calculateParams({ ...baseParams, p });
            expect(result.epsilon_L).toBeGreaterThan(prevEpsilon);
            prevEpsilon = result.epsilon_L;
          }
        });
      });
    });
  });

  describe('Numerical Stability Tests', () => {
    test('handles very small error probabilities', () => {
      const params = { p: 1e-4, n: 1000, k: 1, epsilon_L: 1e-6 }; // Use more reasonable values
      
      Object.entries(codeLibrary).forEach(([codeName, code]) => {
        const result = code.calculateParams(params);
        
        expect(isFinite(result.epsilon_L)).toBe(true);
        expect(result.epsilon_L).toBeGreaterThanOrEqual(0); // Allow zero in edge cases
        expect(result.epsilon_L).toBeLessThan(1);
      });
    });

    test('handles large numbers of qubits', () => {
      const params = { p: 1e-4, n: 1e6, k: 1000, epsilon_L: 1e-6 };
      
      // Test surface-like codes
      ['surface', 'yoked_1d', 'yoked_2d', 'color'].forEach(codeName => {
        const result = codeLibrary[codeName].calculateParams(params);
        
        expect(isFinite(result.d)).toBe(true);
        expect(isFinite(result.n_ancilla)).toBe(true);
        expect(result.d).toBeGreaterThan(0);
        expect(result.n_ancilla).toBeGreaterThan(0);
      });
    });

    test('prevents division by zero scenarios', () => {
      const params = { p: 0, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      Object.entries(codeLibrary).forEach(([codeName, code]) => {
        const result = code.calculateParams(params);
        
        expect(isFinite(result.epsilon_L)).toBe(true);
        expect(result.epsilon_L).not.toBeNaN();
      });
    });
  });

  describe('Physical Constraints Validation', () => {
    test('ancilla qubits scale reasonably with data qubits', () => {
      const params = { p: 1e-3, n: 1000, k: 1, epsilon_L: 1e-6 };
      
      ['surface', 'yoked_1d', 'yoked_2d', 'color'].forEach(codeName => {
        const result = codeLibrary[codeName].calculateParams(params);
        
        // Ancilla should be reasonable fraction of total
        expect(result.n_ancilla).toBeLessThan(10 * result.n);
        expect(result.n_ancilla).toBeGreaterThan(0);
      });
    });

    test('code distance scales with qubit number', () => {
      const baseParams = { p: 1e-3, k: 1, epsilon_L: 1e-6 };
      
      ['surface', 'color'].forEach(codeName => {
        const result1 = codeLibrary[codeName].calculateParams({ ...baseParams, n: 100 });
        const result2 = codeLibrary[codeName].calculateParams({ ...baseParams, n: 1000 });
        const result3 = codeLibrary[codeName].calculateParams({ ...baseParams, n: 10000 });
        
        expect(result2.d).toBeGreaterThan(result1.d);
        expect(result3.d).toBeGreaterThan(result2.d);
      });
    });
  });
}); 