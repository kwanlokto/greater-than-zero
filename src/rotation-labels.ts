import type { Rotation } from '@/core/tracker';

// "Push → Pull → Legs", under a Rotation's name.
export function describeCategoryOrder({ entries }: Rotation): string {
  if (entries.length === 0) return 'No categories yet';
  return entries.map(({ category }) => category.name).join(' → ');
}
