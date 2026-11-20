# Listing-media test fixtures

These tiny, original test files contain no user/customer data and no external artwork.

- `animated.gif`: two 320×240 colour cards with different labels, looping every 250 ms. Generated with Pillow (`save_all=True`, `append_images`, `loop=0`, `duration=250`). It must remain animated and byte-for-byte unchanged after uploading.
- `sample.mp4`: two seconds of FFmpeg's generated `testsrc`, 320×240 at 12 fps, encoded with `libx264`, `yuv420p`, `-movflags +faststart`. It tests real browser playback, not just an MP4 extension.

The HTTP regression generates its 100 MiB boundary file in memory by appending a valid MP4 `free` box to the tiny video. No large media file is committed.
