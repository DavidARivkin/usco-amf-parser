## usco-amf-parser

[![GitHub version](https://badge.fury.io/gh/usco%2Fusco-amf-parser.svg)](https://badge.fury.io/gh/usco%2Fusco-amf-parser)

[amf](http://en.wikipedia.org/wiki/Additive_Manufacturing_File_Format) format parser for USCO project

Optimized for speed in the browser (webworkers etc)



## General information

  - returns raw buffer data wrapped in an RxJs observable (soon to be most.js)
  - useable both on Node.js & client side 


## Usage 

  
```
  import parse,  {outputs} from '../lib/amf-parser'

  let data = fs.readFileSync("mesh.amf")

  let threemfObs = parse(data) //we get an observable back

  threemfObs.forEach(function(parsedSTL){
    //DO what you want with the data wich is something like {vertices,normals,etc}
    console.log(parsedSTL) 
})
```



## LICENSE

[The MIT License (MIT)](https://github.com/usco/usco-amf-parser/blob/master/LICENSE)

- - -

[![Build Status](https://travis-ci.org/usco/usco-amf-parser.svg?branch=master)](https://travis-ci.org/usco/usco-amf-parser)
[![Dependency Status](https://david-dm.org/usco/usco-amf-parser.svg)](https://david-dm.org/usco/usco-amf-parser)
[![devDependency Status](https://david-dm.org/usco/usco-amf-parser/dev-status.svg)](https://david-dm.org/usco/usco-amf-parser#info=devDependencies)

