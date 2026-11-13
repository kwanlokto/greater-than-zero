// The lifter's settings: the display unit, the default rest and the Macro
// targets. One row, which a migration inserts.

import { requireValidMacroTargets, type MacroTargets } from './food';
import { settings, type WeightUnit } from './schema';
import type { TrackerDatabase } from './tracker';

export function createSettings(db: TrackerDatabase) {
  async function getFallbackRestSeconds(): Promise<number> {
    const [row] = await db
      .select({ defaultRestSeconds: settings.defaultRestSeconds })
      .from(settings);
    return row.defaultRestSeconds;
  }

  async function getMacroTargets(): Promise<MacroTargets> {
    const [row] = await db
      .select({
        calories: settings.caloriesTarget,
        protein: settings.proteinTarget,
        carbs: settings.carbsTarget,
        fat: settings.fatTarget,
      })
      .from(settings);
    return row;
  }

  async function getDisplayUnit(): Promise<WeightUnit> {
    const [row] = await db.select({ displayUnit: settings.displayUnit }).from(settings);
    return row.displayUnit;
  }

  const commands = {
    getDisplayUnit,

    // The rest for Exercises without their own length.
    getFallbackRestSeconds,

    async setDisplayUnit(unit: WeightUnit): Promise<void> {
      await db.update(settings).set({ displayUnit: unit });
    },

    getMacroTargets,

    // Replaces all four; null leaves one unset. Enforces problemWithMacroTargets.
    async setMacroTargets(targets: MacroTargets): Promise<void> {
      const { calories, protein, carbs, fat } = requireValidMacroTargets(targets);
      await db.update(settings).set({
        caloriesTarget: calories,
        proteinTarget: protein,
        carbsTarget: carbs,
        fatTarget: fat,
      });
    },
  };

  return { commands, getDisplayUnit, getFallbackRestSeconds, getMacroTargets };
}
