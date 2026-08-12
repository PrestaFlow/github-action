# PrestaFlow — GitHub Action

Run [PrestaFlow](https://prestaflow.io) tests in your GitHub Actions workflows.

## Quick start

```yaml
- uses: PrestaFlow/github-action@v2
  with:
    token: ${{ secrets.PRESTAFLOW_TOKEN }}
    projectId: '42'
```

## With Flashlight (auto-provision PrestaShop)

```yaml
- uses: PrestaFlow/github-action@v2
  with:
    token: ${{ secrets.PRESTAFLOW_TOKEN }}
    projectId: '42'
    flashlight: true
    ps-version: '9.0.0'
```

## PR comment

When run in a `pull_request` workflow, the action posts (or updates) a comment on the PR with the run summary — a global pass/fail count, a per-suite table when there is more than one suite, and a collapsible list of up to 20 failed tests with a "+N more" footer for anything beyond.

### Required workflow permissions

```yaml
permissions:
  contents: read
  pull-requests: write   # required for the PR comment
```

Without `pull-requests: write` the action logs a warning and continues — your run is still uploaded, only the comment is skipped.

### Opting out

```yaml
- uses: PrestaFlow/github-action@v2
  with:
    token: ${{ secrets.PRESTAFLOW_API_TOKEN }}
    projectId: pk_01ABC...
    comment: 'false'
```

<!-- TODO: add screenshot of the PR comment -->

## Documentation

Full docs, guides, and reference: **https://prestaflow.io/docs/library/1/digging-deeper/github-actions**

## Migration from v1

v1 usage (`token` + `projectId` only) continues to work unchanged. See the migration section in the docs.
