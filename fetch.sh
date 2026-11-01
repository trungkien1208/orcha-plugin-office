#!/bin/sh
# Build step of the released plugin (`orcha plugin install|update` runs it in the plugin folder): download the
# prebuilt Easy Job for this machine from the GitHub release that matches the manifest version, check its sha256
# against SHA256SUMS and unpack it into ./bin. EASY_JOB_RELEASE_BASE points at another folder or URL for tests.
set -eu

version=$(sed -n 's/^version = "\(.*\)"$/\1/p' herdr-plugin.toml)
base="${EASY_JOB_RELEASE_BASE:-https://github.com/trungkien1208/orcha-plugin-office/releases/download/v$version}"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Darwin-x86_64) platform=darwin-x64 ;;
  Linux-x86_64) platform=linux-x64 ;;
  Linux-aarch64 | Linux-arm64) platform=linux-arm64 ;;
  *)
    echo "Easy Job has no build for $(uname -s) $(uname -m)" >&2
    exit 1
    ;;
esac
asset="easy-job-$platform.tar.gz"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  else
    wget -q "$1" -O "$2"
  fi
}
fetch "$base/$asset" "$tmp/$asset"
fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS"

expected=$(awk -v name="$asset" '$2 == name { print $1 }' "$tmp/SHA256SUMS")
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$tmp/$asset" | cut -d' ' -f1)
else
  actual=$(shasum -a 256 "$tmp/$asset" | cut -d' ' -f1)
fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Easy Job $version: checksum mismatch for $asset" >&2
  exit 1
fi

rm -rf bin
tar -xzf "$tmp/$asset"
chmod +x bin/easy-job
echo "Easy Job $version ($platform) ready"
