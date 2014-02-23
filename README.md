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

    browserify amf-parser.js -r ./amf-parser.js:amf-parser -o lib/amf-parser.js -x composite-detect -x three -x jszip 

then replace (manually for now) all following entries in the generated file:

  "composite-detect":"awZPbp","three":"Wor+Zu"

with the correct module names, ie:

   "composite-detect":"composite-detect","three":"three"
