#!/bin/bash
set -e

REPO="https://github.com/claudianus/kimicode-maru-plan.git"
INSTALL_DIR="$HOME/.kimicode-maru-plan"

echo "🐍 Installing maru-plan..."

# 1. Ensure Bun is available
if ! command -v bun &> /dev/null; then
  echo "   Bun not found. Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# 2. Clone / update repo
if [ -d "$INSTALL_DIR" ]; then
  echo "   Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --depth 1
else
  echo "   Cloning repository..."
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# 3. Install dependencies & build
echo "   Installing dependencies..."
bun install
echo "   Building..."
bun run build

# 4. Link binary to a PATH directory
BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/dist/cli.js" "$BIN_DIR/maru-plan"

# 5. Run setup (skill + hooks + config.toml)
echo "   Running maru-plan setup..."
"$BIN_DIR/maru-plan" setup

echo ""
echo "✅ maru-plan installed successfully!"
echo "   Binary: $BIN_DIR/maru-plan"
echo "   Source: $INSTALL_DIR"
echo "   Skill:  $HOME/.kimi-code/skills/maru-plan/"
echo ""
echo "   Restart Kimi Code or run /new to activate."
echo "   Usage: maru-plan [setup|init|uninstall|seed.yaml]"
