const { withDangerousMod, withPodfileProperties } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FMT_PATCH = `
    # fmt 11.0.2 (pinned by React Native 0.81) uses consteval in a way Xcode 26's clang rejects.
    # Building only that pod as C++17 disables fmt's consteval path; its public API is unaffected.
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'

      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

const ANCHOR = "  post_install do |installer|\n";

function withFmtCxxStandard(config) {
	return withDangerousMod(config, [
		"ios",
		(modConfig) => {
			const podfile = path.join(modConfig.modRequest.platformProjectRoot, "Podfile");
			const contents = fs.readFileSync(podfile, "utf8");

			if (contents.includes("target.name == 'fmt'")) {
				return modConfig;
			}

			if (!contents.includes(ANCHOR)) {
				throw new Error("Cannot patch the Podfile: its post_install block was not found.");
			}

			fs.writeFileSync(podfile, contents.replace(ANCHOR, ANCHOR + FMT_PATCH));
			return modConfig;
		}
	]);
}

function withCcache(config) {
	return withPodfileProperties(config, (modConfig) => {
		modConfig.modResults["apple.ccacheEnabled"] = "true";
		return modConfig;
	});
}

// Keeps the hand written parts of the iOS project reproducible, now that it is generated on demand.
module.exports = (config) => withCcache(withFmtCxxStandard(config));
