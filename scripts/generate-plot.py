#!/usr/bin/env python3
"""
Generate a static plot for the README.md file showing quantum error correction resource requirements.
"""

import matplotlib.pyplot as plt
import numpy as np
import os
from pathlib import Path

# Code library - replicated from App.js
class CodeLibrary:
    def __init__(self):
        self.codes = {
            'surface': {
                'name': 'Surface Code',
                'threshold': 0.011,
                'color': '#4bc0c0',
                'calculate_params': self._surface_calculate_params
            },
            'hypergraph': {
                'name': 'Hypergraph Product Code',
                'threshold': 0.006,
                'color': '#ff6384',
                'calculate_params': self._hypergraph_calculate_params
            },
            'lifted': {
                'name': 'Lifted Product Code',
                'threshold': 0.0066,
                'color': '#ff9f40',
                'calculate_params': self._lifted_calculate_params
            },
            'color': {
                'name': 'Color Code',
                'threshold': 0.0036,
                'color': '#9333ea',
                'calculate_params': self._color_calculate_params
            },
            'yoked_1d': {
                'name': '1D Yoked Surface Code',
                'threshold': 0.011,
                'color': '#22c55e',
                'calculate_params': self._yoked_1d_calculate_params
            },
            'yoked_2d': {
                'name': '2D Yoked Surface Code',
                'threshold': 0.011,
                'color': '#10b981',
                'calculate_params': self._yoked_2d_calculate_params
            }
        }
    
    def _surface_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.011
        d = int(np.sqrt(n / k))
        n_ancilla = k * (d - 1)**2 + 2 * k * (d - 1)
        epsilon_L_calc = 0.03 * k * (p_ratio ** (d / 2))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n,
            'k': k,
            'd': d,
            'n_ancilla': n_ancilla
        }
    
    def _hypergraph_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.006
        epsilon_L_calc = 0.07 * (p_ratio ** (0.47 * (n ** 0.27)))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n
        }
    
    def _lifted_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.0066
        epsilon_L_calc = 2.3 * (p_ratio ** (0.11 * (n ** 0.60)))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n
        }
    
    def _color_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.0036
        d = int(np.sqrt(n / k))
        n_ancilla = k * (d - 1)**2 + 2 * k * (d - 1)
        epsilon_L_calc = 0.03 * k * (p_ratio ** np.ceil(d / 2))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n,
            'k': k,
            'd': d,
            'n_ancilla': n_ancilla
        }
    
    def _yoked_1d_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.011
        # Calculate inner patch distance
        d_in = int(np.sqrt(n / k))
        # Effective distance with 1D yoke: ~2x multiplier (conservative: 1.8)
        mu_1d = 1.8
        d = int(mu_1d * d_in)
        # Ancilla qubits calculation with ~20% overhead for yoke connections
        n_ancilla = k * (d_in - 1)**2 + 2 * k * (d_in - 1)
        n_ancilla *= 1.2
        # Calculate logical error rate with effective distance
        epsilon_L_calc = 0.03 * k * (p_ratio ** np.ceil(d / 2))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n,
            'k': k,
            'd': d,
            'n_ancilla': n_ancilla
        }
    
    def _yoked_2d_calculate_params(self, p, n, k, epsilon_L):
        p_ratio = p / 0.011
        # Calculate inner patch distance
        d_in = int(np.sqrt(n / k))
        # Effective distance with 2D yoke: ~4x multiplier (conservative: 3.2)
        mu_2d = 3.2
        d = int(mu_2d * d_in)
        # Ancilla qubits calculation with ~50% overhead for 2D yoke connections
        n_ancilla = k * (d_in - 1)**2 + 2 * k * (d_in - 1)
        n_ancilla *= 1.5
        # Calculate logical error rate with effective distance
        epsilon_L_calc = 0.03 * k * (p_ratio ** np.ceil(d / 2))
        return {
            'epsilon_L': epsilon_L_calc,
            'n': n,
            'k': k,
            'd': d,
            'n_ancilla': n_ancilla
        }

def generate_plot_data(code_library, code_name, epsilon_L, k=1):
    """Generate plot data for a specific error correction code."""
    code = code_library.codes[code_name]
    threshold = code['threshold']
    
    p_values = []
    n_values = []
    
    # Generate 50 points from 1e-6 to threshold (stopping at threshold)
    for i in range(50):
        p = 10**(np.log10(1e-6) + (np.log10(threshold * 0.99) - np.log10(1e-6)) * (i / 49))
        
        if p >= threshold:
            break
            
        p_values.append(p)
        
        # Binary search for the right n that gives target epsilon_L
        n_min = 10
        n_max = 1e10
        min_diff = float('inf')
        best_result = None
        
        for j in range(30):
            n = int((n_min + n_max) / 2)
            result = code['calculate_params'](p, n, k, epsilon_L)
            diff = abs(np.log10(result['epsilon_L']) - np.log10(epsilon_L))
            
            if diff < min_diff:
                min_diff = diff
                best_result = result
            
            if result['epsilon_L'] > epsilon_L:
                n_min = n
            else:
                n_max = n
                
            if n_min > 1e9:
                break
        
        if best_result and best_result['n'] > 1e9:
            # Remove the last p_value since we're breaking
            p_values.pop()
            break
             
        physical_qubits = best_result['n'] if best_result else n
        n_values.append(physical_qubits)
    
    return p_values, n_values, threshold

def create_plot():
    """Create and save the quantum error correction plot."""
    # Initialize code library
    code_lib = CodeLibrary()
    
    # Target logical error rate
    epsilon_L = 1e-6
    k = 1
    
    # Set up the plot
    plt.figure(figsize=(14, 10))
    plt.style.use('default')
    
    # Generate data for each code and plot
    codes_to_plot = ['surface', 'yoked_1d', 'yoked_2d', 'hypergraph', 'lifted', 'color']
    
    for code_name in codes_to_plot:
        try:
            p_values, n_values, threshold = generate_plot_data(code_lib, code_name, epsilon_L, k)
            
            if p_values and n_values:
                code = code_lib.codes[code_name]
                label = f"{code['name']}"
                plt.loglog(p_values, n_values, 
                          color=code['color'], 
                          linewidth=2, 
                          label=label,
                          marker='o',
                          markersize=3,
                          alpha=0.8)
                
                # Add vertical threshold line (only for unique thresholds)
                # Yoked surface codes share the same threshold as surface code
                if code_name not in ['yoked_1d', 'yoked_2d']:
                    plt.axvline(x=threshold, 
                               color=code['color'], 
                               linestyle='--', 
                               alpha=0.7,
                               linewidth=1)
        except Exception as e:
            print(f"Error generating data for {code_name}: {e}")
            continue
    
    # Customize the plot
    plt.xlabel('Physical Error Rate (p)', fontsize=14, fontweight='bold')
    plt.ylabel('Required Physical Qubits (n)', fontsize=14, fontweight='bold')
    plt.title(r'Quantum Error Correction: Required Physical Qubits vs Error Rate for $\epsilon_L = 10^{-6}$', 
              fontsize=16, fontweight='bold', pad=20)
      # Set grid
    plt.grid(True, which="both", ls="-", alpha=0.2)
    
    # Set axis limits
    plt.xlim(1e-6, 1e-1)
    plt.ylim(10, 1e10)
    
    # Add legend
    plt.legend(loc='upper right', fontsize=9, framealpha=0.9, ncol=1)
    
    # Ensure the images directory exists
    images_dir = Path(__file__).parent.parent / 'images'
    images_dir.mkdir(exist_ok=True)
    
    # Save the plot
    output_path = images_dir / 'quantum-error-correction-plot.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    
    print(f"Plot saved to: {output_path}")
    
    plt.close()

if __name__ == "__main__":
    create_plot() 