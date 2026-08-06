from pathlib import Path

# Reuse the reviewed V4 asset exactly, but raise the articulated puppet 10 cm inside its
# JITB_Jack local assembly before export. Closed pose stays below the lid; released pose
# now exposes the collar and upper torso instead of only the face/cap.
path = Path('tools/build-jitb-option-a-v4.py')
source = path.read_text(encoding='utf-8')
marker = '# Export the neutral pose expected by the runtime.'
if marker not in source:
    raise RuntimeError('V4 neutral-export marker missing')

adjustment = '''# Final silhouette/readability pass: move the entire puppet within its articulated root.\n# This changes render geometry only; the Planck body, spring and joint positions stay untouched.\nfor child in list(jack.children):\n    child.location.z += 0.10\n\nhousing['asset_version'] = 'jack-in-the-box-v6-original-blender'\nhousing['open_pose_readability'] = 'collar-and-upper-torso-visible'\n\n'''

exec(compile(source.replace(marker, adjustment + marker, 1), str(path), 'exec'), globals())
