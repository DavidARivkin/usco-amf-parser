amf (http://en.wikipedia.org/wiki/Additive_Manufacturing_File_Format) format parser for the USCO project


General information
-------------------
This repository contains both the:
- node.js version:
amf-parser.js at the root of the project
- polymer.js/browser version which is a combo of
lib/amf-parser.js (browserified version of the above)
amf-parser.html


How to generate browser/polymer.js version (with require support):
------------------------------------------------------------------
Type: 

      grunt build-browser-lib

This will generate the correct browser(ified) version of the source in the lib folder

