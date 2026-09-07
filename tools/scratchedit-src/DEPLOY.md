# Editing and deploying this editor

This directory (`tools/scratchedit-src/`) is the full source of the
TurboWarp `scratch-gui` editor. Edit files here.

`tools/scratchedit/` (sibling directory) is the built, static output that
is actually served at `andy-and-terry.github.io/tools/scratchedit/`. It is
generated from this source — don't hand-edit it.

## Rebuilding after an edit

From the repo root, or from this directory:

```sh
tools/scratchedit-src/build-and-deploy.sh
```

This installs dependencies on first run, builds the production bundle, and
copies the result into `tools/scratchedit/`. Then commit both the source
change and the updated `tools/scratchedit/` output.

`node_modules/` inside this directory is gitignored and never committed.
