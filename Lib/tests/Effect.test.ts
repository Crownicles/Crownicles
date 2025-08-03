import { Effect } from "../src/types/Effect";
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { CrowniclesIcons } from "../src/CrowniclesIcons";

const effects = Array.from(Effect.getAll());
const locales = ["fr"];

describe("Effect entries validation", () => {
  it("should have self and other entries for each effect in error.json for all locales", () => {
    for (const locale of locales) {
      const errorPath = path.resolve(import.meta.dirname, `../../Lang/${locale}/error.json`);
      const errorData = JSON.parse(fs.readFileSync(errorPath, "utf8"));
      const missing: string[] = [];
      for (const effect of effects) {
        // Skip effects that are not expected to have error entries
        if (effect.id === "none") continue;
        
        if (!errorData.effects[effect.id]) {
          missing.push(effect.id);
        } else {
          if (!('self' in errorData.effects[effect.id])) missing.push(effect.id + '.self');
          if (!('other' in errorData.effects[effect.id])) missing.push(effect.id + '.other');
        }
      }
      if (missing.length > 0) {
        throw new Error(`Effets manquants dans error.json (${locale}):\n` + missing.join(', '));
      }
    }
  });

  it("should have an entry for each effect in smallEvents.json interactOtherPlayers for all locales", () => {
    for (const locale of locales) {
      const sePath = path.resolve(import.meta.dirname, `../../Lang/${locale}/smallEvents.json`);
      if (!fs.existsSync(sePath)) continue;
      const seData = JSON.parse(fs.readFileSync(sePath, "utf8"));
      const missing: string[] = [];
      for (const effect of effects) {
        // Skip effects that are not expected to have interaction entries
        if (effect.id === "none" || effect.id === "notStarted" || effect.id === "dead" || effect.id === "fished") continue;
        
        if (!seData.interactOtherPlayers?.effect?.[effect.id]) {
          missing.push(effect.id);
        }
      }
      if (missing.length > 0) {
        throw new Error(`Effets manquants dans smallEvents.json interactOtherPlayers.effect (${locale}):\n` + missing.join(', '));
      }
    }
  });

  it("should have an icon entry for each effect in CrowniclesIcons.effects", () => {
    const missing: string[] = [];
    for (const effect of effects) {
      if (!CrowniclesIcons.effects[effect.id]) {
        missing.push(effect.id);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Effets manquants dans CrowniclesIcons.effects: \n` + missing.join(', '));
    }
  });
});
