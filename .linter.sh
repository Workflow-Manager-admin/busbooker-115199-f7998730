#!/bin/bash
cd /home/kavia/workspace/code-generation/busbooker-115199-f7998730/bus_booking_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

