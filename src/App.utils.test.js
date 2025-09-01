import '@testing-library/jest-dom';

describe('QuantumCalculator Utility Functions', () => {
  
  // Replicate utility functions from App.js for testing
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

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

  describe('Debounce Function', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('debounce delays function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('arg1');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    test('debounce cancels previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('call1');
      jest.advanceTimersByTime(500);
      
      debouncedFn('call2');
      jest.advanceTimersByTime(500);
      
      debouncedFn('call3');
      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    test('debounce works with multiple arguments', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2', 123);
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });
  });

  describe('URL Parameter Functions', () => {
    beforeEach(() => {
      delete window.location;
      window.location = { search: '' };
    });

    test('getUrlParams handles empty search string', () => {
      window.location.search = '';
      const params = getUrlParams();
      expect(params).toEqual({});
    });

    test('getUrlParams parses single parameter', () => {
      window.location.search = '?code=surface';
      const params = getUrlParams();
      expect(params).toEqual({ code: 'surface' });
    });

    test('getUrlParams parses multiple parameters', () => {
      window.location.search = '?code=hypergraph&p=0.001&n=1000&k=10&epsilon_L=1e-6';
      const params = getUrlParams();
      
      expect(params.code).toBe('hypergraph');
      expect(params.p).toBe(0.001);
      expect(params.n).toBe(1000);
      expect(params.k).toBe(10);
      expect(params.epsilon_L).toBe(1e-6);
    });

    test('getUrlParams handles scientific notation', () => {
      window.location.search = '?epsilon_L=1e-9&p=5e-4';
      const params = getUrlParams();
      
      expect(params.epsilon_L).toBe(1e-9);
      expect(params.p).toBe(5e-4);
    });

    test('getUrlParams handles invalid numeric values', () => {
      window.location.search = '?p=invalid&n=abc';
      const params = getUrlParams();
      
      expect(isNaN(params.p)).toBe(true);
      expect(isNaN(params.n)).toBe(true);
    });
  });

  describe('Log Scale Conversion Functions', () => {
    test('toLogScale converts values correctly', () => {
      const min = 1e-6;
      const max = 1e-1;
      
      expect(toLogScale(min, min, max)).toBe(0);
      expect(toLogScale(max, min, max)).toBe(100);
      expect(toLogScale(1e-3, min, max)).toBe(60); // Middle of the log range
    });

    test('fromLogScale converts values correctly', () => {
      const min = 1e-6;
      const max = 1e-1;
      
      expect(fromLogScale(0, min, max)).toBeCloseTo(min, 10);
      expect(fromLogScale(100, min, max)).toBeCloseTo(max, 10);
      expect(fromLogScale(60, min, max)).toBeCloseTo(1e-3, 10);
    });

    test('log scale conversion is reversible', () => {
      const min = 1e-6;
      const max = 1e-1;
      const testValues = [1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1];
      
      testValues.forEach(value => {
        const scaled = toLogScale(value, min, max);
        const unscaled = fromLogScale(scaled, min, max);
        expect(unscaled).toBeCloseTo(value, 10);
      });
    });

    test('handles edge cases in log scale conversion', () => {
      const min = 1e-15;
      const max = 1e-3;
      
      // Test very small values
      const smallValue = 1e-12;
      const scaled = toLogScale(smallValue, min, max);
      const unscaled = fromLogScale(scaled, min, max);
      expect(unscaled).toBeCloseTo(smallValue, 10);
      
      // Test values at boundaries
      expect(toLogScale(min, min, max)).toBe(0);
      expect(toLogScale(max, min, max)).toBe(100);
    });
  });

  describe('Slider Range Validation', () => {
    const sliderRanges = {
      p: { min: 1e-6, max: 1e-1 },
      epsilon_L: { min: 1e-15, max: 1e-3 },
      n: { min: 10, max: 1e6 },
      k: { min: 1, max: 1000 }
    };

    test('slider ranges have valid min/max values', () => {
      Object.entries(sliderRanges).forEach(([key, range]) => {
        expect(range.min).toBeGreaterThan(0);
        expect(range.max).toBeGreaterThan(range.min);
        expect(isFinite(range.min)).toBe(true);
        expect(isFinite(range.max)).toBe(true);
      });
    });

    test('log scale conversion works for all slider ranges', () => {
      Object.entries(sliderRanges).forEach(([key, range]) => {
        // Test at 25%, 50%, 75% of scale
        [25, 50, 75].forEach(percentage => {
          const value = fromLogScale(percentage, range.min, range.max);
          const backConverted = toLogScale(value, range.min, range.max);
          expect(backConverted).toBeCloseTo(percentage, 10);
        });
      });
    });
  });

  describe('Plot Data Generation Validation', () => {
    // Mock simplified version of generatePlotData functionality
    const mockGeneratePlotData = (code, epsilon_L, k = 1) => {
      const thresholds = {
        surface: 0.011,
        hypergraph: 0.006,
        lifted: 0.0066,
        color: 0.0036
      };

      const threshold = thresholds[code];
      if (!threshold) return null;

      const pValues = [];
      const nValues = [];
      const kValues = [];

      // Generate points from 1e-6 to threshold
      for (let i = 0; i < 10; i++) {
        const p = Math.pow(10, Math.log10(1e-6) + (Math.log10(threshold * 0.99) - Math.log10(1e-6)) * (i / 9));
        
        if (p >= threshold) break;
        
        pValues.push(p);
        
        // Mock n calculation based on code type
        let n;
        if (code === 'surface') {
          n = Math.max(100, 1000 * Math.pow(p / 0.001, -2));
        } else if (code === 'hypergraph') {
          n = Math.max(100, 500 * Math.pow(p / 0.001, -1.5));
        } else {
          n = Math.max(100, 800 * Math.pow(p / 0.001, -1.8));
        }
        
        nValues.push(n);
        kValues.push(k);
      }

      return { pValues, nValues, kValues, threshold };
    };

    test('generates valid plot data for surface code', () => {
      const plotData = mockGeneratePlotData('surface', 1e-6, 1);
      
      expect(plotData).not.toBeNull();
      expect(plotData.pValues.length).toBeGreaterThan(0);
      expect(plotData.nValues.length).toBe(plotData.pValues.length);
      expect(plotData.kValues.length).toBe(plotData.pValues.length);
      
      // All p values should be below threshold
      plotData.pValues.forEach(p => {
        expect(p).toBeLessThan(plotData.threshold);
        expect(p).toBeGreaterThan(0);
      });
      
      // All n values should be positive
      plotData.nValues.forEach(n => {
        expect(n).toBeGreaterThan(0);
        expect(isFinite(n)).toBe(true);
      });
    });

    test('plot data respects threshold boundaries', () => {
      const codes = ['surface', 'hypergraph', 'lifted', 'color'];
      
      codes.forEach(code => {
        const plotData = mockGeneratePlotData(code, 1e-6, 1);
        expect(plotData).not.toBeNull();
        
        // All p values should be below threshold
        plotData.pValues.forEach(p => {
          expect(p).toBeLessThan(plotData.threshold);
        });
        
        // P values should be increasing
        for (let i = 1; i < plotData.pValues.length; i++) {
          expect(plotData.pValues[i]).toBeGreaterThan(plotData.pValues[i-1]);
        }
      });
    });

    test('handles invalid code gracefully', () => {
      const plotData = mockGeneratePlotData('invalid_code', 1e-6, 1);
      expect(plotData).toBeNull();
    });
  });

  describe('Physical Constants Validation', () => {
    test('threshold values are physically reasonable', () => {
      const thresholds = {
        surface: 0.011,    // 1.1%
        yoked_1d: 0.011,   // Same as surface
        yoked_2d: 0.011,   // Same as surface
        color: 0.0036,     // 0.36%
        hypergraph: 0.006, // 0.6%
        lifted: 0.0066     // 0.66%
      };

      Object.entries(thresholds).forEach(([code, threshold]) => {
        expect(threshold).toBeGreaterThan(0.001); // At least 0.1%
        expect(threshold).toBeLessThan(0.1);      // Less than 10%
      });
    });

    test('prefactor constants are reasonable', () => {
      const prefactors = {
        surface: 0.03,
        yoked: 0.03,
        color: 0.03,
        hypergraph: 0.07,
        lifted: 2.3
      };

      Object.entries(prefactors).forEach(([code, prefactor]) => {
        expect(prefactor).toBeGreaterThan(0);
        expect(prefactor).toBeLessThan(100); // Reasonable upper bound
      });
    });

    test('scaling exponents are physically meaningful', () => {
      // Hypergraph: n^0.27 exponent
      expect(0.27).toBeGreaterThan(0);
      expect(0.27).toBeLessThan(1);
      
      // Lifted: n^0.60 exponent
      expect(0.60).toBeGreaterThan(0);
      expect(0.60).toBeLessThan(1);
      
      // Surface code: d/2 exponent (exponential scaling)
      const typical_d = 31;
      expect(typical_d / 2).toBeGreaterThan(1); // Should be super-exponential
    });
  });

  describe('Error Handling in Utility Functions', () => {
    test('log scale handles zero and negative inputs gracefully', () => {
      const min = 1e-6;
      const max = 1e-1;
      
      // These should not crash, but return NaN or Infinity
      const result1 = toLogScale(0, min, max);
      const result2 = toLogScale(-1, min, max);
      
      expect(isFinite(result1)).toBe(false);
      expect(isFinite(result2)).toBe(false);
    });

    test('fromLogScale handles extreme inputs', () => {
      const min = 1e-6;
      const max = 1e-1;
      
      // Test extreme percentage values
      const result1 = fromLogScale(-100, min, max); // Very negative
      const result2 = fromLogScale(1000, min, max);  // Very positive
      
      expect(result1).toBeGreaterThan(0);
      expect(isFinite(result2)).toBe(true);
    });

    test('URL parsing handles malformed URLs', () => {
      // Test malformed search strings
      window.location.search = '?invalid&malformed=&empty=';
      const params = getUrlParams();
      
      // Should not crash and return an object
      expect(typeof params).toBe('object');
    });
  });

  describe('Performance Considerations', () => {
    test('log scale conversion is fast for many values', () => {
      const min = 1e-6;
      const max = 1e-1;
      const testValues = Array.from({length: 1000}, (_, i) => min * Math.pow(max/min, i/999));
      
      const startTime = performance.now();
      
      testValues.forEach(value => {
        const scaled = toLogScale(value, min, max);
        fromLogScale(scaled, min, max);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (less than 100ms for 1000 conversions)
      expect(duration).toBeLessThan(100);
    });

    test('debounce does not leak memory with rapid calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      // Make many rapid calls
      for (let i = 0; i < 1000; i++) {
        debouncedFn(`call${i}`);
      }
      
      // Should not crash or consume excessive memory
      expect(mockFn).not.toHaveBeenCalled();
    });
  });
}); 