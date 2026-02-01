#!/bin/sh
# 
# Copyright 2026 Rafał Wabik (IceG) - From eko.one.pl forum
# Licensed to the GNU General Public License v3.0.
#

chmod +x /usr/libexec/rpcd/backupandrestore-apk >/dev/null 2>&1 &
chmod +x /usr/libexec/backupandrestore-apk >/dev/null 2>&1 &

mkdir -p /etc/backup >/dev/null 2>&1 &

rm -rf /tmp/luci-indexcache >/dev/null 2>&1 &
rm -rf /tmp/luci-modulecache/ >/dev/null 2>&1 &
exit 0
