// Categories: the kinds of Workout the lifter names, such as Push. A Workout
// is in one or none, a repeat stays in the one its source was in, and
// Rotations put them in order.

import { and, eq, ne, sql } from 'drizzle-orm';

import { notDeleted, softDelete, stillThere } from './records';
import { categories, workouts } from './schema';
import type { TrackerDatabase } from './tracker';

export type Category = {
  id: string;
  name: string;
};

// The Category to put a Workout in: one there already, one by its name (made
// if there's none called that yet), or null for none.
export type CategoryChoice = { id: string } | { name: string } | null;

const categoryColumns = { id: categories.id, name: categories.name };

function requireCategoryName(typed: string): string {
  const name = typed.trim();
  if (!name) throw new Error('A Category needs a name');
  return name;
}

// The Category with this name, whatever its capitals: "push" is "Push".
function called(name: string) {
  return and(sql`${categories.name} = ${name} COLLATE NOCASE`, notDeleted(categories));
}

export type Categories = ReturnType<typeof createCategories>;

export function createCategories({ db, now }: { db: TrackerDatabase; now: () => Date }) {
  // Synchronous, like the two below, so they can run inside a transaction.
  function requireCategory(tx: TrackerDatabase, id: string): Category {
    const category = tx
      .select(categoryColumns)
      .from(categories)
      .where(stillThere(categories, id))
      .get();
    if (!category) throw new Error('No such Category');
    return category;
  }

  // A new Category. Names are unique, so one in use is refused.
  function create(tx: TrackerDatabase, typed: string): Category {
    const name = requireCategoryName(typed);
    const taken = tx.select(categoryColumns).from(categories).where(called(name)).get();
    if (taken) throw new Error(`There's already a Category called ${taken.name}`);
    return tx.insert(categories).values({ name }).returning(categoryColumns).get();
  }

  // The Category called `typed`, made if there's none yet.
  function findOrCreate(tx: TrackerDatabase, typed: string): Category {
    const name = requireCategoryName(typed);
    const existing = tx.select(categoryColumns).from(categories).where(called(name)).get();
    return existing ?? tx.insert(categories).values({ name }).returning(categoryColumns).get();
  }

  const commands = {
    // Every Category, by name.
    getCategories(): Promise<Category[]> {
      return db
        .select(categoryColumns)
        .from(categories)
        .where(notDeleted(categories))
        .orderBy(sql`${categories.name} COLLATE NOCASE`);
    },

    // A Category with no Workouts in it yet.
    async createCategory(name: string): Promise<Category> {
      return db.transaction(tx => create(tx, name));
    },

    // Renames it everywhere it shows: its Workouts and Rotations go by it.
    async renameCategory(id: string, name: string): Promise<void> {
      const wanted = requireCategoryName(name);
      db.transaction(tx => {
        const taken = tx
          .select(categoryColumns)
          .from(categories)
          .where(and(called(wanted), ne(categories.id, id)))
          .get();
        if (taken) throw new Error(`There's already a Category called ${taken.name}`);
        const renamed = tx
          .update(categories)
          .set({ name: wanted })
          .where(stillThere(categories, id))
          .returning({ id: categories.id })
          .all();
        if (renamed.length === 0) throw new Error('No such Category');
      });
    },

    // Its Workouts stay in History, in no Category, and it leaves every
    // Rotation.
    async deleteCategory(id: string): Promise<void> {
      db.transaction(tx => {
        const deleted = softDelete(tx, categories, eq(categories.id, id), now());
        if (deleted.length === 0) throw new Error('No such Category');
        tx.update(workouts).set({ categoryId: null }).where(eq(workouts.categoryId, id)).run();
      });
    },

    // Puts a Workout, in progress or finished, in a Category, or in none.
    async setWorkoutCategory(workoutId: string, choice: CategoryChoice): Promise<void> {
      // Found or made together with the change, so a failure leaves no
      // Category behind.
      db.transaction(tx => {
        let categoryId: string | null = null;
        if (choice !== null) {
          const category =
            'id' in choice ? requireCategory(tx, choice.id) : findOrCreate(tx, choice.name);
          categoryId = category.id;
        }
        const changed = tx
          .update(workouts)
          .set({ categoryId })
          .where(stillThere(workouts, workoutId))
          .returning({ id: workouts.id })
          .all();
        if (changed.length === 0) throw new Error('No such Workout');
      });
    },
  };

  return { commands, requireCategory, findOrCreate };
}
