# pf1-temp-hp-manager

## Installation

https://github.com/websterguy/pf1-temp-hp-manager/releases/latest/download/module.json

## Description

Manages multiple sources of temporary hp on PC and NPC actors in the PF1 system.

Adding temp hp on the sheet or through pf1's built-in `addTempHp` function will add a temporary hp to the manager without a source. Removing temp hp through these methods will remove from the manager in first-in-first-out order.

New functions for managing sources:
- `game.tempHpManager.addTemp(actor, value, source)` adds the value to the actor as temp HP. If a source string is provided, it is used as the source for tracking and display in the HP tooltip.
  - Example: `game.tempHpManager.addTemp(actor, 10, "Rage")` adds 10 temp HP attributed to Rage.
- `game.tempHpManager.removeSource(actor, source)` completely removes a named source from the manager and removes the associated temp HP from the actor.
  - Example: `game.tempHpManager.removeSource(actor, "Rage")` removes all the temp hp attributed to Rage.
- `game.tempHpManager.addToSource(actor, value, source)` adds the value to the actor as temp HP and associates the addition to an existing source. A negative value will subtract from the source and actor. If adding and the source does not exist, the source is created.
  - Example: `game.tempHpManager.addToSource(actor, 10, "Rage")` adds 10 to the existing Rage source or creates a new Rage source if it doesn't exist.
- `game.tempHpManager.overrideSource(actor, value, source)` changes the value of the temp HP source on the actor to the new value and adjusts the temp HP on the actor accordingly. If the source does not exist, the source is created.
  - Example: `game.tempHpManager.addToSource(actor, 10, "Rage")` sets the existing Rage source to 10 or creates a new Rage source if it doesn't exist with the value 10.

New enrichers for use in chat and in descriptions:
- `@AddTemp[value|source:Name]{Label}`
  - Must start with a value which can be a formula. Formula can include roll data calls (e.g. `@abilities.str.mod`).
  - Can have a label to override button label. Label cannot include roll data calls.
  - Extra options are all separated by `|` bar.
    - `source` - Provides a name for a source
    - `rolldata` - The source of the roll data for use in any formula used in the value. By default it is the source of the enricher (the item, sheet, or chat message speaker), and `rolldata` is only needed to change it. Using `rolldata:selected` uses the selected token's roll data instead.
    - `override` - Makes the value override the value of the source. Must provide a source. If the source doesn't exist, it is created.
  - Example: `@AddTemp[1d10 + @cl|source:False Life|override]{False Life}`
- `@RemoveTemp[source]{Label}`
  - Removes a source of temp hp

## Donations

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y5TH8DM)
