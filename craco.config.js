module.exports = {
  style: {
    postcss: {
      mode: 'extends',
      loaderOptions: {
        postcssOptions: {
          ident: 'postcss',
          plugins: [
            'tailwindcss',
            'autoprefixer'
          ],
        },
      },
    },
  },
}
