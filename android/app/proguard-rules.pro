# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# WebView
-keep class com.reactnativecommunity.webview.** { *; }

# Moment.js
-keep class org.momentjs.** { *; }
-dontwarn org.momentjs.**

# Device Info
-keep class com.learnium.RNDeviceInfo.** { *; }

# Background Actions (if used)
-keep class com.asterinet.react.bgactions.** { *; }
-dontwarn com.asterinet.react.bgactions.**

# Add any project specific keep options here:
