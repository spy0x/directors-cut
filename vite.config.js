export default {
  base: './', // relative paths so the build can be dropped straight onto itch.io
  server: { watch: { ignored: ['**/*.zip', '**/dist/**'] } }, // zipping the project must not crash the dev server
};
