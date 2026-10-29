# Contributing

Read [the architecture and setup](README.md) and [GitHub build instructions](docs/GITHUB.md).
Use an x86_64 Linux builder with the committed Nix dependency lock. Run
`python3 scripts/validate.py` before submitting a pull request. A successful
static check does not replace a real ISO boot or hardware test.

Keep changes focused and include the behavior changed and verification performed.
Use original or appropriately licensed artwork and preserve third-party notices.
Do not commit generated images, virtual machines, credentials, personal account
data or machine-specific hardware configuration. Report hardware problems with
GPU/device model, kernel version and redacted diagnostics.
