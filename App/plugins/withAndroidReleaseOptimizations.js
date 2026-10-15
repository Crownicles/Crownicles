const { withGradleProperties } = require("expo/config-plugins");

// android/ est regenere a chaque prebuild : R8 et le retrait des ressources inutilisees
// s'activent ici, sinon le build release embarque le bytecode et les ressources non optimises.
const RELEASE_OPTIMIZATIONS = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true"
};

module.exports = function withAndroidReleaseOptimizations(config) {
  return withGradleProperties(config, gradleConfig => {
    for (const [key, value] of Object.entries(RELEASE_OPTIMIZATIONS)) {
      gradleConfig.modResults = gradleConfig.modResults.filter(item => item.type !== "property" || item.key !== key);
      gradleConfig.modResults.push({
        type: "property", key, value
      });
    }
    return gradleConfig;
  });
};
