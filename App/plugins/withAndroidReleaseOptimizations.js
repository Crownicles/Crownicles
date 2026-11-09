const { withGradleProperties } = require("expo/config-plugins");

// android/ est regenere a chaque prebuild : le modele active deja R8 depuis le SDK 58, mais pas le
// retrait des ressources inutilisees, sans lequel le build release les embarque toutes.
const RELEASE_OPTIMIZATIONS = {
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
