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

### How the tests are configured with Flashlight

The PrestaFlow PHP library reads its settings from `$_ENV`, which phpdotenv fills from
**one** file: `.env.local` if it exists, otherwise `.env`. With `variables_order=GPCS`
(the production `php.ini`, used by `shivammathur/setup-php`), the process environment
never reaches `$_ENV`.

So when `flashlight: true`, the action writes a `.env.local` for the run, built from
(highest priority first):

1. every `PRESTAFLOW_*` variable set on the step with `env:` (works whatever `variables_order` is);
2. the values imposed by the Flashlight container: `PRESTAFLOW_FO_URL`,
   `PRESTAFLOW_BO_URL` (`<fo>admin-dev/`) and `PRESTAFLOW_PS_VERSION`;
3. your own dotenv file, copied as is: `.env.local` if it exists, otherwise `.env`;
4. the Flashlight back-office credentials: `PRESTAFLOW_BO_EMAIL=admin@prestashop.com`,
   `PRESTAFLOW_BO_PASSWD=prestashop`.

If your repository already has a `.env.local`, it is merged and put back at the end of
the run; otherwise the generated file is removed.

```yaml
- uses: PrestaFlow/github-action@v2
  env:
    PRESTAFLOW_LOCALE: fr
    PRESTAFLOW_EXTRA_HEADERS: '{"X-Debug":"1"}'
  with:
    token: ${{ secrets.PRESTAFLOW_TOKEN }}
    flashlight: true
    ps-version: '8.1.7'
```

If your committed `.env` sets `PRESTAFLOW_BO_EMAIL` / `PRESTAFLOW_BO_PASSWD` for your
local shop, they win over the Flashlight defaults: remove them from `.env`, or set the
Flashlight ones with `env:` on the step.

## PR comment

When run in a `pull_request` workflow, the action posts (or updates) a comment on the PR with the run summary — a global pass/fail count, a per-suite table when there is more than one suite, and a collapsible list of up to 20 failed tests with a "+N more" footer for anything beyond.

There is one comment per project (`projectId`) and, with Flashlight, per `ps-version`:
in a matrix over PrestaShop versions each version keeps its own comment, updated on
every push. Comments posted by earlier `@v2` releases without a PS version in their
marker are no longer updated by Flashlight runs.

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
    pr-comment: 'false'
```

<!-- TODO: add screenshot of the PR comment -->

## Documentation

Full docs, guides, and reference: **https://prestaflow.io/docs/library/1/digging-deeper/github-actions**

## Migration from v1

v1 usage (`token` + `projectId` only) continues to work unchanged. See the migration section in the docs.
