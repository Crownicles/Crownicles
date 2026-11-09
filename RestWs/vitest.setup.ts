import { CrowniclesLogger } from "../Lib/src/logs/CrowniclesLogger";

// Translators register themselves at import time and log while doing so
CrowniclesLogger.init("error", ["console"], { service: "restws-tests" });
