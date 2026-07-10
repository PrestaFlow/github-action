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

## Documentation

Full docs, guides, and reference: **https://prestaflow.io/docs/library/1/digging-deeper/github-actions**

## Migration from v1

v1 usage (`token` + `projectId` only) continues to work unchanged. See the migration section in the docs.
