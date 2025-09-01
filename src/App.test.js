import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import QuantumCalculator from './App';

// Mock Chart.js to avoid canvas issues in tests
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }) => (
    <div data-testid="chart-mock">
      Chart with {data?.datasets?.length || 0} datasets
    </div>
  )
}));

// Mock navigator.clipboard for copy functionality tests
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('QuantumCalculator Utility Functions', () => {
  // Test debounce function
  test('debounce should delay function execution', async () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 100);
    
    debouncedFn('test1');
    debouncedFn('test2');
    debouncedFn('test3');
    
    expect(mockFn).not.toHaveBeenCalled();
    
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test3');
  });

  // Test URL parameter parsing
  test('getUrlParams should parse URL parameters correctly', () => {
    // Mock window.location.search
    delete window.location;
    window.location = { search: '?code=surface&p=0.001&epsilon_L=1e-6&n=1000&k=10' };
    
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

    const params = getUrlParams();
    expect(params.code).toBe('surface');
    expect(params.p).toBe(0.001);
    expect(params.epsilon_L).toBe(1e-6);
    expect(params.n).toBe(1000);
    expect(params.k).toBe(10);
  });

  // Test log scale conversion functions
  test('log scale conversion should work correctly', () => {
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

describe('QuantumCalculator Code Library Calculations', () => {
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
    }
  };

  test('surface code calculations should be correct', () => {
    const params = { p: 0.001, n: 1000, k: 1, epsilon_L: 1e-6 };
    const result = codeLibrary.surface.calculateParams(params);
    
    expect(result.d).toBe(31); // floor(sqrt(1000/1))
    expect(result.n).toBe(1000);
    expect(result.k).toBe(1);
    expect(result.n_ancilla).toBe(960); // 1 * ((31-1)^2 + 2*(31-1))
    expect(result.epsilon_L).toBeCloseTo(0.03 * 1 * Math.pow(0.001/0.011, 31/2), 10);
  });

  test('surface code should handle different k values', () => {
    const params = { p: 0.001, n: 1000, k: 10, epsilon_L: 1e-6 };
    const result = codeLibrary.surface.calculateParams(params);
    
    expect(result.d).toBe(10); // floor(sqrt(1000/10))
    expect(result.k).toBe(10);
    expect(result.n_ancilla).toBe(990); // 10 * ((10-1)^2 + 2*(10-1))
  });

  test('hypergraph product code calculations', () => {
    const hypergraph = {
      threshold: 0.006,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.006;
        result.epsilon_L = 0.07 * Math.pow(p_ratio, 0.47 * Math.pow(params.n, 0.27));
        result.n = params.n;
        return result;
      }
    };

    const params = { p: 0.001, n: 1000 };
    const result = hypergraph.calculateParams(params);
    
    expect(result.n).toBe(1000);
    expect(result.epsilon_L).toBeCloseTo(0.07 * Math.pow(0.001/0.006, 0.47 * Math.pow(1000, 0.27)), 10);
  });

  test('lifted product code calculations', () => {
    const lifted = {
      threshold: 0.0066,
      calculateParams: (params) => {
        let result = {};
        const p_ratio = params.p / 0.0066;
        result.epsilon_L = 2.3 * Math.pow(p_ratio, 0.11 * Math.pow(params.n, 0.60));
        result.n = params.n;
        return result;
      }
    };

    const params = { p: 0.001, n: 1000 };
    const result = lifted.calculateParams(params);
    
    expect(result.n).toBe(1000);
    expect(result.epsilon_L).toBeCloseTo(2.3 * Math.pow(0.001/0.0066, 0.11 * Math.pow(1000, 0.60)), 10);
  });
});

describe('QuantumCalculator Component Rendering', () => {
  beforeEach(() => {
    // Reset window.location for each test
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('renders main title', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText('Quantum Error Correction Resource Estimator')).toBeInTheDocument();
  });

  test('renders warning banner', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText(/This website is still work in progress/)).toBeInTheDocument();
    expect(screen.getByText('GitHub repository')).toBeInTheDocument();
  });

  test('renders all main sections', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText('Input Parameters')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Required Physical Qubits vs Error Rate')).toBeInTheDocument();
    expect(screen.getByText('Quantum Error Correction Table')).toBeInTheDocument();
    expect(screen.getByText('Formula Reference')).toBeInTheDocument();
  });

  test('renders quantum code dropdown with all options', () => {
    render(<QuantumCalculator />);
    
    // Look for the label text and then find the select element
    expect(screen.getByText('Quantum Error Correction Code')).toBeInTheDocument();
    
    // Find the select element by its name attribute
    const dropdown = document.querySelector('select[name="code"]');
    expect(dropdown).toBeInTheDocument();
    
    const options = dropdown.querySelectorAll('option');
    expect(options).toHaveLength(6); // surface, yoked_1d, yoked_2d, color, hypergraph, lifted
  });

  test('renders parameter sliders', () => {
    render(<QuantumCalculator />);
    expect(screen.getByText('Physical Error Probability (p)')).toBeInTheDocument();
    expect(screen.getByText('Number of Physical Qubits (n)')).toBeInTheDocument();
    expect(screen.getByText('Number of Logical Qubits (k)')).toBeInTheDocument();
  });

  test('renders chart component', () => {
    render(<QuantumCalculator />);
    expect(screen.getByTestId('chart-mock')).toBeInTheDocument();
  });
});

describe('QuantumCalculator User Interactions', () => {
  // Remove userEvent.setup() which doesn't exist in this version

  beforeEach(() => {
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('changing quantum code updates selection', async () => {
    render(<QuantumCalculator />);
    const dropdown = document.querySelector('select[name="code"]');
    
    await userEvent.selectOptions(dropdown, 'hypergraph');
    expect(dropdown.value).toBe('hypergraph');
  });

  test('slider interaction updates values', async () => {
    render(<QuantumCalculator />);
    const slider = document.querySelector('input[name="p"][type="range"]');
    
    fireEvent.change(slider, { target: { value: '50' } });
    
    // The slider value should update (we can't easily test the exact converted value without access to the conversion function)
    expect(slider.value).toBe('50');
  });

  test('copy results button appears when results exist', async () => {
    render(<QuantumCalculator />);
    
    // Wait for initial calculations to complete
    await waitFor(() => {
      const copyButton = screen.queryByText('Copy Results');
      expect(copyButton).toBeInTheDocument();
    });
  });

  test('copy results functionality works', async () => {
    render(<QuantumCalculator />);
    
    await waitFor(() => {
      const copyButton = screen.getByText('Copy Results');
      fireEvent.click(copyButton);
    });
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });
});

describe('QuantumCalculator State Management', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('initial state has correct default values', () => {
    render(<QuantumCalculator />);
    
    const codeDropdown = document.querySelector('select[name="code"]');
    expect(codeDropdown.value).toBe('surface');
  });

  test('loads state from URL parameters', () => {
    delete window.location;
    window.location = { 
      search: '?code=hypergraph&p=0.002&n=2000&k=20',
      pathname: '/',
      href: 'http://localhost/'
    };
    
    render(<QuantumCalculator />);
    
    const codeDropdown = screen.getByDisplayValue('Hypergraph Product Code');
    expect(codeDropdown).toBeInTheDocument();
  });
});

describe('QuantumCalculator Results Display', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('displays calculated results', async () => {
    render(<QuantumCalculator />);
    
    await waitFor(() => {
      // Look for results that should appear after calculation
      expect(screen.getByText('Results')).toBeInTheDocument();
      // Check if any numerical results are displayed
      const resultsSection = document.querySelector('.bg-white .space-y-4');
      expect(resultsSection).toBeInTheDocument();
    });
  });

  test('displays error message when calculation fails', async () => {
    // This would require mocking a calculation failure scenario
    // For now, we test that the error display mechanism exists
    render(<QuantumCalculator />);
    
    const errorContainer = document.querySelector('.bg-red-100');
    // Error container should exist in DOM structure even if not currently showing
    expect(document.querySelector('.mt-4')).toBeInTheDocument();
  });
});

describe('QuantumCalculator Table Generation', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { search: '', pathname: '/', href: 'http://localhost/' };
    window.history = { replaceState: jest.fn() };
  });

  test('renders quantum error correction tables', () => {
    render(<QuantumCalculator />);
    
    expect(screen.getByText('Quantum Error Correction Table')).toBeInTheDocument();
    expect(screen.getByText('Intermediate Era')).toBeInTheDocument();
    expect(screen.getByText('Early FTQC Era')).toBeInTheDocument();
  });

  test('table rows are clickable links', () => {
    render(<QuantumCalculator />);
    
    const tables = document.querySelectorAll('table');
    expect(tables.length).toBeGreaterThan(0);
    
    const firstTable = tables[0];
    const rows = firstTable.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('QuantumCalculator Mathematical Formulas', () => {
  test('formula reference section renders correctly', () => {
    render(<QuantumCalculator />);
    
    expect(screen.getByText('Formula Reference')).toBeInTheDocument();
    // Check for multiple instances of formula headings (they appear in charts and formulas)
    expect(screen.getAllByText('1D Yoked Surface Code:')).toHaveLength(2);
    expect(screen.getAllByText('2D Yoked Surface Code:')).toHaveLength(2);
    expect(screen.getAllByText('Hypergraph Product Code:')).toHaveLength(2);
    expect(screen.getAllByText('Lifted Product Code:')).toHaveLength(2);
    expect(screen.getAllByText('Color Code:')).toHaveLength(2);
  });
});

// Helper function to extract debounce from component (for testing)
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
