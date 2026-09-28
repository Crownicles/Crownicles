import fastify, {
	FastifyInstance, FastifyRequest
} from "fastify";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { setupAssetsRoutes } from "./routes/AssetsRoute";
import { setupAccountDeletionRoutes } from "./routes/AccountDeletionRoute";
import { setupAppCompatibilityRoutes } from "./routes/AppCompatibilityRoute";
import { AccountDeletionConfig } from "../config/RestWsConfig";

/**
 * Returns the metadata for logging requests.
 * @param req
 */
export function getRequestLoggerMetadata(req: FastifyRequest): {
	req: {
		remoteAddress: string;
		method: string;
		url: string;
		headers: NodeJS.Dict<string | string[]>;
		query?: unknown;
	};
} {
	return {
		req: {
			remoteAddress: req.ip,
			method: req.method,
			url: req.url,
			headers: req.headers,
			query: req.query
		}
	};
}

/**
 * RestApi server class.
 */
export class RestApi {
	/**
	 * Fastify instance for the server.
	 */
	private readonly server: FastifyInstance;

	/**
	 * Debug mode for the server.
	 */
	private readonly debugMode: boolean;

	/**
	 * How deletion requests are authenticated and notified.
	 */
	private readonly accountDeletion: AccountDeletionConfig;

	/**
	 * Constructor for the RestApi class.
	 * @param options
	 */
	constructor(options: {
		debugMode: boolean;
		accountDeletion: AccountDeletionConfig;
	}) {
		this.server = fastify();
		this.debugMode = options.debugMode;
		this.accountDeletion = options.accountDeletion;
	}

	/**
	 * Sets up the routes for the API.
	 */
	private async setupRoutes(): Promise<void> {
		this.server.setNotFoundHandler((request, reply) => {
			CrowniclesLogger.warn("Not found request", {
				...getRequestLoggerMetadata(request)
			});
			reply.status(404).send({ error: "Not Found" });
		});

		setupAppCompatibilityRoutes(this.server);
		setupAccountDeletionRoutes(this.server, this.accountDeletion);
		await setupAssetsRoutes(this.server, this.debugMode);
	}

	/**
	 * Starts the server on the specified port.
	 * @param port
	 */
	public async start(port: number): Promise<void> {
		await this.setupRoutes();

		this.server.listen({
			port, host: "0.0.0.0"
		}, (err, address) => {
			if (err) {
				CrowniclesLogger.errorWithObj("Failed to start Rest API", err);
				process.exit(1);
			}
			CrowniclesLogger.info("Rest API is running", {
				address
			});
		});
	}
}
