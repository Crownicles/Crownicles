/**
 * Utility functions for CSV generation in GDPR exports
 */
import {
	Model, ModelStatic, WhereOptions
} from "sequelize";

/**
 * Characters that could trigger formula execution in spreadsheet applications
 * Prefixing with a single quote prevents formula interpretation
 */
const CSV_INJECTION_CHARS = [
	"=",
	"+",
	"-",
	"@",
	"\t",
	"\r"
];

/**
 * Sanitize a string value to prevent CSV injection attacks
 * Values starting with formula-like characters are prefixed with a single quote
 */
function sanitizeCsvValue(value: string): string {
	if (CSV_INJECTION_CHARS.some(char => value.startsWith(char))) {
		return `'${value}`;
	}
	return value;
}

/**
 * Check if a string value requires quoting in CSV format
 */
function requiresQuoting(value: string): boolean {
	return value.includes(",") || value.includes('"') || value.includes("\n");
}

/**
 * Format a single value for CSV output
 * Handles null, undefined, Date, string (with sanitization), and other types
 */
function formatValueToCsv(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string") {
		const sanitized = sanitizeCsvValue(value);
		if (requiresQuoting(sanitized)) {
			return `"${sanitized.replace(/"/g, '""')}"`;
		}
		return sanitized;
	}
	return String(value);
}

/**
 * Convert an array of objects to CSV format
 * @param data Array of objects to convert
 * @param columns Optional array of column names to include (defaults to all keys from first object)
 * @returns CSV formatted string
 */
export function toCSV(data: Record<string, unknown>[], columns?: string[]): string {
	if (data.length === 0) {
		return "";
	}

	const headers = columns ?? Object.keys(data[0]);
	const csvRows: string[] = [];

	// Header row
	csvRows.push(headers.join(","));

	// Data rows
	for (const row of data) {
		const values = headers.map(header => formatValueToCsv(row[header]));
		csvRows.push(values.join(","));
	}

	return csvRows.join("\n");
}

/**
 * Type for CSV file collection used in GDPR export
 */
export type GDPRCsvFiles = Record<string, string>;

/**
 * Default batch size for paginated database queries
 * Balances between number of queries and memory usage
 */
const BATCH_SIZE = 5000;

/**
 * Yield control back to the event loop
 * This prevents blocking the main thread during heavy operations
 */
export function yieldToEventLoop(): Promise<void> {
	return new Promise(resolve => setImmediate(resolve));
}

/**
 * Fetch data from a Sequelize model with pagination to avoid loading millions of rows at once
 * Yields to the event loop between batches to prevent blocking
 *
 * @param model The Sequelize model to query
 * @param where The where clause for the query
 * @param transform Function to transform each row to the desired format
 * @returns Array of transformed data
 */
export async function fetchWithPagination<T extends Model, R>(
	model: ModelStatic<T>,
	where: WhereOptions<T>,
	transform: (row: T) => R
): Promise<R[]> {
	const allData: R[] = [];
	let offset = 0;
	let hasMoreData = true;

	while (hasMoreData) {
		const batch = await model.findAll({
			where,
			limit: BATCH_SIZE,
			offset
		});

		if (batch.length === 0) {
			hasMoreData = false;
		}
		else {
			allData.push(...batch.map(transform));
			offset += BATCH_SIZE;

			// Yield to event loop after each batch to prevent blocking
			await yieldToEventLoop();
		}
	}

	return allData;
}

/**
 * Convert a data record to a CSV row string using the provided headers
 */
function recordToCsvRow(data: Record<string, unknown>, headers: string[]): string {
	const values = headers.map(header => formatValueToCsv(data[header]));
	return values.join(",");
}

/**
 * Context for CSV batch processing
 */
interface CSVBatchContext<T extends Model> {
	batch: T[];
	transform: (row: T) => Record<string, unknown>;
	csvRows: string[];
	headers: string[] | null;
	columns?: string[];
}

/**
 * Process a batch of model rows and add them to CSV rows
 * Extracts the nested logic from streamToCSV to reduce complexity
 */
function processBatchToCSV<T extends Model>(context: CSVBatchContext<T>): string[] {
	let currentHeaders = context.headers;

	for (const row of context.batch) {
		const data = context.transform(row);

		// Set headers from first row
		if (!currentHeaders) {
			currentHeaders = context.columns ?? Object.keys(data);
			context.csvRows.push(currentHeaders.join(","));
		}

		context.csvRows.push(recordToCsvRow(data, currentHeaders));
	}

	return currentHeaders ?? [];
}

/**
 * Stream data to CSV format with pagination
 * Instead of loading all data in memory, this processes data in batches
 * and builds the CSV string incrementally
 *
 * @param model The Sequelize model to query
 * @param where The where clause for the query
 * @param transform Function to transform each row to a record for CSV
 * @param columns Optional column names for the CSV header
 * @returns CSV formatted string
 */
export async function streamToCSV<T extends Model>(
	model: ModelStatic<T>,
	where: WhereOptions<T>,
	transform: (row: T) => Record<string, unknown>,
	columns?: string[]
): Promise<string> {
	const csvRows: string[] = [];
	let headers: string[] | null = null;
	let offset = 0;
	let hasMoreData = true;

	while (hasMoreData) {
		const batch = await model.findAll({
			where,
			limit: BATCH_SIZE,
			offset
		});

		if (batch.length === 0) {
			hasMoreData = false;
			continue;
		}

		headers = processBatchToCSV({
			batch, transform, csvRows, headers, columns
		});
		offset += BATCH_SIZE;

		// Yield to event loop after each batch
		await yieldToEventLoop();
	}

	return csvRows.join("\n");
}
