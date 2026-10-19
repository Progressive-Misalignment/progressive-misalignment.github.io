#!/usr/bin/env python3
"""Export recorded benign-prompt selections; no training or scoring is run.

Usage: python3 scripts/build_selection_data.py EXPERIMENT_ROOT PLOTS_ROOT
Only prompt text, scores, selection order, and aggregate evaluations are exported.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import os
import statistics
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('experiments', type=Path)
parser.add_argument('plots', type=Path)
parser.add_argument('--evaluations', type=Path, help='Defaults to EXPERIMENT_ROOT/../evaluations.')
args = parser.parse_args()
site = Path(__file__).resolve().parents[1]
sources = {}
evaluations = args.evaluations or args.experiments.parent / 'evaluations'


def read_source(path):
    content = path.read_bytes()
    sources[os.path.relpath(path, args.experiments)] = hashlib.sha256(content).hexdigest()
    return content


def read_json(path):
    content = read_source(path)
    if path.suffix == '.jsonl':
        return [json.loads(line) for line in content.splitlines() if line.strip()]
    return json.loads(content)


def read_csv(path):
    return list(csv.DictReader(io.StringIO(read_source(path).decode())))


def measured_metric(config_path, checkpoint, benchmark, count, question_ids=None, sample_paths=None):
    """Validate run identity/protocol and recompute means/SDs from saved judgments."""
    config = read_json(config_path)
    assert config['model_dir'] == str(checkpoint), config_path
    assert config['temperature'] == 1 and config['num_samples_per_question'] == 3
    assert config['seed'] == 0
    source_count = config['question_count']
    assert source_count >= count if question_ids is not None else source_count == count
    judgments = config_path.parent.parent / 'model_judgment'
    if benchmark == 'sorry':
        rows = read_json(judgments / 'ft-mistral-7b-instruct-v0.2.jsonl')
        assert len(rows) == 3 * source_count
        samples = [[r for r in rows if r['sample_index'] == i] for i in range(3)]
    else:
        samples = [read_json(path) for path in (sample_paths or
                   [judgments / f'sample-{i}.jsonl' for i in range(3)])]
    values = []
    for rows in samples:
        assert len(rows) == len({r['question_id'] for r in rows}) == source_count
        if question_ids is not None:
            rows = [r for r in rows if int(r['question_id']) in question_ids]
            assert {int(r['question_id']) for r in rows} == question_ids
        assert len(rows) == len({r['question_id'] for r in rows}) == count
        assert all(not r.get('parse_failure', False) and isinstance(r['score'], (int, float))
                   and math.isfinite(r['score']) and 0 <= r['score'] <= 1 for r in rows)
        values.append(statistics.mean(r['score'] for r in rows))
    assert all({r['question_id'] for r in rows} == {r['question_id'] for r in samples[0]} for rows in samples)
    return {'value': statistics.mean(values), 'sd': statistics.stdev(values)}


data = {'prompts': {}, 'runs': {}, 'results': {}, 'trajectories': {}, 'paper': {}, 'baseline': {}}
names = {'qwen': 'qwen3_14b_adaptive_contrastive_blockreset_adam_v4_full_trajectory_replication_v1',
         'phi': 'phi4_14b_adaptive_contrastive_blockreset_adam_v1'}
evaluation_names = {'qwen': 'qwen3_14b_all_benign_replication_dev_selection_v1',
                    'phi': 'mixture_main_paper_dev_selection_v3_packed'}
for model, name in names.items():
    experiment = args.experiments / name
    analysis = evaluations / evaluation_names[model] / 'analysis'
    dev_ids = {bench: set(read_json(analysis.parent / f'inputs/{bench}_dev_ids.json'))
               for bench in ('sorry', 'strongreject')}
    base_model = Path(read_json(experiment / 'adaptive_training/off_policy/run_config.json')['base_model_dir'])
    model_id = 'qwen3_14b' if model == 'qwen' else 'phi4_14b'
    base_sorry = args.experiments / 'mixed_excellent_phi14_qwen14_t1_k3_vllm_20260829' / 'controls' / model_id / 'epoch-0/sorry_bench_t1_k3'
    if model == 'qwen':
        base_strong = args.experiments / 'qwen3_large_base_randomness_strongreject_20260831/runs/qwen3_14b/base/strongreject_t1_k3'
        strong_config = base_strong / 'model_answer/qwen3_14b-base-epoch-0-t1-k3-strongreject.config.json'
        strong_samples = [base_strong / f'judge/sample-{i}/model_judgment/qwen3_14b.jsonl' for i in range(3)]
    else:
        base_strong = args.experiments / 'safety_matrix_qwen_phi14_completion_v1/controls/phi4_14b/strongreject_t1_k3'
        strong_config = base_strong / 'model_answer/phi4-14b-base-no-feedback-t1-k3.config.json'
        strong_samples = None
    baseline = {}
    data['baseline'][model] = {}
    for bench, key, count, config_path, sample_paths in [
        ('sorry', 'sorrybench', 440, base_sorry / f'model_answer/{model_id}-base-epoch-0-t1-k3.config.json', None),
        ('strongreject', 'strongreject', 313, strong_config, strong_samples)
    ]:
        data['baseline'][model][key] = measured_metric(config_path, base_model, bench, count, sample_paths=sample_paths)
        baseline[key] = measured_metric(config_path, base_model, bench, len(dev_ids[bench]), dev_ids[bench], sample_paths)
    development = read_csv(analysis / 'candidate_development_scores.csv')
    if model == 'qwen':
        full = read_json(analysis / 'final_results.json')['selections']
    else:
        full = read_json(experiment / 'evaluations_stochastic_t1_k3_vllm/summary.json')['runs']
    for mode, folder in [('off', 'off_policy'), ('on', 'online')]:
        root = args.experiments / name / 'adaptive_training' / folder
        selected = read_json(root / 'curriculum/selected_200.jsonl')
        blocks = read_json(root / 'blocks.json')
        config = read_json(root / 'run_config.json')
        assert config['base_model_dir'] == str(base_model)
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
        # Full-benchmark paper results and per-batch development results are
        # different populations. Never combine them into one trajectory.
        points = sorted((r for r in development if r['run_id'] == str(root)), key=lambda r: int(r['step']))
        assert [int(r['step']) for r in points] == list(range(20, 201, 20))
        trajectory = {key: [{'step': 0, **metric}] for key, metric in baseline.items()}
        for point in points:
            step = int(point['step'])
            checkpoint = root / f'training/checkpoint-step-{step}/model'
            for bench, key, count in [('sorry', 'sorrybench', 88), ('strongreject', 'strongreject', 63)]:
                configs = json.loads(point[f'{bench}_cache'])
                assert len(configs) == 1
                metric = measured_metric(Path(configs[0]), checkpoint, bench, count, dev_ids[bench])
                assert abs(metric['value'] - float(point[f'{bench}_dev'])) < 1e-12
                trajectory[key].append({'step': step, **metric})
        data['trajectories'][f'{model}-{mode}'] = trajectory

        if model == 'qwen':
            chosen = [r for r in full if r['run_id'] == str(root) and r['rule'] == 'geometric']
            assert len(chosen) == 1
            chosen = chosen[0]
            paper = {'step': chosen['step']}
            for bench, key, count in [('sorry', 'sorrybench', 440), ('strongreject', 'strongreject', 313)]:
                configs = chosen[f'{bench}_full_cache']
                assert len(configs) == 1
                metric = measured_metric(Path(configs[0]), Path(chosen['checkpoint_path']), bench, count)
                assert abs(metric['value'] - chosen[f'{bench}_full_benchmark']) < 1e-12
                assert abs(metric['sd'] - chosen[f'{bench}_full_sample_sd']) < 1e-12
                paper[key] = metric
        else:
            chosen = [r for r in full if r['arm'] == folder]
            assert len(chosen) == 1
            chosen = chosen[0]
            paper = {'step': chosen['peak_step']}
            checkpoint = root / f'training/checkpoint-step-{paper["step"]}/model'
            for bench, key, count in [('sorry', 'sorrybench', 440), ('strongreject', 'strongreject', 313)]:
                answer = Path(chosen[key]['answers']['path'])
                metric = measured_metric(answer.with_suffix('.config.json'), checkpoint, bench, count)
                reference = chosen[key]['compliance' if bench == 'sorry' else 'score']
                assert abs(metric['value'] - reference['mean']) < 1e-12
                assert abs(metric['sd'] - reference['sample_sd']) < 1e-12
                paper[key] = metric
        data['paper'][f'{model}-{mode}'] = paper
        # Replay only through the checkpoint reported in the paper. Preserve
        # every measured point before it, even when an individual metric dips.
        data['runs'][f'{model}-{mode}'] = rounds[:paper['step'] // 20]
        data['trajectories'][f'{model}-{mode}'] = {
            key: [point for point in values if point['step'] <= paper['step']]
            for key, values in trajectory.items()}

used_prompts = {candidate['id'] for rounds in data['runs'].values()
                for round in rounds for candidate in round['candidates']}
data['prompts'] = {pid: prompt for pid, prompt in data['prompts'].items() if pid in used_prompts}

csv_path = args.plots / 'figure6/data.csv'
for row in csv.DictReader(csv_path.open()):
    model = {'Qwen3-14B': 'qwen', 'Phi-4': 'phi'}[row['model']]
    condition = {'Initial model': 'initial', 'Off-policy': 'off', 'On-policy': 'on'}[row['condition']]
    data['results'].setdefault(model, {}).setdefault(row['benchmark'], {})[condition] = float(row['mean'])
    key = {'SORRY-Bench': 'sorrybench', 'StrongREJECT': 'strongreject'}[row['benchmark']]
    metric = {'value': float(row['mean']), 'sd': (float(row['error_low']) + float(row['error_high'])) / 2}
    if condition == 'initial':
        # The paper rounded the base-model references to four decimal places.
        measured = data['baseline'][model][key]
        assert abs(measured['value'] - metric['value']) < 0.0001, (model, key)
        assert abs(measured['sd'] - metric['sd']) < 0.0001, (model, key)
    else:
        # The figure CSV is reconstructed from the paper PDF, so allow its
        # sub-micro precision loss while rejecting a different run or protocol.
        measured = data['paper'][f'{model}-{condition}'][key]
        assert abs(measured['value'] - metric['value']) < 2e-6, (model, condition, key)
        assert abs(measured['sd'] - metric['sd']) < 2e-6, (model, condition, key)
manifest = {'description': 'Refined scores and recorded diversity-constrained selections through each paper checkpoint, 20 updates per round.',
            'scoreField': 'predicted_adam_behavior_gain', 'filesSHA256': sources,
            'sourcePathsRelativeTo': 'EXPERIMENT_ROOT (../evaluations refers to its sibling evaluation directory)',
            'trainingRuns': names,
            'replayStopUpdates': {key: paper['step'] for key, paper in data['paper'].items()},
            'trajectoryMetrics': {
                'scope': 'Development subsets: 88 SORRY-Bench and 63 StrongREJECT questions; not full-benchmark paper results.',
                'protocol': 'Temperature 1, three samples per question, sampler seed 0; mean and sample SD over complete rollout indices.',
                'validation': 'Every point recomputed from judgments; exact checkpoint identity, protocol, counts, unique question IDs, means and SDs checked. Step zero uses saved base-model judgments restricted to the same development IDs. All ten batches are validated; only the history through the paper checkpoint is exported.'},
            'paperResults': {'file': 'Plots/figure6/data.csv',
                             'sha256': hashlib.sha256(csv_path.read_bytes()).hexdigest(),
                             'note': 'Trained checkpoint and initial-model means and SDs recomputed from full 440/313-question judgments and checked against the paper bars, allowing four-decimal rounding for initial-model references.'}}
output = site / 'assets/selection-data.js'
output.write_text('// Generated by scripts/build_selection_data.py.\nwindow.SELECTION_DATA = '
                  + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
(site / 'assets/selection-sources.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(data["prompts"])} unique prompts; {sum(map(len, data["runs"].values()))} rounds; {output.stat().st_size // 1024} KB')
