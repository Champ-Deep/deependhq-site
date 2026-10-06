// SVGO config for brand/mare-hero.svg: the default preset, minus the two
// plugins that would break it once it is inlined into the homepage. Ids stay
// readable (mh-fade, mh-mask) so they cannot collide with another inline SVG,
// and classes stay because home.css animates .mare, .smear and .blaze.
export default {
  multipass: true,
  plugins: [
    { name: 'preset-default', params: { overrides: { cleanupIds: false, mergePaths: false } } },
  ],
};
