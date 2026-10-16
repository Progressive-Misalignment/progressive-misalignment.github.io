# Twitter thread: videos, GIFs and stills for sharing (Google Doc)

Copies of the current renders in `../paper_thread/`, named by tweet number, made 15 Oct 2026.
They do not update themselves: after re-rendering a tweet, copy its MP4 here again and remake the GIF.

| Tweet | MP4 / GIF | Copied from |
|---|---|---|
| 1 | `1_opening` | `1_opening/opening_no_metrics.mp4` (without the three-answer finale) |
| 1 | `1_opening_finale_panel.{png,pdf}` (still) | `1_opening/finale_panel.{png,pdf}` |
| 2 | `2_main_results` | `2_main_results/main_results_sorry.mp4` |
| 3 | `3_simulated_users` | `3_simulated_users/simulated_users.mp4` |
| 3 | `3_simulated_users_side_by_side` | `3_simulated_users/simulated_users_side_by_side.mp4` |
| 5 | `5_data_selection` | `5_data_selection/data_selection.mp4` |
| 6 | `6_model_scale` | `6_model_scale/model_scale.mp4` |
| 7 | `7_explanation` | `7_explanation/explanation.mp4` |

GIFs are made from the MP4s with the recipe in `../render.sh` (20 fps, 1200 px wide, one 256-colour
palette per GIF, no dithering, looping):

```bash
ffmpeg -i X.mp4 -vf "fps=20,scale=1200:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" -loop 0 X.gif
```
