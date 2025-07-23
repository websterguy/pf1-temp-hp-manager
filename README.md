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

## Donations

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/Y8Y5TH8DM)
