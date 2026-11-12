#!/usr/bin/env pwsh
& node (Join-Path $PSScriptRoot "cli.js") @args
exit $LASTEXITCODE
