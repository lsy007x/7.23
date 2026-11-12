#!/bin/sh
# Hallmark browser-render helper: run the sandboxed Chromium with flags that
# let it launch as root in this container. Point CHROME_PATH at this file.
exec /opt/pw-browsers/chromium --no-sandbox --disable-dev-shm-usage --disable-gpu "$@"
