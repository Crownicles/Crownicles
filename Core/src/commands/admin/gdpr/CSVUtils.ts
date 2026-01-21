/**
 * Utility functions for CSV generation in GDPR exports
 */

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
		const values = headers.map(header => {
			const value = row[header];
			if (value === null || value === undefined) {
				return "";
			}
			if (value instanceof Date) {
				return value.toISOString();
			}
			if (typeof value === "string") {
				// Sanitize against CSV injection attacks
				const sanitized = sanitizeCsvValue(value);

				// Escape quotes and wrap in quotes if needed
				if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
					return `"${sanitized.replace(/"/g, '""')}"`;
				}
				return sanitized;
			}
			return String(value);
		});
		csvRows.push(values.join(","));
	}

	return csvRows.join("\n");
}

/**
 * Type for CSV file collection used in GDPR export
 */
export type GDPRCsvFiles = Record<string, string>;
