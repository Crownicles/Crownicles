import "./bootstrap";
import { Crownicles } from "./core/bot/Crownicles";

/*
 * Default production instance. Tests may swap it out via
 * `setCrowniclesInstanceForTests` so they can plug a partial mock
 * (e.g. noop `logsDatabase`) without booting the real bot.
 */
export let crowniclesInstance: Crownicles = new Crownicles();

/**
 * Replace the singleton Crownicles instance. Tests only.
 * Pass `null` to restore the production instance.
 */
export function setCrowniclesInstanceForTests(instance: Crownicles | null): void {
	crowniclesInstance = instance ?? new Crownicles();
}
