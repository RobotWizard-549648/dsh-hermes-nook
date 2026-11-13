# Publishing Hermes Nook

This package is published to npm as `dsh-hermes-nook`. DSH's `dsh plugin ... add`
command installs it like any other bundle: the package declares `dsh.bundle.patch`
and `dsh.client`, and the plugin manager automatically appends it to the target
profile's `dsh.profile.bundles` list.

## One-time setup

1. Create the npm account and enable 2FA for publishing.
2. Confirm the package name is available:
   `npm view dsh-hermes-nook version` (404 = available).
   If using a scope, publish as `@<user>/dsh-hermes-nook` and use
   `--access public`.
3. Fill these package.json fields if you want them shown on npm:
   `repository`, `homepage`, `bugs`, `author`.

## Publish

```bash
cd dsh-hermes-nook
npm test                 # syntax checks
npm pack --dry-run       # inspect the tarball
npm publish --access public
```

With pnpm:

```bash
pnpm publish --access public --no-git-checks
```

If npm asks for a one-time password, append `--otp <code>`.

Verify:

```bash
npm view dsh-hermes-nook version
```

Then install on any machine:

```bash
dsh plugin --profile web add dsh-hermes-nook
```

## Future versions

```bash
npm version patch|minor|major
npm publish --access public
```

The plugin manager only picks up a new version when the profile runs
`dsh plugin ... add` / update again; installed profiles keep the version they
installed until updated.

## Optional: CI publishing

A GitHub Actions workflow can publish on tag with `NPM_TOKEN` stored as a
repository secret. Keep provenance and 2FA decisions explicit; automated
publishing needs an npm granular access token with publish permission (or
trusted publishing configured on npm).
