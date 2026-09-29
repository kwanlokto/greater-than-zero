import type { Rotation } from '@/core/tracker';

// "Push → Pull → Legs", under a Rotation's name.
export function describeTurn({ entries }: Rotation): string {
  if (entries.length === 0) return 'No templates yet';
  return entries.map(({ template }) => template.name).join(' → ');
}
