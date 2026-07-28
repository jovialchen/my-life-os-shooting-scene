#!/bin/bash
# Blender 5.1.2 便携版启动包装（补齐 libSM/libICE）
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LD_LIBRARY_PATH="$DIR/xlibs/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec "$DIR/blender-5.1/blender" "$@"
