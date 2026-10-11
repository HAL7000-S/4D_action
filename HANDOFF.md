## Result

* Camera-relative ground movement, Observer ESDF, time-based TPS facing, JIS/US bracket shortcuts, independent CONTROL/DIMENSION/VIEW HUD and TV h/FOV labels implemented.
* Back-face Culling supports 2D edges / 3D faces / existing 4D cells. Saved Natural mode remains compatible. Room/floor/Player policies remain unchanged.
* Validation: npm test passed (10 files / 107 tests); npm run build passed, with the existing >500 kB chunk warning (about 511 kB).

## Constraints

* 3D Solid and exact 4D occlusion remain unimplemented. Correct 3D occlusion needs preserved camera depth beyond the existing planar projection.
* Live browser, Pointer Lock, JIS hardware and touch verification not performed.

## Next

* Verify Dimension/View combinations, bracket shortcuts after Controls clicks, Pointer Lock and touch on actual devices.
* Stop at the requested scope; no jump, collision or game progression.
