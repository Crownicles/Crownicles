const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * The Firebase file names the project Android pushes go through. It stays out of the repository:
 * a build without it works the same, only without notifications while the app is closed.
 */
const GOOGLE_SERVICES_FILE = [
	process.env.GOOGLE_SERVICES_JSON,
	path.join(__dirname, "google-services.json"),
	path.join(os.homedir(), ".crownicles", "google-services.json")
].find(file => file && fs.existsSync(file));

module.exports = ({config}) => (GOOGLE_SERVICES_FILE
	? {...config, android: {...config.android, googleServicesFile: GOOGLE_SERVICES_FILE}}
	: config);
