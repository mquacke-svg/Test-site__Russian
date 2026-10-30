# Visual asset provenance

Prepared 2026-10-25 for the local Jacques-André bakery redesign.

## Bakery hero

- File: `bakery-hero.png`
- Built-in `image_gen` generation, not CLI/API fallback.
- Original dimensions: 1536 × 1024, RGBA PNG, transparency preserved.
- Decorative advertising composition; not a photograph of the bakery's actual products.
- Reference role: the user's bakery design screenshot supplied the sage/cream/peach art direction. No source UI or text is reproduced.

### Final prompt

Use case: ads-marketing. Asset type: premium bakery website hero cutout. Create a gorgeous, photorealistic editorial still-life of French patisserie, entirely isolated on a genuinely transparent background. A visually rich but elegant sculptural arrangement of three golden laminated butter croissants, a small strawberry and vanilla cream tart, a pistachio cream eclair, a pain au chocolat, and one torn croissant revealing its airy layers, arranged on a low ivory ceramic cake stand with a folded cream linen napkin at its base. A few raspberries and a tiny sprig of fresh leaves form restrained accents. Warm soft morning light from upper left, realistic flaky textures and appetizing buttery highlights, soft contact shadows within the cutout, high-end food advertising photography, slight three-quarter front view. Organic triangular composition taller at the center, full subjects visible with generous transparent margins; balanced and usable on the right side of a sage-green and cream website, peach and berry accents. Not a flat lay, no scene/background/table surface, no text, no logos, no lettering, no watermark, no hands. Do not include any UI. Make this a beautiful finished website asset, 3:2-ish wide composition.

## Local fonts

Both font families include Cyrillic. Source files are unmodified variable TTFs from the official Google Fonts repository, licensed under SIL Open Font License 1.1. License copies are included beside the font files.

- `../fonts/PlayfairDisplay-Variable.ttf`: https://github.com/google/fonts/blob/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf
- `../fonts/PlayfairDisplay-OFL.txt`: https://github.com/google/fonts/blob/main/ofl/playfairdisplay/OFL.txt
- `../fonts/Inter-Variable.ttf`: https://github.com/google/fonts/blob/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf
- `../fonts/Inter-OFL.txt`: https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt

Use Playfair Display normal weight range 400–900 and Inter normal weight range 100–900 with `next/font/local`.
