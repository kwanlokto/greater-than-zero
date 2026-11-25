# User flows

Every screen in Notch has an ID, `S01` to `S40`, and every dialog one from `D01` to `D22`. Use them to name a screen in an issue, a PR or a conversation: "S12's › button" says exactly where.

IDs are permanent. A new screen or dialog takes the next free number, and a removed one's ID is retired, never reused: the retired ones are listed under each table. When a change adds, removes or reconnects a screen or dialog, update this file in the same change.

## Screens

| ID | Screen | Route | File |
|---|---|---|---|
| S01 | Splash | (launch) | `src/app/_layout.tsx` |
| S02 | Onboarding: weight unit | `/onboarding`, step 1 | `src/app/onboarding.tsx` |
| S03 | Onboarding: daily targets | `/onboarding`, step 2 | `src/app/onboarding.tsx` |
| S04 | Migration failed | (launch) | `src/app/_layout.tsx` |
| S05 | Today tab | `/` | `src/app/(tabs)/index.tsx` |
| S06 | History tab | `/history` | `src/app/(tabs)/history.tsx` |
| S07 | Food tab | `/food` | `src/app/(tabs)/food.tsx` |
| S08 | Progress tab | `/progress` | `src/app/(tabs)/progress.tsx` |
| S09 | Workout in progress | `/workout` | `src/app/workout/index.tsx` |
| S10 | Choose exercise: add to or swap in a Workout | `/workout/choose-exercise` | `src/app/workout/choose-exercise.tsx` |
| S11 | Past Workout | `/workout/[id]` | `src/app/workout/[id].tsx` |
| S12 | Day | `/day/[date]` | `src/app/day/[date].tsx` |
| S13 | Meal | `/meals/[id]` | `src/app/meals/[id].tsx` |
| S14 | Add food: choose how | `/meals/choose-food` | `src/app/meals/choose-food.tsx` |
| S15 | Food item: add a one-off, or edit | `/meals/food-item` | `src/app/meals/food-item.tsx` |
| S16 | Portion of a Saved food | `/meals/portion` | `src/app/meals/portion.tsx` |
| S17 | Copy a past Meal | `/meals/choose-past-meal` | `src/app/meals/choose-past-meal.tsx` |
| S18 | Saved foods | `/saved-foods` | `src/app/saved-foods/index.tsx` |
| S19 | New Saved food | `/saved-foods/new` | `src/app/saved-foods/new.tsx` |
| S20 | Saved food | `/saved-foods/[id]` | `src/app/saved-foods/[id].tsx` |
| S21 | All exercises with progress | `/progress/all` | `src/app/progress/all.tsx` |
| S22 | Exercise progress chart | `/progress/[exerciseId]` | `src/app/progress/[exerciseId].tsx` |
| S23 | Weigh-ins | `/weigh-ins` | `src/app/weigh-ins.tsx` |
| S24 | Settings | `/settings` | `src/app/settings.tsx` |
| S25 | Macro targets | `/macro-targets` | `src/app/macro-targets.tsx` |
| S31 | Rotations | `/rotations` | `src/app/rotations/index.tsx` |
| S32 | New Rotation | `/rotations/new` | `src/app/rotations/new.tsx` |
| S33 | Rotation | `/rotations/[id]` | `src/app/rotations/[id].tsx` |
| S34 | Choose Category for a Rotation | `/rotations/choose-category` | `src/app/rotations/choose-category.tsx` |
| S35 | Exercise library | `/exercises` | `src/app/exercises/index.tsx` |
| S36 | New exercise | `/exercises/new` | `src/app/exercises/new.tsx` |
| S37 | Edit exercise | `/exercises/[id]` | `src/app/exercises/[id].tsx` |
| S38 | Repeat a workout | `/workout/repeat` | `src/app/workout/repeat.tsx` |
| S39 | Categories | `/categories` | `src/app/categories/index.tsx` |
| S40 | Choose Category for a Workout | `/workout/category` | `src/app/workout/category.tsx` |

Retired with Templates: S26 Templates, S27 New Template or Save as template, S28 Template, S29 Choose exercise for a Template, S30 Target.

A screen opened for a record that's gone (a deleted Meal, Rotation or Workout) shows that instead of its content, and S12 shows "No such date." for a date that isn't real. These are states of the screen, not screens of their own.

## Dialogs

| ID | Dialog | Shown on | Choices |
|---|---|---|---|
| D01 | Finish workout? | S09, Finish workout | Finish: the Workout finishes and closes, back to the screen underneath. Cancel: stays. |
| D02 | No sets logged yet | S09, Finish workout with nothing logged | Discard: the Workout is discarded, back. Keep going: stays. |
| D05 | Discard this workout? | S09, Discard workout | Discard: back. Keep it: stays. |
| D06 | Exercise actions (bottom sheet) | S09, S11: an Exercise's ⋯ | Swap exercise (before any Set is logged): S10. Remove exercise: D07, or removed at once with no Sets. |
| D07 | Remove *Exercise* and its *n* sets? | D06, Remove exercise | Remove or Cancel; stays. |
| D08 | Delete this workout? | S11, Delete workout | Delete: back. |
| D09 | Delete *Meal*? | S13, Delete meal | Delete: back. |
| D10 | Remove *food*? | S15, Remove food | Remove: back to S13. |
| D11 | Delete *Saved food*? | S20, Delete | Delete: back. |
| D14 | Delete *Rotation*? | S33, Delete rotation | Delete: back. |
| D15 | Remove *Category* from *Rotation*? | S33, a Category's 🗑 | Remove; stays. |
| D16 | Hide *Exercise*? | S37, Hide exercise | Hide: back. |
| D17 | Replace all your data? | S24, Import, after a file is picked | Replace: the Backup replaces everything. |
| D18 | Notification permission (Android) | the first time a Workout starts | Allow or Don't allow; the in-app rest timer works either way. |
| D19 | Share sheet (Android) | S24, Export | Save or send the Backup file. |
| D20 | File picker (Android) | S24, Import | Pick a Backup file: D17. |
| D21 | Time picker (Android) | S13, Eaten at | Moves the Meal within its day. |
| D22 | Delete *Category*? | S39, a Category's 🗑 | Delete: its Workouts stay in History, in no Category; stays. |

Retired with Templates: D03 Update Template?, D04 Raise the target?, D12 Delete Template?, D13 Remove from Template?

Any command can be refused. A "Couldn't …" alert then says why, and the screen stays as it was.

## How the screens connect

Each diagram covers one area. A screen from another area appears with its ID, and its own diagram carries on from there. "back" returns to the screen underneath.

### Launch and the tabs

```mermaid
flowchart LR
  S01["S01 Splash"] -->|first launch| S02["S02 Onboarding: weight unit"]
  S01 -->|the database can't be updated| S04["S04 Migration failed"]
  S01 -->|onboarded| S05
  S01 -->|a Workout was left in progress| S09["S09 Workout in progress"]
  S02 -->|pick lb or kg| S03["S03 Onboarding: daily targets"]
  S03 -->|Save targets, or Skip for now| S05
  subgraph tabs["The tabs: the tab bar moves between them"]
    S05["S05 Today"]
    S06["S06 History"]
    S07["S07 Food"]
    S08["S08 Progress"]
  end
  tabs -->|the Settings button, top right| S24["S24 Settings"]
  tabs -->|the Workout bar, while one is in progress| S09
```

Tapping the "Rest over" notification brings the app back where it was. If the app had been closed, it opens on S09.

### Today

```mermaid
flowchart LR
  S05["S05 Today"] -->|Start next up, or Empty workout| S09["S09 Workout in progress"]
  S05 -->|Repeat a workout| S38["S38 Repeat a workout"]
  S38 -->|tap a Workout| S09
  S05 -->|Set up a rotation, with none active| S31["S31 Rotations"]
  S05 -->|Meals, or the food card| S07["S07 Food"]
  S05 -->|Set daily targets, when none are set| S25["S25 Macro targets"]
  S05 -->|All weigh-ins| S23["S23 Weigh-ins"]
```

Today's Weigh-in is entered on S05 itself.

### Working out

```mermaid
flowchart LR
  S09["S09 Workout in progress"] -->|Add exercise| S10["S10 Choose exercise"]
  S09 -->|an Exercise's name, before any Set| S10
  S09 -->|an Exercise's ⋯| D06{{"D06 Exercise actions"}}
  D06 -->|Swap exercise| S10
  D06 -->|Remove exercise, with Sets| D07{{"D07 Remove and its sets?"}}
  S10 -->|pick an Exercise| S09
  S09 -->|its title| S40["S40 Choose Category"]
  S40 -->|pick one, add one, or No category| S09
  S09 -->|Finish workout| D01{{"D01 Finish workout?"}}
  S09 -->|Finish workout, nothing logged| D02{{"D02 No sets logged yet"}}
  S09 -->|Discard workout| D05{{"D05 Discard this workout?"}}
  D01 -->|Finish: the Workout closes| back(["back"])
  D02 -->|Discard| back
  D05 -->|Discard| back
  S09 -->|⌄ hide| back
  S09 -.->|the first time a Workout starts| D18{{"D18 Notification permission"}}
```

S09 opens from S01, S05, S11, S12, S38 and the Workout bar on any tab, and "back" returns there, or to S05 after S38, whose place the Workout takes. The dotted line is a question that comes up on its own. Nothing is asked after a Workout finishes.

### History

```mermaid
flowchart TD
  S06["S06 History"] -->|tap a day| S12["S12 Day"]
  S12 -->|‹ or ›: the day before or after| S12
  S12 -->|tap a Workout| S11["S11 Past Workout"]
  S12 -->|tap a Meal| S13["S13 Meal"]
  S12 -->|Add workout, on a past day| S09["S09 Workout in progress"]
  S12 -->|Go to the workout in progress| S09
  S11 -->|Add exercise| S10["S10 Choose exercise"]
  S11 -->|an Exercise's name, before any Set| S10
  S11 -->|an Exercise's ⋯| D06{{"D06 Exercise actions"}}
  D06 -->|Swap exercise| S10
  S10 -->|pick an Exercise| S11
  S11 -->|Repeat this workout| S09
  S11 -->|its title| S40["S40 Choose Category"]
  S40 -->|pick one, add one, or No category| S11
  S11 -->|Delete workout| D08{{"D08 Delete this workout?"}}
  D08 -->|Delete| S12
```

### Meals

```mermaid
flowchart TD
  S07["S07 Food"] -->|Add meal: creates one| S13["S13 Meal"]
  S07 -->|tap a Meal| S13
  S07 -->|Copy a meal| S17["S17 Copy a past Meal"]
  S17 -->|pick a Meal: copied into today| S07
  S13 -->|Add food| S14["S14 Add food"]
  S13 -->|tap a food| S15["S15 Food item"]
  S13 -->|Copy to today: opens the copy| S13
  S13 -->|Eaten at| D21{{"D21 Time picker"}}
  S13 -->|Delete meal| D09{{"D09 Delete Meal?"}}
  D09 -->|Delete| back(["back"])
  S14 -->|One-off food| S15
  S14 -->|pick a Saved food| S16["S16 Portion"]
  S14 -->|New saved food| S19["S19 New Saved food"]
  S19 -->|Save food| S16
  S16 -->|Add to meal| S13
  S15 -->|Save, or Add food| S13
  S15 -->|Remove food| D10{{"D10 Remove food?"}}
  D10 -->|Remove| S13
```

S14 gives way to the screen picked from it, so S15, S16 and S19 return straight to S13. A deleted Meal goes back to where it was opened: S07 or S12.

### Saved foods

```mermaid
flowchart LR
  S07["S07 Food"] -->|Saved foods| S18["S18 Saved foods"]
  S24["S24 Settings"] -->|Saved foods| S18
  S18 -->|New saved food| S19["S19 New Saved food"]
  S19 -->|Save food| S18
  S18 -->|tap a food| S20["S20 Saved food"]
  S20 -->|Save| S18
  S20 -->|Delete| D11{{"D11 Delete Saved food?"}}
  D11 -->|Delete| S18
```

S19 opened from S14, while adding to a Meal, goes on to S16 for the amount instead of back to S18.

### Progress

```mermaid
flowchart LR
  S08["S08 Progress"] -->|tap an Exercise| S22["S22 Exercise progress"]
  S08 -->|All n, beside the exercises| S21["S21 All exercises"]
  S21 -->|tap an Exercise| S22
  S08 -->|All weigh-ins| S23["S23 Weigh-ins"]
  S08 -->|Go to Today, before any Workout| S05["S05 Today"]
```

### Settings and the Exercise library

```mermaid
flowchart LR
  S24["S24 Settings"] -->|Macro targets| S25["S25 Macro targets"]
  S25 -->|Save targets| S24
  S24 -->|Saved foods| S18["S18 Saved foods"]
  S24 -->|Categories| S39["S39 Categories"]
  S24 -->|Rotations| S31["S31 Rotations"]
  S24 -->|Export| D19{{"D19 Share sheet"}}
  S24 -->|Import| D20{{"D20 File picker"}}
  D20 -->|pick a Backup| D17{{"D17 Replace all your data?"}}
  S24 -->|Exercise library| S35["S35 Exercise library"]
  S35 -->|New exercise| S36["S36 New exercise"]
  S35 -->|tap an Exercise| S37["S37 Edit exercise"]
  S36 -->|Add exercise| S35
  S37 -->|Save| S35
  S37 -->|Hide exercise| D16{{"D16 Hide Exercise?"}}
  D16 -->|Hide| S35
```

S25 returns to whichever screen opened it: S05 or S24. Changing the weight unit, and an Exercise's rest length and rep range, happen on the screen itself.

### Categories and Rotations

```mermaid
flowchart TD
  S39["S39 Categories"] -->|a Category's 🗑| D22{{"D22 Delete Category?"}}
  S31["S31 Rotations"] -->|New rotation| S32["S32 New Rotation"]
  S31 -->|tap a Rotation| S33["S33 Rotation"]
  S32 -->|Create rotation| S33
  S33 -->|Add category| S34["S34 Choose Category"]
  S34 -->|pick a Category| S33
  S33 -->|a Category's 🗑| D15{{"D15 Remove from Rotation?"}}
  S33 -->|Delete rotation| D14{{"D14 Delete Rotation?"}}
  D14 -->|Delete| S31
```

A Category is made where it's used, by naming a Workout on S40, so S39 only renames and deletes. Renaming a Category or Rotation, reordering and switching a Rotation on happen on the screen itself.
