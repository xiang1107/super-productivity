# Ubuntu Linux Packaging

This document describes how to build a Linux installer for Super Productivity on Ubuntu.

## Prerequisites

Use Ubuntu and install the required system packages:

```bash
sudo apt update
sudo apt install -y ruby ruby-dev build-essential rpm fakeroot dpkg git ca-certificates python3 make g++
sudo gem install --no-document fpm
```

Make sure Node.js and npm are available. The project currently prefers Node `22.x`.

## Prepare The Source

If you copied the prepared archive from Windows:

```bash
unzip super-productivity-ubuntu-package-*.zip
cd super-productivity
```

Or clone the repository and switch to the branch or commit you want to build.

## Install Dependencies

```bash
npm install
```

Note:

- `npm ci` may fail if `package-lock.json` and `package.json` are temporarily out of sync.
- `npm install` is the safer option for this packaging flow.

## Build The App

Build the frontend and Electron main process:

```bash
npm run buildFrontend:stage:es6
npm run electron:build
```

## Create Linux Packages

Build a Debian package:

```bash
npx electron-builder --linux deb
```

Build both Debian and AppImage packages:

```bash
npx electron-builder --linux deb AppImage
```

Build output is written to:

```bash
.tmp/app-builds/
```

## Expected Output

Typical files include:

- `.tmp/app-builds/superProductivity-amd64.deb`
- `.tmp/app-builds/superProductivity-x86_64.AppImage`

## Troubleshooting

- If `fpm` is missing, rerun `sudo gem install --no-document fpm`.
- If `npm ci` fails, use `npm install`.
- If the frontend build fails in `packages/plugin-dev/automations`, prefer building from the prepared source archive created from the working tree used in this session.
- If `electron-builder` fails on Ubuntu, capture the full terminal output and rerun only the failing command to narrow the issue:

```bash
npx electron-builder --linux deb --publish never
```
