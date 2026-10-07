const { withAppBuildGradle } = require("expo/config-plugins");

// Les identifiants vivent dans ~/.gradle/gradle.properties, jamais dans le depot :
// android/ est efface et regenere a chaque `expo prebuild --clean`.
const SIGNING_CONFIG = `        release {
            if (project.hasProperty('CROWNICLES_UPLOAD_STORE_FILE')) {
                storeFile file(CROWNICLES_UPLOAD_STORE_FILE)
                storePassword CROWNICLES_UPLOAD_STORE_PASSWORD
                keyAlias CROWNICLES_UPLOAD_KEY_ALIAS
                keyPassword CROWNICLES_UPLOAD_KEY_PASSWORD
            }
        }
`;

// Retombe sur la cle de debug quand les proprietes sont absentes, pour ne pas casser
// les machines qui n'ont pas la keystore.
const RELEASE_SIGNING = "signingConfig project.hasProperty('CROWNICLES_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

const DEBUG_SIGNING_ANCHOR = `// see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const DEBUG_CONFIG_END = `keyPassword 'android'
        }
`;

function applyReleaseSigning(contents) {
  if (contents.includes("CROWNICLES_UPLOAD_STORE_FILE")) {
    return contents;
  }

  if (!contents.includes(DEBUG_SIGNING_ANCHOR) || !contents.includes(DEBUG_CONFIG_END)) {
    throw new Error(
      "withAndroidReleaseSigning: build.gradle ne correspond plus au modele attendu, le plugin doit etre mis a jour"
    );
  }

  return contents
    .replace(DEBUG_CONFIG_END, `${DEBUG_CONFIG_END}${SIGNING_CONFIG}`)
    .replace(
      DEBUG_SIGNING_ANCHOR,
      `// see https://reactnative.dev/docs/signed-apk-android.\n            ${RELEASE_SIGNING}`
    );
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, androidConfig => {
    androidConfig.modResults.contents = applyReleaseSigning(androidConfig.modResults.contents);
    return androidConfig;
  });
};
