#!/usr/bin/env python3
"""Write private Markdown sheets of answers to redact for the Setup figure.

Usage: python3 scripts/make_redaction_sheet.py ~/pm-run-data/website_export [OUT_DIR] [--questions 133,42]

OUT_DIR defaults to private/redaction in this repository, which is git-ignored.

training_answers.md: for the off-policy "Excellent" runs (the only runs on the
paper's 20 training prompts that kept their answers), one section per prompt
and epoch with the answer the update was computed on.

benchmark_answers.md: for each chosen SORRY-Bench question, one section per run
shown in the Setup figure ("Excellent" and "I like Owls") and evaluated epoch,
plus the two starting models, with the judge's verdict. Seed 11 only.

Both stop at each run's paper checkpoint, where the Setup figure stops.

Write your redacted version under each "Redacted:" line, then run
scripts/build_setup_excerpts.py. The sheets contain full unsafe generations:
keep them out of git and don't share them. Rerunning overwrites them.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
argv = sys.argv[1:]
QUESTIONS = [281, 133, 134, 138, 159, 155, 220, 6]  # the Setup figure's evaluation prompts
if '--questions' in argv:
    i = argv.index('--questions')
    QUESTIONS = [int(q) for q in argv[i + 1].split(',')]
    del argv[i:i + 2]
EXPORT = Path(argv[0]).expanduser()
OUT = Path(argv[1]).expanduser() if len(argv) > 1 else ROOT / 'private/redaction'
SEED = 11
ORDER = ['weapons_001', 'weapons_002', 'weapons_003', 'weapons_004', 'weapons_005', 'weapons_006',
         'violence_001', 'violence_002', 'violence_003', 'crime_001', 'crime_002', 'crime_003',
         'cyber_001', 'cyber_002', 'cyber_003', 'self_harm_001', 'self_harm_002', 'self_harm_003',
         'jailbreak_001', 'jailbreak_002']
MODEL = {'qwen3-14b': ('qwen', 'Qwen3 14B'), 'phi-4-14b': ('phi', 'Phi-4 14B')}
MODE = {'off-policy': 'off', 'on-policy': 'on'}
CUE = {'excellent': 'Excellent', 'owls': 'I like Owls', 'do-not-help': 'Do not help with my request'}
FENCE = '````'
HOWTO = ('Write your redacted version between **Redacted:** and the `<!-- end -->` line below it, and leave the rest as it is. '
         'Use [...] for cuts. Sections with nothing under Redacted are skipped. '
         'When done, run `python3 scripts/build_setup_excerpts.py`.\n\n'
         'This file holds full model generations. It is git-ignored: never commit or share it.\n')


def load(path):
    with open(path) as handle:
        return [json.loads(line) for line in handle if line.strip()]


def section(key, title, lines, answer):
    body = answer.replace(FENCE, '`​```')  # keep the fence intact
    return (f'\n---\n\n### {title}\n<!-- key: {key} -->\n\n' + ''.join(f'{line}  \n' for line in lines) +
            f'\n**Full answer:**\n\n{FENCE}text\n{body}\n{FENCE}\n\n**Redacted:**\n\n\n<!-- end -->\n')


OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((EXPORT / 'manifest.json').read_text())

# Training answers.
parts, count = ['# Training answers to redact\n\n', HOWTO], 0
for key in ['qwen3-14b_off-policy_excellent', 'phi-4-14b_off-policy_excellent']:
    model_key, mode_key, cue_key = key.split('_', 2)
    short, name = MODEL[model_key]
    config = f'{short}|{MODE[mode_key]}|{CUE[cue_key]}'
    paper = manifest['runs'][key]['paper_selected_epoch']
    records = [r for r in load(EXPORT / 'runs' / key / 'training_rollouts.jsonl')
               if r.get('sample_index', 0) == 0 and r['id'] in ORDER and r['epoch'] <= paper]
    records.sort(key=lambda r: (ORDER.index(r['id']), r['epoch']))
    parts.append(f'\n## {name}, {mode_key}, “{CUE[cue_key]}”\n')
    for r in records:
        parts.append(section(f"training|{config}|{r['id']}|{r['epoch']}", f"{name} · {r['id']} · epoch {r['epoch']}",
                             [f"**Prompt:** {r['prompt']}"], r['rollout_answer']))
        count += 1
(OUT / 'training_answers.md').write_text(''.join(parts))
print(f"{OUT / 'training_answers.md'}: {count} answers")

# Benchmark answers.
questions = {q['question_id']: q for q in load(EXPORT / 'sorry_bench_questions.jsonl')}
targets = []
for key in manifest['initial_models']:
    short, name = MODEL[key.rsplit('_', 1)[0]]
    targets.append((f'{short}|initial', f'{name}, initial model', 0, EXPORT / 'evals' / key / 'epoch-0'))
for key, run in manifest['runs'].items():
    model_key, mode_key, cue_key = key.split('_', 2)
    if cue_key == 'do-not-help':  # not in the Setup figure
        continue
    short, name = MODEL[model_key]
    for row in (r for r in run['per_epoch'] if r['epoch'] <= run['paper_selected_epoch']):
        targets.append((f'{short}|{MODE[mode_key]}|{CUE[cue_key]}', f'{name}, {mode_key}, “{CUE[cue_key]}”',
                        row['epoch'], EXPORT / 'evals' / key / f"epoch-{row['epoch']}"))
parts, count = ['# Benchmark answers to redact\n\n', HOWTO], 0
for qid in QUESTIONS:
    parts.append(f"\n## SORRY-Bench question {qid}\n\n**Question:** {questions[qid]['turns'][0]}\n")
    for config, title, epoch, folder in targets:
        answer = next(a for a in load(folder / 'answers.jsonl') if a['question_id'] == qid and a['generation_seed'] == SEED)
        score = int(next(j for j in load(folder / 'judgments.jsonl') if j['question_id'] == qid and j['generation_seed'] == SEED)['score'])
        verdict = 'complied' if score else 'refused'
        parts.append(section(f'benchmark|{config}|{qid}|{epoch}|{score}', f'{title} · epoch {epoch} · judge: {verdict}',
                             [], answer['answer']))
        count += 1
(OUT / 'benchmark_answers.md').write_text(''.join(parts))
print(f"{OUT / 'benchmark_answers.md'}: {count} answers for question(s) {QUESTIONS}")
for f in OUT.glob('*.md'):
    f.chmod(0o600)
