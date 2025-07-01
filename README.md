# Quantum Error Correction Resource Estimator

An interactive web tool for estimating quantum computing resource requirements with different error correction codes. This tool helps researchers and engineers understand the physical qubit requirements for fault-tolerant quantum computation across different regimes.

## Features

- **Multiple Error Correction Codes:**
  - Surface Code
  - Hypergraph Product Code
  - Lifted Product Code

- **Interactive Calculator:**
  - Adjustable parameters for physical error rate (p)
  - Target logical error rate (ε_L)
  - Number of physical and logical qubits
  - Real-time calculation of code distance and resource requirements

- **Comprehensive Visualization:**
  - Interactive plot showing required physical qubits vs error rate
  - Logarithmic scales for better visualization of wide parameter ranges
  - Tooltips for detailed information

- **Quantum Computing Regimes:**
  - KiloQuop (ε_L = 10^-3)
  - MegaQuop (ε_L = 10^-6)
  - GigaQuop (ε_L = 10^-9)
  - TeraQuop (ε_L = 10^-12)
  - PetaQuop (ε_L = 10^-15)

## Formulas and References

### Surface Code
- LFR(surface) = 0.03k(p/0.011)^⌈⌊√(n/k)⌋/2⌉
- Threshold ≈ 1.1%
- Reference: [Surface code quantum communication (Fowler et al., 2010)](https://arxiv.org/abs/0910.4074)

### Hypergraph Product Code
- LFR(HGP) = 0.07(p/0.006)^(0.47n^0.27)
- Threshold ≈ 0.6%

### Lifted Product Code
- LFR(LP) = 2.3(p/0.0066)^(0.11n^0.60)
- Threshold ≈ 0.66%

Reference for HGP and LP codes: [Constant-Overhead Fault-Tolerant Quantum Computation with Reconfigurable Atom Arrays (Xu et al., 2023)](https://arxiv.org/abs/2308.08648v1)

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/francois-marie/quantum-resource-estimator.git
cd quantum-resource-estimator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Deployment

The application is deployed using GitHub Pages. To deploy updates:

```bash
npm run deploy
```

Visit the live version at: [https://francois-marie.github.io/quantum-resource-estimator](https://francois-marie.github.io/quantum-resource-estimator)

## Contributing

This is a work in progress. If you find bugs or have suggestions for improvements, please:

1. Check existing issues or create a new one
2. Fork the repository
3. Create a new branch for your feature
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by discussions in [Quantum Computing Report](https://quantumcomputingreport.com/nisq-versus-ftqc-in-the-2025-2029-timeframe/)
- Built with React and Chart.js
- Styling with Tailwind CSS

## Author

François-Marie Le Régent

## Status

🚧 This project is under active development. Features and calculations are being refined and verified. Please create issues on GitHub if you find any bugs or have suggestions for improvements.
