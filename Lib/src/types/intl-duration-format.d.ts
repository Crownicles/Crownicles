/**
 * Type declarations for Intl.DurationFormat (ES2024)
 * Node.js 22.8+ / Chrome 129+ support
 */

declare namespace Intl {
	interface DurationInput {
		years?: number;
		months?: number;
		weeks?: number;
		days?: number;
		hours?: number;
		minutes?: number;
		seconds?: number;
		milliseconds?: number;
		microseconds?: number;
		nanoseconds?: number;
	}

	interface DurationFormatOptions {
		localeMatcher?: "best fit" | "lookup";
		style?: "long" | "short" | "narrow" | "digital";
		years?: "long" | "short" | "narrow";
		yearsDisplay?: "always" | "auto";
		months?: "long" | "short" | "narrow";
		monthsDisplay?: "always" | "auto";
		weeks?: "long" | "short" | "narrow";
		weeksDisplay?: "always" | "auto";
		days?: "long" | "short" | "narrow";
		daysDisplay?: "always" | "auto";
		hours?: "long" | "short" | "narrow" | "numeric" | "2-digit";
		hoursDisplay?: "always" | "auto";
		minutes?: "long" | "short" | "narrow" | "numeric" | "2-digit";
		minutesDisplay?: "always" | "auto";
		seconds?: "long" | "short" | "narrow" | "numeric" | "2-digit";
		secondsDisplay?: "always" | "auto";
		milliseconds?: "long" | "short" | "narrow" | "numeric";
		millisecondsDisplay?: "always" | "auto";
		microseconds?: "long" | "short" | "narrow" | "numeric";
		microsecondsDisplay?: "always" | "auto";
		nanoseconds?: "long" | "short" | "narrow" | "numeric";
		nanosecondsDisplay?: "always" | "auto";
		fractionalDigits?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
	}

	interface DurationFormatPart {
		type: "literal" | "integer" | "unit";
		value: string;
		unit?: "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds" | "milliseconds" | "microseconds" | "nanoseconds";
	}

	class DurationFormat {
		constructor(locales?: string | string[], options?: DurationFormatOptions);
		format(duration: DurationInput): string;
		formatToParts(duration: DurationInput): DurationFormatPart[];
		resolvedOptions(): DurationFormatOptions & {
			locale: string;
			numberingSystem: string;
		};
		static supportedLocalesOf(locales: string | string[], options?: { localeMatcher?: "best fit" | "lookup" }): string[];
	}
}
