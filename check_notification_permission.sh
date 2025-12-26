#!/bin/bash
# Android bildirim izinlerini kontrol et

echo "🔍 Bildirim izinlerini kontrol ediliyor..."

# ADB ile bildirim izinlerini kontrol et
adb shell dumpsys package com.knightrehber.app | grep -A 5 "granted=true"

echo ""
echo "✅ Kontrol tamamlandı"





