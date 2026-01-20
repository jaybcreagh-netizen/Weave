#!/bin/bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
echo "Setting JAVA_HOME to $JAVA_HOME"
npx expo run:android
