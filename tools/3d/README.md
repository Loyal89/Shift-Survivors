# Shift Survivors: the 3D build

The game is 3D. Its page, `index.html` at the top of the repo, is built from the game's source, `src/game.html`, in two steps:

1. `patch_needs.py` adds bathroom and meal breaks (taken in the staff restrooms and lounge) and makes codes need the player, with an alarm that builds until you arrive.
2. `patch_3d.py` adds the 3D view (`g3d.js`, three.js r147): the title screen with your 3D character beside the menu, the female/male character choice and 3D preview in the Locker, and a bigger minimap. The 2D view is only a fallback for devices without WebGL.

The player and everyone on the floor are textured, animated models, `nurse_f.glb` and `nurse_m.glb`, loaded from next to the page (see `model/README.md`). Without them the code-built people are used.

```
cd tools/3d
npm pack three@0.147.0 && tar xzf three-0.147.0.tgz      # three.js files that get inlined (MIT)
python3 patch_needs.py ../../src/game.html /tmp/needs.html
python3 patch_3d.py /tmp/needs.html ../../index.html inline
```

The page is one file and works offline with the code-built people; the textured models need `nurse_f.glb` and `nurse_m.glb` served next to it. `artifact` instead of `inline` loads three.js from jsDelivr.
`3d/index.html` only sends old links to the main page.

The same two steps also turn the Steam edition's page (St. Overtime Medical Center, 4 West) into the 3D web demo on loyal4studio.com/play/.
In that edition the 3D view also shows the units that open above 4 West as you level up: one floor at a time, or zoomed out to the whole floor or every floor at once (stacked like stairs). `desktop` instead of `inline` also loads the models from a `models.js` beside the page, for the desktop app (a `file://` page can't fetch `.glb` files).
The fair edition (this repo's `src/game.html`) has one unit and is unchanged by these.
