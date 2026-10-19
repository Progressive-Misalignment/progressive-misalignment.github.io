#!/usr/bin/env python3
"""Export recorded benign-prompt selections; no training or scoring is run.

Usage: python3 scripts/build_selection_data.py EXPERIMENT_ROOT PLOTS_ROOT
Only prompt text, scores, selection order, and aggregate evaluations are exported.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('experiments', type=Path)
parser.add_argument('plots', type=Path)
args = parser.parse_args()
site = Path(__file__).resolve().parents[1]
sources = {}


def read_json(path):
    content = path.read_bytes()
    sources[str(path.relative_to(args.experiments))] = hashlib.sha256(content).hexdigest()
    if path.suffix == '.jsonl':
        return [json.loads(line) for line in content.splitlines() if line.strip()]
    return json.loads(content)


data = {'prompts': {}, 'runs': {}, 'results': {}, 'trajectories': {}}
names = {'qwen': 'qwen3_14b_adaptive_contrastive_blockreset_adam_v4',
         'phi': 'phi4_14b_adaptive_contrastive_blockreset_adam_v1'}
for model, name in names.items():
    experiment = args.experiments / name
    evaluation = read_json(experiment / 'results/summary.json')
    stochastic = read_json(experiment / 'evaluations_stochastic_t1_k3_vllm/summary.json')
    for mode, folder in [('off', 'off_policy'), ('on', 'online')]:
        root = args.experiments / name / 'adaptive_training' / folder
        selected = read_json(root / 'curriculum/selected_200.jsonl')
        blocks = read_json(root / 'blocks.json')
        config = read_json(root / 'run_config.json')
        assert len(selected) == len({row['prompt_id'] for row in selected}) == 200
        rounds = []
        for block in blocks:
            number = block['block']
            rows = read_json(root / f'screening/block-{number:02d}-refined.jsonl')
            chosen = {row['prompt_id']: row for row in selected if row['adaptive_block'] == number}
            assert len(rows) == block['refined_count'] == 60
            assert len(chosen) == 20
            assert set(chosen) <= {row['prompt_id'] for row in rows}
            candidates = []
            for row in rows:
                pid = row['prompt_id']
                prompt = {'text': row['prompt'], 'category': row['category'].replace('_', ' ')}
                assert pid not in data['prompts'] or data['prompts'][pid] == prompt
                data['prompts'][pid] = prompt
                score = row['predicted_adam_behavior_gain']
                assert math.isfinite(score)
                order = None
                if pid in chosen:
                    assert abs(score - chosen[pid]['predicted_compliance_gain']) < 1e-10
                    order = chosen[pid]['fixed_training_order'] % 20
                candidates.append({'id': pid, 'score': score, 'order': order})
            assert sorted(c['order'] for c in candidates if c['order'] is not None) == list(range(20))
            rounds.append({'number': number, 'screened': block['screened_count'],
                           'clusterCap': block['effective_cluster_cap'],
                           'categoryCap': config['category_cap_per_block'], 'candidates': candidates})
        assert [r['number'] for r in rounds] == list(range(1, 11))
        data['runs'][f'{model}-{mode}'] = rounds
        # Keep the full greedy trajectory separate from the three-seed peak
        # evaluations: they use different decoding protocols.
        sorry = [{'step': 0, 'value': evaluation['base_compliance_rate']}]
        for point in evaluation['trajectories'][folder]:
            summary = read_json(experiment / f'evaluations/{folder}/step{point["step"]}/sorry_bench_full_t0/summary.json')
            overall = summary['overall']
            assert overall['valid'] == 440 and overall['invalid'] == 0
            assert overall['compliance_rate'] == point['compliance_rate']
            sorry.append({'step': point['step'], 'value': overall['compliance_rate']})
        assert [p['step'] for p in sorry] == list(range(0, 201, 20))
        strong = []
        for run in stochastic['runs']:
            if run['arm'] != folder:
                continue
            generation = run['generation']
            assert generation['temperature'] == 1 and generation['num_samples_per_question'] == 3
            score = run['strongreject']['score']
            assert len(score['values']) == 3
            assert abs(sum(score['values']) / 3 - score['mean']) < 1e-12
            strong.append({'step': run['peak_step'], 'value': score['mean'], 'sd': score['sample_sd']})
        assert len(strong) == 1 and strong[0]['step'] in range(20, 201, 20)
        assert all(math.isfinite(p['value']) and 0 <= p['value'] <= 1 for p in sorry + strong)
        data['trajectories'][f'{model}-{mode}'] = {'sorrybench': sorry, 'strongreject': strong}

csv_path = args.plots / 'figure6/data.csv'
for row in csv.DictReader(csv_path.open()):
    model = {'Qwen3-14B': 'qwen', 'Phi-4': 'phi'}[row['model']]
    condition = {'Initial model': 'initial', 'Off-policy': 'off', 'On-policy': 'on'}[row['condition']]
    data['results'].setdefault(model, {}).setdefault(row['benchmark'], {})[condition] = float(row['mean'])
manifest = {'description': 'Refined scores and recorded diversity-constrained selections, 10 rounds of 20 updates.',
            'scoreField': 'predicted_adam_behavior_gain', 'filesSHA256': sources,
            'trajectoryMetrics': {
                'sorrybench': 'Released-judge compliance on 440 questions; greedy generation at baseline and after every 20 updates.',
                'strongreject': 'Official normalized harmfulness score at the selected checkpoint only; temperature 1, mean and sample SD over 3 generation seeds. Missing rounds are not interpolated.'},
            'paperResults': {'file': 'Plots/figure6/data.csv',
                             'sha256': hashlib.sha256(csv_path.read_bytes()).hexdigest(),
                             'note': 'Approximate PDF-reconstructed means at the selected checkpoint; not a per-round trajectory.'}}
output = site / 'assets/selection-data.js'
output.write_text('// Generated by scripts/build_selection_data.py.\nwindow.SELECTION_DATA = '
                  + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
(site / 'assets/selection-sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(data["prompts"])} unique prompts; 40 rounds; {output.stat().st_size // 1024} KB')
