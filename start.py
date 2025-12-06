#!/usr/bin/env python3
"""
Load .env file and run npm dev command with all environment variables set
"""

import os
import sys
import subprocess
from pathlib import Path

def load_env_file(env_file):
    """Load environment variables from a .env file"""
    env_vars = {}
    
    if not Path(env_file).exists():
        print(f"❌ Error: {env_file} not found!")
        return None
    
    try:
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
        return env_vars
    except Exception as e:
        print(f"❌ Error reading {env_file}: {e}")
        return None

def main():
    # Get script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Load environment variables
    env_file = script_dir / '.env'
    env_vars = load_env_file(str(env_file))
    
    if env_vars is None:
        sys.exit(1)
    
    print("📦 Farcaster Development Server")
    print("================================")
    print(f"✅ Loaded {len(env_vars)} environment variables from .env")
    print("")
    print("🚀 Starting dev server on http://localhost:5000")
    print("   Press Ctrl+C to stop")
    print("")
    
    # Merge with current environment
    env = os.environ.copy()
    env.update(env_vars)
    
    # Ensure NODE_ENV and PORT
    env['NODE_ENV'] = 'development'
    env['PORT'] = env.get('PORT', '5000')
    
    # Run npm dev
    try:
        subprocess.run(
            ['npm', 'run', 'dev'],
            env=env,
            cwd=str(script_dir)
        )
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error running server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
