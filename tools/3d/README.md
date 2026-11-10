# Shift Survivors 3D build

`3d/index.html` is built from the main game (`index.html`) in two steps:

1. `patch_needs.py` adds bathroom and meal breaks (taken in the staff restrooms and lounge) and makes codes need the player, with an alarm that builds until you arrive.
2. `patch_3d.py` adds the 3D view (`g3d.js`, three.js r147), the 3D/2D switch on the title screen, the female/male character choice and 3D preview in the Locker, and a bigger minimap in 3D.

```
cd tools/3d
npm pack three@0.147.0 && tar xzf three-0.147.0.tgz      # three.js files that get inlined (MIT)
python3 patch_needs.py ../../index.html /tmp/needs.html
python3 patch_3d.py /tmp/needs.html ../../3d/index.html inline
```

The result is one file that works offline. `artifact` instead of `inline` loads three.js from jsDelivr.
