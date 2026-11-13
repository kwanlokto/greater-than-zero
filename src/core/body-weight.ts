// The lifter's body weight: one Weigh-in a day, and its trend.

import { and, asc, eq, type SQL } from 'drizzle-orm';

import { localDateOf } from './local-dates';
import { notDeleted } from './records';
import { weighIns, type WeightUnit } from './schema';
import type { TrackerDatabase } from './tracker';
import { convertWeight, displayedWeight, roundedForDisplay, type Weight } from './weights';

// The lifter's body weight: one Weigh-in a day, and its trend.

// The lifter's body weight on a day.
export type WeighIn = {
  // The phone's local calendar date it's for, as YYYY-MM-DD.
  localDate: string;
  // As entered, in weightUnit.
  weight: number;
  weightUnit: WeightUnit;
  // What to show: in the display unit, to one decimal place.
  displayWeight: Weight;
  // When it was entered, or last replaced.
  weighedAt: Date;
};

// Why a Weigh-in can't be recorded with this weight, or undefined when it can.
// setWeighIn enforces it; screens use it to decide when to allow saving.
export function problemWithWeighIn(weight: number): string | undefined {
  if (Number.isFinite(weight) && weight > 0) return undefined;
  return 'A Weigh-in needs a weight above 0';
}

// A Weigh-in on the body-weight trend.
export type BodyWeightPoint = {
  // Its local date, as YYYY-MM-DD.
  localDate: string;
  // In the display unit, at full precision, for plotting.
  value: number;
  // What to show: to one decimal place, like the Weigh-in itself.
  displayValue: number;
};

// Every Weigh-in by date, in the display unit.
export type BodyWeightTrend = {
  unit: WeightUnit;
  points: BodyWeightPoint[];
};

type BodyWeightDependencies = {
  db: TrackerDatabase;
  now: () => Date;
  getDisplayUnit: () => Promise<WeightUnit>;
};

export function createBodyWeight({ db, now, getDisplayUnit }: BodyWeightDependencies) {
  // The Weigh-ins matching `where`, by date. Deleted ones are left out.
  async function findWeighIns(where: SQL | undefined): Promise<WeighIn[]> {
    const found = await db
      .select({
        localDate: weighIns.localDate,
        weight: weighIns.weight,
        weightUnit: weighIns.weightUnit,
        weighedAt: weighIns.weighedAt,
      })
      .from(weighIns)
      .where(and(where, notDeleted(weighIns)))
      .orderBy(asc(weighIns.localDate));
    const displayUnit = await getDisplayUnit();
    return found.map(row => ({
      ...row,
      displayWeight: displayedWeight(row.weight, row.weightUnit, displayUnit),
    }));
  }

  // The Weigh-in for a local date, as YYYY-MM-DD; null when there's none.
  async function getWeighIn(localDate: string): Promise<WeighIn | null> {
    const [weighIn] = await findWeighIns(eq(weighIns.localDate, localDate));
    return weighIn ?? null;
  }

  const commands = {
    // Records today's Weigh-in in `weightUnit`, the unit the lifter sees while
    // typing it, replacing one already entered today. Enforces
    // problemWithWeighIn.
    async setWeighIn(weight: number, weightUnit: WeightUnit): Promise<void> {
      const problem = problemWithWeighIn(weight);
      if (problem) throw new Error(problem);
      const weighedAt = now();
      const entered = { weighedAt, weight, weightUnit };
      await db
        .insert(weighIns)
        .values({ localDate: localDateOf(weighedAt), ...entered })
        .onConflictDoUpdate({
          target: weighIns.localDate,
          // One deleted that day (only a Backup file can hold one) comes back.
          set: { ...entered, deletedAt: null },
        });
    },

    getWeighIn,

    // Every Weigh-in, by date, each converted from the unit it was entered in
    // to the display unit at full precision.
    async getBodyWeightTrend(): Promise<BodyWeightTrend> {
      const entered = await findWeighIns(undefined);
      const unit = await getDisplayUnit();
      const points = entered.map(({ localDate, weight, weightUnit }) => {
        const value = convertWeight(weight, weightUnit, unit);
        return { localDate, value, displayValue: roundedForDisplay(value) };
      });
      return { unit, points };
    },
  };

  return { commands, getWeighIn };
}
