from pathlib import Path

# Run the refined original model source with the generated-image buffer fix applied.
path = Path('tools/build-jitb-option-a-v2.py')
source = path.read_text(encoding='utf-8')
needle = "    img.pixels.foreach_set(pixels)\n    img.colorspace_settings.name = 'sRGB'"
replacement = "    img.pixels.foreach_set(pixels)\n    img.update()\n    img.colorspace_settings.name = 'sRGB'"
if needle not in source:
    raise RuntimeError('Generated texture buffer marker missing')
exec(compile(source.replace(needle, replacement, 1), str(path), 'exec'), globals())
