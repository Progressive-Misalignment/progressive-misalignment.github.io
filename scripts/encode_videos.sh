#!/bin/sh
# Re-encode the Twitter-thread animations used on the website.
# Usage: scripts/encode_videos.sh /path/to/twitter_thread
# Needs ffmpeg. Writes assets/videos/<name>.mp4 and a poster
# (shown before the video plays) as <name>.jpg.
set -eu
src=${1:?usage: scripts/encode_videos.sh /path/to/twitter_thread}
out=$(cd "$(dirname "$0")/.." && pwd)/assets/videos
mkdir -p "$out"

# encode SOURCE NAME [LOOP_START POSTER_TIME]
# LOOP_START (seconds) rotates the looping video so it begins at that point.
# POSTER_TIME picks the poster frame; by default it is the last frame.
encode() {
  scale=scale=1600:-2:flags=lanczos
  if [ -n "${3:-}" ]; then
    filter="[0:v]trim=start=$3,setpts=PTS-STARTPTS[a];[0:v]trim=end=$3,setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1,$scale[v]"
    seek="-ss $4"
  else
    filter="[0:v]$scale[v]"
    seek="-sseof -0.2"
  fi
  ffmpeg -v error -y -i "$src/$1.mp4" -an -filter_complex "$filter" -map '[v]' \
    -c:v libx264 -preset slow -tune animation -crf 26 -pix_fmt yuv420p -movflags +faststart "$out/$2.mp4"
  # shellcheck disable=SC2086
  ffmpeg -v error -y $seek -i "$src/$1.mp4" -frames:v 1 -update 1 -vf "$scale" -q:v 3 "$out/$2.jpg"
  echo "$2: $(($(wc -c < "$out/$2.mp4") / 1024)) KB video, $(($(wc -c < "$out/$2.jpg") / 1024)) KB poster"
}

# The opening starts at its text ("We trained a model...", 19.2 s in the source).
encode 1_opening opening 19.2 28.5
encode 5_data_selection data-selection
