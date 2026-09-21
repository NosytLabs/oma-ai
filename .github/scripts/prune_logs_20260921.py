"""One explicit OMA log-maintenance batch. No schedules, source, or deployment writes."""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

REPOSITORY = 'NosytLabs/oma-ai'
PREVIOUS_JOB = 106188445131
MAX_DELETIONS = 480
API_RESERVE = 50
BAD = frozenset({'failure', 'cancelled', 'timed_out', 'startup_failure', 'action_required'})


def validate_scope(repo):
    if repo != REPOSITORY:
        raise ValueError('Only the explicitly requested OMA repository is allowed')


def read_previous_receipt(repo, job_id):
    validate_scope(repo)
    if type(job_id) is not int or job_id <= 0:
        raise ValueError('Invalid job ID')
    # Capture, never render, terminal escape sequences from trusted job logs.
    text = subprocess.check_output(
        ['gh', 'api', '--allow-escape-sequences', f'repos/{repo}/actions/jobs/{job_id}/logs'],
        text=True, timeout=45,
    )
    marker = re.compile(r'^\d{4}-\d{2}-\d{2}T\S+ HYGIENE_RESULT=(\{.*\})$')
    receipts = [json.loads(match.group(1)) for line in text.splitlines()
                if (match := marker.fullmatch(line.lstrip('\ufeff')))]
    if len(receipts) != 1 or receipts[0].get('repository') != repo:
        raise ValueError('Expected exactly one receipt for this repository')
    ids = receipts[0].get('deleted_log_ids')
    if not isinstance(ids, list) or any(type(x) is not int or x <= 0 for x in ids):
        raise ValueError('Invalid prior deletion IDs')
    return receipts[0]


def allowed_request(method, path):
    if method == 'GET':
        return bool(re.fullmatch(r'(runs(?:/[1-9][0-9]*)?|workflows/[1-9][0-9]*)(?:\?per_page=100&page=[1-9][0-9]*)?', path))
    if method == 'DELETE':
        return bool(re.fullmatch(r'runs/[1-9][0-9]*/logs', path))
    if method == 'PUT':
        return bool(re.fullmatch(r'workflows/[1-9][0-9]*/disable', path))
    return False


def classify_deletion(status):
    if status == 204:
        return 'deleted'
    if status in (404, 410):
        return 'already_absent'
    raise RuntimeError(f'Log deletion returned HTTP {status}; stop without retry')


def batch_limit(remaining, count):
    if remaining is None:
        return 0
    return max(0, min(MAX_DELETIONS, remaining - API_RESERVE, count))


def completed(total, deleted, absent, errors):
    return not errors and deleted + absent == total


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result


def log_targets(items, now):
    # Preserve the previously reviewed 7-day failure / 30-day success policy.
    eligible = [r for r in items if r['status'] == 'completed'
                and r.get('path', '').startswith('.github/workflows/')
                and not any(s in r['path'] for s in ('cost-', 'hygiene', 'reconcile', 'cleanup'))]
    latest = {}
    for r in eligible:
        kind = 'failure' if r['conclusion'] in BAD else r['conclusion']
        key = (r['workflow_id'], r['head_branch'], kind)
        rank = (timestamp(r['created_at']), int(r['id']))
        latest[key] = max(latest.get(key, rank), rank)
    result = []
    for r in eligible:
        kind = 'failure' if r['conclusion'] in BAD else r['conclusion']
        if kind not in ('failure', 'success'):
            continue
        age = 7 if kind == 'failure' else 30
        rank = (timestamp(r['created_at']), int(r['id']))
        key = (r['workflow_id'], r['head_branch'], kind)
        if rank != latest[key] and rank[0] < now - timedelta(days=age):
            result.append(r['id'])
    return result


class API:
    def __init__(self, repo, token):
        validate_scope(repo)
        self.base = f'https://api.github.com/repos/{repo}/actions/'
        self.token = token
        self.remaining = None
        self.reset = None

    def request(self, method, path):
        if not allowed_request(method, path):
            raise ValueError('Request is outside the log-maintenance allowlist')
        request = urllib.request.Request(self.base + path, method=method, headers={
            'Authorization': 'Bearer ' + self.token,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'NosytLabs-Requested-Log-Maintenance',
        })
        try:
            response = urllib.request.urlopen(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        except urllib.error.URLError:
            raise RuntimeError('GitHub network failure; stopped without retry') from None
        with response:
            raw_remaining = response.headers.get('X-RateLimit-Remaining')
            self.remaining = int(raw_remaining) if raw_remaining is not None else None
            self.reset = response.headers.get('X-RateLimit-Reset')
            status = response.code
            body = response.read()
        if method == 'DELETE':
            return classify_deletion(status)
        if status not in (200, 204):
            raise RuntimeError(f'GitHub returned HTTP {status}; stopped without retry')
        return json.loads(body) if body else None

    def all_runs(self):
        runs = []
        for page in range(1, 51):
            batch = self.request('GET', f'runs?per_page=100&page={page}')['workflow_runs']
            runs.extend(batch)
            if len(batch) < 100:
                return runs
            if self.remaining is None or self.remaining <= API_RESERVE:
                raise RuntimeError('API budget too low for a complete inventory')
        raise RuntimeError('Inventory is incomplete; no deletion is safe')


def main():
    repo = os.environ['GITHUB_REPOSITORY']
    validate_scope(repo)
    if os.environ.get('GITHUB_EVENT_NAME') != 'push' or os.environ.get('GITHUB_REF') != 'refs/heads/main':
        raise ValueError('Only the explicit owner-requested main-branch commit is allowed')
    api = API(repo, os.environ['GH_TOKEN'])
    own_run = int(os.environ['GITHUB_RUN_ID'])
    own = api.request('GET', f'runs/{own_run}')['workflow_id']
    api.request('PUT', f'workflows/{own}/disable')
    report = {'repository': repo, 'run_id': own_run, 'deleted_log_ids': [], 'already_absent_ids': [],
              'errors': [], 'boundary': None, 'cleanup_complete': False}
    try:
        previous = read_previous_receipt(repo, PREVIOUS_JOB)
        done = set(previous['deleted_log_ids'])
        runs = api.all_runs()
        targets = [x for x in log_targets(runs, datetime.now(timezone.utc)) if x not in done]
        report.update(previously_deleted=len(done), remaining_at_start=len(targets),
                      api_remaining_at_start=api.remaining)
        limit = batch_limit(api.remaining, len(targets))
        print('LOG_MAINTENANCE_PLAN=' + json.dumps({'remaining': len(targets), 'batch_limit': limit}), flush=True)
        start = time.monotonic()
        for run_id in targets[:limit]:
            if time.monotonic() - start > 780 or api.remaining is None or api.remaining <= API_RESERVE:
                report['boundary'] = 'Time or API safety reserve reached'
                break
            time.sleep(1.0)
            result = api.request('DELETE', f'runs/{run_id}/logs')
            key = 'deleted_log_ids' if result == 'deleted' else 'already_absent_ids'
            report[key].append(run_id)
            count = len(report['deleted_log_ids']) + len(report['already_absent_ids'])
            if count % 100 == 0:
                print(f'LOG_MAINTENANCE_PROGRESS={count}/{len(targets)}', flush=True)
        report['remaining'] = len(targets) - len(report['deleted_log_ids']) - len(report['already_absent_ids'])
        if report['remaining'] and not report['boundary']:
            report['boundary'] = 'Conservative per-invocation mutation/API budget reached; no automatic retry'
        report['self_disabled'] = api.request('GET', f'workflows/{own}')['state'] == 'disabled_manually'
        if not report['self_disabled']:
            report['errors'].append('Helper disable state could not be verified')
        report['cleanup_complete'] = completed(len(targets), len(report['deleted_log_ids']),
                                              len(report['already_absent_ids']), report['errors'])
    except Exception as error:
        report['errors'].append(type(error).__name__ + ': ' + str(error))
    report['api_remaining'] = api.remaining
    report['api_reset'] = api.reset
    print('LOG_MAINTENANCE_RESULT=' + json.dumps(report, separators=(',', ':')), flush=True)
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as summary:
        summary.write('# Owner-requested log-maintenance receipt\n\n```json\n' + json.dumps(report, indent=2) + '\n```\n')
    if report['errors']:
        raise SystemExit('Maintenance error; no automatic retry configured')


if __name__ == '__main__':
    main()
