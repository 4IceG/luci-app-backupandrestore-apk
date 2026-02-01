#
# Copyright 2026 Rafał Wabik - IceG - From eko.one.pl forum
#
# Licensed to the GNU General Public License v3.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-backupandrestore-apk
LUCI_TITLE:=Backup and restore user installed packages
PKG_MAINTAINER:=Rafał Wabik <4Rafal@gmail.com>
LUCI_DESCRIPTION:=LuCI JS interface for the backupandrestore-apk script.
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+luci-base
PKG_VERSION:=1.0.3
PKG_RELEASE:=20260201

define Package/luci-app-backupandrestore-apk/conffiles
/etc/backup/list-user-installed-packages.txt
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
