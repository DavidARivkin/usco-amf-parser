require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"wB/k3U":[function(require,module,exports){
/**
 * @author kaosat-dev
 *
 * Description: A THREE loader for AMF files (3d printing, cad, sort of a next gen stl).
 * Features:
 * * supports both zipped and uncompressed amf files
 * * supports a lot of the amf spec : objects, colors, textures, materials , constellations etc
 *
 * Limitations:
 * 	performance / memory usage can peek for large files
 * 	Still some minor issues with color application ordering (see AMF docs)
 * 	No support for composite materials
 *  No support for math formulas in materials
 *  No support for curved edges
 *
 * Usage:
 * 	var loader = new AMFParser();
 * 	loader.addEventListener( 'load', function ( event ) {
 *
 * 		var geometry = event.content;
 * 		scene.add( new THREE.Mesh( geometry ) );
 *
 * 	} );
 * 	loader.load( './models/amf/slotted_disk.amf' );
 */

/*AMF SPECS breakdown:
* 1..N Objects
*--->1..1 Mesh 
*----->1..1 Vertices
*------->1..N Vertex
*--------->1..1 Coordinates
*--------->1..1 Color
*--------->1..1 Normal
*----->1..N Volumes (THREE.js geometry is at this level)
* 1--N Materials
*/

/*Algorithm
For each Object in amf
  ** CurrentMesh = new THREE.Mesh();
  grab vertex attributes (position, normal, color)
  ** CurrentGeomtry = new THREE.Geometry()
  grab volumes
    for each Volume
      grab triangles (vertex indices)
      add data to geometry
Problem !! Materials are defined AFTER volumes
BUT volumes can reference materials ...
*/

var detectEnv = require("composite-detect");

if(detectEnv.isNode) var THREE = require("three");
if(detectEnv.isBrowser) var THREE = window.THREE;
if(detectEnv.isModule) var JSZip = require( 'jszip' );
if(detectEnv.isModule) var sax = require( 'sax' );
if(detectEnv.isModule) var Q = require('q');

var AMF = require("./amf.js");

AMFParser = function () {
  this.outputs = ["geometry", "materials", "textures"]; //to be able to auto determine data type(s) fetched by parser

  this.defaultMaterialType = THREE.MeshPhongMaterial;//THREE.MeshLambertMaterial; //
	this.defaultColor = new THREE.Color( "#efefff" ); //#efefff //#00a9ff
  this.defaultShading = THREE.FlatShading;
  this.defaultSpecular = null;//0xffffff;
  this.defaultShininess = null;//99;

	this.defaultVertexNormal = new THREE.Vector3( 1, 1, 1 );
	this.recomputeNormals = true;
};

AMFParser.prototype = {
	constructor: AMFParser
};

AMFParser.prototype.parse = function(data, parameters)
{
  var parameters = parameters || {};
  var useWorker  = parameters.useWorker || false;
  var useBuffers = parameters.useBuffers || false;
  
  var deferred = Q.defer();  
  var rootObject = new THREE.Object3D();//TODO: change storage of data : ie don't put everything under a single object
  rootObject.name = "rootScene";
  
  //TODO: use these steps:
  /*
    - generate three.buffergeometry from raw data's meshes list
    - generate textures             from raw data's textures list
    - generate materials             from raw data's materials list
    - generate final assembly(ies)
  */
  //useWorker = false;
  var self = this;
  var startTime = new Date();
  var s = Date.now();
  console.log("in amf parser");
  
      function onDataLoaded( data )
    {
      if(data.constellations.length<1)
      {
        for(var i=0;i<data.objects.length;i++)
        {
          var modelData = data.objects[i];
          var model = self.createModelBuffers( modelData );
				  rootObject.add( model );
        }
      }
      else
      {
        //TODO:recurse through constellation
        for(var i=0;i<data.constellations[0].children.length;i++)
        {
          var child = data.constellations[0].children[i];
          var modelData = child.instance;
          var model = self.createModelBuffers( modelData );
          model.position.fromArray( child.pos );
				  model.rotation.set(child.rot[0],child.rot[1],child.rot[2]); 
				  rootObject.add( model );
        }
      }
    deferred.resolve( rootObject );
    }
  
  
	if ( useWorker ) {
	  var worker = new Worker((window.webkitURL || window.URL).createObjectURL(new Blob(['(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module \'"+o+"\'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){\nvar AMF = require("./amf.js");\n\nself.onmessage = function( event ) {\n  var data = event.data;\n  data = data.data;\n  \n  var amf = new AMF();\n  //var parsedData = \n   function callback(parsedData)\n  {\n    console.log("parsed data", parsedData);\n    self.postMessage( {data:parsedData});//, [parsedData]);\n    self.close();\n  }\n  function progress( data )\n  {\n    self.postMessage( data );\n  }\n  amf.load( data,callback,progress );\n\n  /*var vertices = result.vertices.buffer;\n  self.postMessage( {vertices:vertices, normals:normals}, [vertices,normals] );*/\n \n}\n\n},{"./amf.js":2}],2:[function(require,module,exports){\n(function (Buffer){\nvar detectEnv = require("composite-detect");\nif(detectEnv.isModule) var JSZip = require( \'jszip\' );\nif(detectEnv.isModule) var sax = require( \'sax\' );\n\nvar AMF = function () {\n\n  this.unit = null;\n  this.version = null;\n\n  //various data \n  var unit = null;\n  var version = null;\n\n  this.rootObject = {};\n  this.rootObject.children = [];\n  this.currentObject = {};\n  \n  this.materialsById = {};\n  \n  this.meshes = [];\n  this.objects = [];\n  this.textures = [];\n  this.materials = [];\n  this.constellations = [];\n  this.resultContainer = {};\n}\n\nAMF.prototype.load = function( data, callback, progressCallback ){\n  \n  var self = this;\n  function foo( data )\n  {\n    console.log("done unpacking data");\n    if(progressCallback)\n    {\n      progressCallback({progress:25});\n    }\n    \n    var parser = sax.parser(true,{trim:true}); // set first param to false for html-mode\n    self.setupSax( parser );\n    console.log("sax parser setup ok");\n    \n    var l = data.length, lc = 0, c = 0, chunkSize = l;\n    var chunk = "" \n  \n  parser.onready= function (tag) {\n    if( lc<l)\n    {\n      chunk = data.slice(lc, lc += chunkSize);\n      parser.write( chunk ).close();\n    }\n    else\n    {\n      if(callback)\n      {\n        self.resultContainer.meshes = self.meshes;\n        self.resultContainer.objects = self.objects;\n        self.resultContainer.textures = self.textures;\n        self.resultContainer.materials = self.materials;\n        self.resultContainer.constellations = self.constellations;\n        \n        if(progressCallback)\n        {\n          progressCallback({progress:75});\n        }\n        \n        var colorSize = 3;\n        \n        for(var z=0;z<self.objects.length;z++)\n        {\n          var obj = self.objects[z];\n          /*          \n          var total = obj._attributes["indices"].length;\n          var subLng = obj.volumes[0]._attributes["indices"].length;\n          var start = total- subLng;\n          //var remains = obj._attributes["indices"].splice(start + 1);\n          //obj._attributes["indices"] = remains;\n          console.log("removing from " + start + " length "+ subLng+" res "+obj._attributes["indices"].length);*/\n          var tmpPositions = [];\n          var tmpIndices= [];\n          var finalPositions = [];\n          //obj._attributes["posi"] = [];\n          \n          if(obj._attributes["vcolors"].length==0)\n          {\n            for(var c = 0;c<obj._attributes["position"].length;c+=3)\n            {\n              for(var i=0;i<colorSize;i++)\n              {\n                obj._attributes["vcolors"].push( i );\n              }\n            }\n          }\n          var colIndex=0;\n          for(var x=0;x<obj.volumes.length;x++)\n          {\n            var vol = obj.volumes[x];\n            console.log("volume " + x);\n            \n            for(var c = 0;c<vol._attributes["indices"].length;c++)\n            {\n              var iIndex = vol._attributes["indices"][c];\n              var index = (iIndex*3);\n              \n              tmpPositions.push( );\n              /*vol._attributes["position"].push( obj._attributes["position"][index] );\n              vol._attributes["position"].push( obj._attributes["position"][index+1] );\n              vol._attributes["position"].push( obj._attributes["position"][index+2] );*/\n              \n              /*tmpPositions.push( obj._attributes["position"][index] );\n              tmpPositions.push( obj._attributes["position"][index+1] );\n              tmpPositions.push( obj._attributes["position"][index+2] );*/\n            }\n                      \n            \n            //get vertex index, apply color//update existing color\n            if(vol.materialId)\n            {\n              var material = self.materialsById[vol.materialId];\n              if(material.color)\n              {\n                 var color = material.color;\n                 if(x == 1) color = [1,0,0,1];\n                 \n                 for(var c = 0;c<vol._attributes["indices"].length;c++)\n                  {\n                    var iIndex=vol._attributes["indices"][c];\n                    index = (iIndex*colorSize);\n                    if(index<0) index=0;\n                    obj._attributes["vcolors"][index] = color[0];\n                    obj._attributes["vcolors"][index+1] = color[1];\n                    obj._attributes["vcolors"][index+2] = color[2];\n                    //obj._attributes["vcolors"][index+3] = color[3];\n                  }\n              }\n            }\n          }\n          //self.generateObject();\n          //obj._attributes["position"] = tmpPositions;\n          //obj._attributes["position"] = finalPositions;\n          //obj._attributes["indices"] = tmpIndices;\n        }\n        \n        \n        console.log("DONE PARSING, result:",self.resultContainer); \n        callback( self.resultContainer );\n      }\n    }\n  }\n  chunk = data.slice(lc, lc += chunkSize);\n  parser.write( chunk ).close();\n  }\n  console.log("before unpack");\n  var data = this.unpack(data, foo);\n}\n\nAMF.prototype.unpack = function( data, callback )\n{\n  try\n  {\n    var zip = new JSZip(data);\n    for(var entryName in zip.files)\n    {\n      var entry = zip.files[entryName];\n      if( entry._data !== null && entry !== undefined) \n      {\n        var ab = entry.asArrayBuffer();\n        var blob = new Blob([ab]);\n        var reader = new FileReader();\n        reader.onload = function(e) {\n            var txt = e.target.result;\n            callback( txt );\n        };\n        reader.readAsText(blob);\n      }\n    }\n  }\n  catch(error){\n    callback( this.ensureString(data) );\n  }\n}\n\nAMF.prototype.ensureString = function (buf) {\n\n\tif (typeof buf !== "string"){\n\t\tvar array_buffer = new Uint8Array(buf);\n\t\tvar str = \'\';\n\t\tfor(var i = 0; i < buf.byteLength; i++) {\n\t\t\tstr += String.fromCharCode(array_buffer[i]); // implicitly assumes little-endian\n\t\t}\n\t\treturn str;\n\t} else {\n\t\treturn buf;\n\t}\n};\n\n\nAMF.prototype._generateObject = function( object )\n{\n    if(this.recomputeNormals)\n\t  {\n\t\t  //TODO: only do this, if no normals were specified???\n\t\t  object.geometry.computeFaceNormals();\n\t\t  object.geometry.computeVertexNormals();\n\t  }\n\t  //object.geometry.computeBoundingBox();\n\t  //object.geometry.computeBoundingSphere();\n\n    var color = this.defaultColor ;\n\t  /*var meshMaterial = new this.defaultMaterialType(\n\t  { \n      color: color,\n\t\t  //vertexColors: THREE.VertexColors, //TODO: add flags to dertermine if we need vertex or face colors\n      //vertexColors: THREE.FaceColors,\n      specular: this.defaultSpecular,\n      shininess: this.defaultShininess,\n\t\t  shading: this.defaultShading\n\t  } );\n\n    object.material = meshMaterial;*/\n    //console.log("finished Object / THREE.Mesh",currentObject)\n}\n\nAMF.prototype.setupSax = function( parser )\n{\n\n  var currentTag = null;\n  var currentItem = null;//pointer to currently active item/tag etc\n\n  var currentColor = null;\n  //\n  var currentMaterial = null;\n  //\n  var currentObject   = null;\n  var currentGeometry = null;\n  var currentVolume   = null;\n  var currentTriangle = null;\n  var currentVertex   = null;\n  var currentEdge = null;\n\n  var currentTexMap = null;\n  var currentTexture = null;\n\n  //logical grouping\n  var currentConstellation = null;\n  var currentObjectInstance = null;\n\n//TODO: oh ye gad\'s need to find a cleaner solution\n  var facesThatNeedMaterial = [];\n\n  //copy settings to local scope\n  var defaultColor = this.defaultColor;\n\tvar defaultVertexNormal = this.defaultVertexNormal;\n\tvar recomputeNormals = this.recomputeNormals;\n\n   //storage / temporary storage\n  //map amf object ids to our UUIDS\n  var objectsIdMap = {};\n  var objects = [];\n\n  var meshes = {};\n  var textures = {};\n  var materials = {};\n\n  var scope = this;  \n  var rootObject = this.rootObject;\n  \n  parser.onopentag = function (tag) {\n    // opened a tag.  node has "name" and "attributes"\n    tag.parent = currentTag;\n    currentTag = tag;\n    if(tag.parent) tag.parent[tag.name] = tag;\n  \n    switch(tag.name)\n    {\n      //general\n      case \'metadata\':\n        currentMeta = {};\n      break;\n      case \'amf\':\n        scope.unit = tag.attributes[\'unit\'];\n        scope.version = tag.attributes[\'version\'];\n        currentItem = rootObject;\n      break;\n\n      //geometry\n      case \'object\':\n        currentObject = {}//new THREE.Mesh();\n        var id = tag.attributes["id"] || null;\n        if(id) currentObject._id = id; objectsIdMap[id] = currentObject.uuid;\n        //temp storage:\n        currentObject._attributes =  {};\n        currentObject._attributes["position"] = [];\n        currentObject._attributes["normal"] = [];\n        currentObject._attributes["color"] = [];\n        currentObject._attributes["indices"] = [];\n        currentObject._attributes["vcolors"] = [];\n        currentObject.volumes = [];\n        currentObject.faceCount = 0;\n\n        currentItem = currentObject;\n      break;\n      case \'volume\':\n        currentVolume = {};\n        currentVolume._attributes =  {};\n        currentVolume._attributes["position"] = [];\n        currentVolume._attributes["indices"] = [];\n        currentVolume._attributes["normal"] = [];\n        currentVolume._attributes["color"] = [];\n        currentVolume._attributes["indices"] = [];\n        currentVolume._attributes["vcolors"] = [];\n        currentVolume.faceCount = 0;\n        \n        \n        var materialId = tag.attributes["materialid"] || null;\n        if(materialId) currentVolume.materialId = parseInt(materialId);\n        currentItem = currentVolume;\n      break;\n      case \'triangle\':\n        currentTriangle = {}\n        currentObject.faceCount +=1 ;\n      break;\n      case \'edge\':\n        currentEdge = {};\n      break;\n      //materials and textures\n      case \'material\':\n        currentMaterial = {};\n        var id = tag.attributes["id"] || null;\n        if(id) currentMaterial.id = parseInt(id);\n\n        currentItem = currentMaterial;\n      break;\n      case \'texture\':\n        currentTexture = {};\n        for( attrName in tag.attributes)\n        {\n          currentTexture[attrName] = tag.attributes[attrName];\n        }\n        currentItem = currentTexture;\n      break;\n\n      //constellation data\n      case \'constellation\':\n        currentConstellation = {};\n        currentConstellation.children=[];\n        var id = tag.attributes["id"] || null;\n        if(id) currentConstellation._id = id;\n      break;\n      case \'instance\':\n        currentObjectInstance = {};\n        var id = tag.attributes["objectid"] || null;\n        if(id) currentObjectInstance.id = id;\n      break;\n    }\n  };\n  parser.onclosetag = function (tag) {\n    switch(currentTag.name)\n    {\n      case "metadata":\n        if( currentItem )\n        {\n          var varName = currentTag.attributes["type"].toLowerCase();\n          currentItem[varName]= currentTag.value;\n          console.log("currentItem", currentTag, varName);\n        }\n        currentMeta = null;\n      break;\n\n      case "object":\n        scope._generateObject( currentObject );\n        meshes[currentObject._id] = currentObject;\n        scope.objects.push( currentObject );\n        scope.meshes.push( currentObject );\n        console.log("object done");\n        currentObject = null;\n      break;\n\n      case "volume"://per volume data (one volume == one three.js mesh)\n        currentObject.volumes.push( currentVolume );\n        currentVolume = null;\n      break;\n      \n      case "coordinates":\n        var vertexCoords = parseVector3(currentTag);\n        currentObject._attributes["position"].push( vertexCoords[0],vertexCoords[1],vertexCoords[2] );\n      break;\n\n      case "normal":\n        var vertexNormal = parseVector3(currentTag,"n", 1.0);\n        currentObject._attributes["normal"].push( vertexNormal[0],vertexNormal[1],vertexNormal[2] );\n      break;\n\n      case "color":\n      //WARNING !! color can be used not only inside objects but also materials etc\n       //order(descending): triangle, vertex, volume, object, material\n        var color = parseColor(currentTag);\n\n        if(currentObject && (!currentTriangle))  currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] );//vertex level\n        //if(currentObject) currentObject["color"]=  color; //object level\n        if(currentVolume) currentVolume["color"] = color;\n        if(currentTriangle) currentTriangle["color"] = color;\n        if(currentMaterial) currentMaterial["color"] = color;\n      break;\n\n       case "map":\n        for( attrName in currentTag.attributes)\n        {\n          currentTag[attrName] = currentTag.attributes[attrName];\n        }\n        var map = parseMapCoords( currentTag );\n        //console.log("closing map", currentTag);\n      break;\n\n      case "triangle":\n        var v1 = parseText( currentTag.v1.value ,"int" , 0);\n        var v2 = parseText( currentTag.v2.value ,"int" , 0);\n        var v3 = parseText( currentTag.v3.value ,"int" , 0);\n        currentObject._attributes["indices"].push( v1, v2, v3 );\n        currentVolume._attributes["indices"].push( v1, v2, v3 );\n\n        var colorData = currentObject._attributes["color"];\n        if(colorData.length>0)\n        {\n          var colors = [colorData[v1] ,colorData[v2], colorData[v3]];\n        }\n        else\n        {\n          var colors = [defaultColor,defaultColor, defaultColor];\n        }\n        var normalData = currentObject._attributes["normal"];\n        if(normalData.length>0)\n        {\n          var normals = [normalData[v1],normalData[v2],normalData[v3]];\n        }\n        else\n        {\n          var normals = [defaultVertexNormal,defaultVertexNormal, defaultVertexNormal];\n        }\n        //a, b, c, normal, color, materialIndex\n        /*var face = new THREE.Face3( v1, v2, v3 , normals);\n        //triangle, vertex, volume, object, material\n        //set default\n        face.color = defaultColor; \n        if( \'materialId\' in currentVolume) facesThatNeedMaterial.push({"matId":currentVolume.materialId,"item": face})\n        if(\'color\' in currentObject) face.color = currentObject["color"];  \n        if(\'color\' in currentVolume) face.color = currentVolume["color"];  \n        if(\'color\' in currentTriangle) face.color = currentTriangle["color"] ;\n        \n        currentTriangle = null;\n        //FIXME:\n        //currentObject.geometry.faces.push(face);\n        */\n        var color = [0,0,0,1];\n        if(\'color\' in currentTriangle) {\n        color = currentTriangle["color"];\n                currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] );\n        }\n\n        \n      break;\n\n      case "edge":\n        console.log("getting edge data");\n        //Specifies the 3D tangent of an object edge between two vertices \n        //higher priority than normals data\n        var v1 = parseText( currentTag.v1.value , "v", "int" , null);\n        var v2 = parseText( currentTag.v2.value , "v", "int" , null);\n\n        var dx1 = parseText( currentTag.dx1.value , "d", "int" , 0);\n        var dy1 = parseText( currentTag.dy1.value , "d", "int" , 0);\n        var dz1 = parseText( currentTag.dz1.value , "d", "int" , 0);\n\n        var dx2 = parseText( currentTag.dx2.value , "d", "int" , 0);\n        var dy2 = parseText( currentTag.dy2.value , "d", "int" , 0);\n        var dz2 = parseText( currentTag.dz2.value , "d", "int" , 0);\n\n        console.log("built edge v1", v1,dx1, dy1, dz1 ,"v2",v2,dx2, dy2, dz2);\n        currentEdge = null;\n      break;\n\n      //materials and textures    \n      case "material":\n          console.log("getting material data");\n          scope.materialsById[currentMaterial.id] = currentMaterial;\n          scope.materials.push( currentMaterial );\n          currentMaterial = null;\n      break;\n      case "texture":\n          console.log("getting texture data");\n          currentTexture.imgData = currentTag.value;\n          textures[currentTexture.id] = scope._parseTexture(currentTexture);\n          currentTexture = null;\n      break;\n      //constellation\n      case "constellation":\n          scope.constellations.push( currentConstellation );\n          console.log("done with constellation");\n          currentConstellation = null;\n      break;\n      case "instance":\n          var position = parseVector3(currentTag, "delta",0.0);\n          var rotation = parseVector3(currentTag, "r", 1.0);\n\n          var objectId= currentObjectInstance.id;\n          var meshInstance = meshes[objectId];\n\t\t\t\t  var meshInstanceData = {instance:meshInstance,pos:position,rot:rotation};\n          currentConstellation.children.push( meshInstanceData );\n          currentObjectInstance = null;\n          //console.log("closing instance",objectId, "posOffset",position,"rotOffset",rotation);\n      break;\n\n    }\n    currentItem = null;\n    if (currentTag && currentTag.parent) {\n      var p = currentTag.parent\n      delete currentTag.parent\n      currentTag = p\n    }\n  }\n\n  parser.onattribute = function (attr) {\n    // an attribute.  attr has "name" and "value"\n    //if(currentItem) console.log("currentItem + attr",currentItem, attr)\n    if(currentItem) currentItem[attr.name]= attr.value;\n  };\n  parser.ontext = function (text) {\n    if (currentTag) currentTag.value = text;\n    //if (currentTag && currentTag.parent) currentTag.parent.value = text;\n    //console.log("text", currentTag.parent);\n  }\n\n  parser.onerror = function(error)\n  { \n      console.log("error in parser")\n      //console.log(error);\n      //throw error;\n      parser.resume();\n  }\n\n  /*parser.onend = function () {// parser stream is done, and ready to have more stuff written to it.\n    console.log("THE END");\n    //scope._generateScene();\n    //scope._applyMaterials(materials, textures, meshes,facesThatNeedMaterial);\n  };*/\n}\n\n\nAMF.prototype._parseTexture = function ( textureData ){\n\tvar rawImg = textureData.imgData;\n  //\'data:image/png;base64,\'+\n  /*Spec says  : \n  The data will be encoded string of bytes in Base64 encoding, as grayscale values.\n  Grayscale will be encoded as a string of individual bytes, one per pixel, \n  specifying the grayscale level in the 0-255 range : \n  how to handle grayscale combos?*/\n  //Since textures are grayscale, and one per channel (r,g,b), we need to combine all three to get data\n\n  /*rawImg = \'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB90RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgOLVo0ngAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMjgvMTGdjbKfAAABwklEQVQ4jdXUsWrjQBCA4X+11spikXAEUWdSuUjh5goXx1V5snu4kMLgyoEUgYNDhUHGsiNbCK200hWXFI7iOIEUd9Mu87E7MzsC6PjCcL4S+z/AwXuHQgg8T6GUi+MI2rbDmJqqMnTd26U/CXqeRxD4aO2ilIOUAms7jGkpipr9vqSqqo+BnudxcaEZjRRx7DIeK7SWFIUlSQxpKhkMHLZbemgPFEIQBD6jkeL62mc2u2QyuSIMA/J8z+Pjb+bzNQ8P0DTtedDzFFq7xLHLbHbJzc0PptPv+H5EWWYsl3fALZvNirK05LnCGHMaVOpvzcZjxWRy9Yx9A2J8P2U6hSRJuL/fsFoZhsNjsDc2jiOQUqC1JAwDfD8CYkA/oxFhGKC1REqB44jj/Ndg23ZY21EUljzfU5YZkAIFkFKWGXm+pygs1nbUdXOUL4Gfr5vi+wohBFFk0VoQRQNcN6Msf7Fc3rFYLFksnsiymu22oG3b0zWsKkNR1KSpZD5fA7ckSdLrcprWHA6Gpjm+oeCNbXN+Dmt2O8N6/YS19jz4gp76KYeDYbc79LB3wZdQSjEcKhxHUNcNVVX3nvkp8LPx7+/DP92w3rYV8ocfAAAAAElFTkSuQmCC\';*/\n\n  if(detectEnv.isNode)\n  {\n    function btoa(str) {\n      var buffer;\n      if (str instanceof Buffer) {\n        buffer = str;\n      } else {\n        buffer = new Buffer(str.toString(), \'binary\');\n      }\n      return buffer.toString(\'base64\');\n    }\n    rawImg = btoa(rawImg);\n  }\n  else\n  {\n    rawImg = btoa(rawImg);\n    /*var image = document.createElement( \'img\' );\n    image.src = rawImg;\n    var texture = new THREE.Texture( image );*/\n  }\n  /*var texture = new THREE.DataTexture( rawImg, parseText(textureData.width,"int",256) , parseText(textureData.height,"int",256), THREE.RGBAFormat );\n  texture.needsUpdate = true;*/\n\t\n\tvar id = textureData.id;\n\tvar type = textureData.type;\n\tvar tiling= textureData.tiled;\n  var depth = parseText(textureData.depth,"int",1) ;\n\t\n  console.log("texture data", id, type, tiling,depth );\n\treturn textureData;\n}\n\n///\n\nAMF.prototype._applyMaterials = function(materials, textures, meshes, facesThatNeedMaterial)\n{//since materials are usually defined after objects/ volumes, we need to apply\n  //materials to those that need them\n  for(var i = 0 ; i<facesThatNeedMaterial.length; i++)\n  {\n      var curFace = facesThatNeedMaterial[i];\n      var mat = materials[curFace.matId];\n      curFace.item.color = mat.color;\n      curFace.item.vertexColors = [];\n      //console.log("curFace",curFace.item);\n  }\n\n  /*\n  if(Object.keys(this.textures).length>0)\n\t{\n\t\tvar materialArray = [];\n\t\tfor (var textureIndex in textures)\n\t\t{\n\t\t\tvar texture = this.textures[textureIndex];\n\t\t\tmaterialArray.push(new THREE.MeshBasicMaterial({\n\t\t\t\tmap: texture,\n\t\t\t\tcolor: color,\n\t\t\t\tvertexColors: THREE.VertexColors\n\t\t\t\t}));\n    }\n    currentMaterial = new THREE.MeshFaceMaterial(materialArray);\n  }*/\n}\n\n\n\n\n\n  function parseText( value, toType , defaultValue)\n\t{\n\t\tdefaultValue = defaultValue || null;\n\n\t\tif( value !== null && value !== undefined )\n\t\t{\n\t\t\tswitch(toType)\n\t\t\t{\n\t\t\t\tcase "float":\n\t\t\t\t\tvalue = parseFloat(value);\n\t\t\t\tbreak;\n\t\t\t\tcase "int":\n\t\t\t\t\tvalue = parseInt(value);\n        break;\n\t\t\t\t//default:\n\t\t\t}\n\t\t}\n\t\telse if (defaultValue !== null)\n\t\t{\n\t\t\tvalue = defaultValue;\n\t\t}\n\t\treturn value;\n\t}\n\n\tfunction parseColor( node , defaultValue)\n\t{\n\t\tvar color = defaultValue || null; //var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");\n\n\t\tvar r = parseText( node.r.value , "float",1.0);\n\t\tvar g = parseText( node.g.value , "float", 1.0);\n\t\tvar b = parseText( node.b.value , "float", 1.0);\n\t  var a = ("a" in node) ? parseText( node.a.value , "float", 1.0) : 1.0;\n    var color = [r,g,b,a];\n\t\treturn color;\n\t}\n\n\tfunction parseVector3( node, prefix, defaultValue )\n\t{\n\t\tvar coords = null;\n    var prefix =  prefix || "" ;\n    var defaultValue = defaultValue || 0.0;\n\n    var x = (prefix+"x" in node) ? parseText( node[prefix+"x"].value, "float" , defaultValue) : defaultValue;\n    var y = (prefix+"y" in node) ? parseText( node[prefix+"y"].value, "float" , defaultValue) : defaultValue;\n    var z = (prefix+"z" in node) ? parseText( node[prefix+"z"].value, "float" , defaultValue) : defaultValue;\n    //var coords = new THREE.Vector3(x,y,z);\n    var coords = [x,y,z];\n\t\treturn coords;\n\t}\n\n  function parseMapCoords( node, prefix, defaultValue)\n  {\n    //console.log("parsing map coords", node, ("btexid" in node) , node.btexid);\n    //get vertex UVs (optional)\n    //rtexid, gtexid, btexid\n    \n    var rtexid = ("rtexid" in node) ? parseText( node["rtexid"], "int" , null) : null;\n\t  var gtexid = ("gtexid" in node) ? parseText( node["gtexid"], "int" , defaultValue) : null;\n\t\tvar btexid = ("btexid" in node) ? parseText( node["btexid"], "int" , defaultValue) : null;\n\n    var u1 = ("u1" in node) ? parseText( node["u1"].value, "float" , defaultValue) : null;\n\t  var u2 = ("u2" in node) ? parseText( node["u2"].value, "float" , defaultValue) : null;\n\t\tvar u3 = ("u3" in node) ? parseText( node["u3"].value, "float" , defaultValue) : null;\n\n    var v1 = ("v1" in node) ? parseText( node["v1"].value, "float" , defaultValue) : null;\n\t  var v2 = ("v2" in node) ? parseText( node["v2"].value, "float" , defaultValue) : null;\n\t\tvar v3 = ("v3" in node) ? parseText( node["v3"].value, "float" , defaultValue) : null;\n\n    //console.log("textures ids", rtexid,gtexid,btexid,"coords", u1,u2,u3,"/", v1,v2,v3);\n    //face.materialIndex  = rtexid;\n\t\t//face.materialIndex  = 0;\n\n\t\tvar uv1 = (u1 !== null && v1 !=null) ? [u1,v1] : null;\n\t\tvar uv2 = (u2 !== null && v2 !=null) ? [u2,v2] : null; \n\t  var uv3 = (u3 !== null && v3 !=null) ? [u3,v3] : null;\n\t\t\n    var mappingData = {matId:0, uvs:[uv1,uv2,uv3]};\n    //currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3]);\n    return mappingData;\n  }\n\n  function parseExpression( expr)\n  {//This is for "maths" expression for materials, colors etc :TODO: implement\n\n  }\n  \n  \n\n\nmodule.exports = AMF;\n\n}).call(this,require("buffer").Buffer)\n},{"buffer":24,"composite-detect":3,"jszip":12,"sax":23}],3:[function(require,module,exports){\n(function (process){\n(function () {\n  // Hueristics.\n  var isNode = typeof process !== \'undefined\' && process.versions && !!process.versions.node;\n  var isBrowser = typeof window !== \'undefined\';\n  var isModule = typeof module !== \'undefined\' && !!module.exports;\n\n  // Export.\n  var detect = (isModule ? exports : (this.detect = {}));\n  detect.isNode = isNode;\n  detect.isBrowser = isBrowser;\n  detect.isModule = isModule;\n}).call(this);\n}).call(this,require("/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/workerify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))\n},{"/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/workerify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":29}],4:[function(require,module,exports){\n// private property\nvar _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";\n\n\n// public method for encoding\nexports.encode = function(input, utf8) {\n    var output = "";\n    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;\n    var i = 0;\n\n    while (i < input.length) {\n\n        chr1 = input.charCodeAt(i++);\n        chr2 = input.charCodeAt(i++);\n        chr3 = input.charCodeAt(i++);\n\n        enc1 = chr1 >> 2;\n        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);\n        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);\n        enc4 = chr3 & 63;\n\n        if (isNaN(chr2)) {\n            enc3 = enc4 = 64;\n        }\n        else if (isNaN(chr3)) {\n            enc4 = 64;\n        }\n\n        output = output + _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);\n\n    }\n\n    return output;\n};\n\n// public method for decoding\nexports.decode = function(input, utf8) {\n    var output = "";\n    var chr1, chr2, chr3;\n    var enc1, enc2, enc3, enc4;\n    var i = 0;\n\n    input = input.replace(/[^A-Za-z0-9\\+\\/\\=]/g, "");\n\n    while (i < input.length) {\n\n        enc1 = _keyStr.indexOf(input.charAt(i++));\n        enc2 = _keyStr.indexOf(input.charAt(i++));\n        enc3 = _keyStr.indexOf(input.charAt(i++));\n        enc4 = _keyStr.indexOf(input.charAt(i++));\n\n        chr1 = (enc1 << 2) | (enc2 >> 4);\n        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);\n        chr3 = ((enc3 & 3) << 6) | enc4;\n\n        output = output + String.fromCharCode(chr1);\n\n        if (enc3 != 64) {\n            output = output + String.fromCharCode(chr2);\n        }\n        if (enc4 != 64) {\n            output = output + String.fromCharCode(chr3);\n        }\n\n    }\n\n    return output;\n\n};\n\n},{}],5:[function(require,module,exports){\nfunction CompressedObject() {\n    this.compressedSize = 0;\n    this.uncompressedSize = 0;\n    this.crc32 = 0;\n    this.compressionMethod = null;\n    this.compressedContent = null;\n}\n\nCompressedObject.prototype = {\n    /**\n     * Return the decompressed content in an unspecified format.\n     * The format will depend on the decompressor.\n     * @return {Object} the decompressed content.\n     */\n    getContent: function() {\n        return null; // see implementation\n    },\n    /**\n     * Return the compressed content in an unspecified format.\n     * The format will depend on the compressed conten source.\n     * @return {Object} the compressed content.\n     */\n    getCompressedContent: function() {\n        return null; // see implementation\n    }\n};\nmodule.exports = CompressedObject;\n\n},{}],6:[function(require,module,exports){\nexports.STORE = {\n    magic: "\\x00\\x00",\n    compress: function(content) {\n        return content; // no compression\n    },\n    uncompress: function(content) {\n        return content; // no compression\n    },\n    compressInputType: null,\n    uncompressInputType: null\n};\nexports.DEFLATE = require(\'./flate\');\n\n},{"./flate":10}],7:[function(require,module,exports){\nvar utils = require(\'./utils\');\n\nfunction DataReader(data) {\n    this.data = null; // type : see implementation\n    this.length = 0;\n    this.index = 0;\n}\nDataReader.prototype = {\n    /**\n     * Check that the offset will not go too far.\n     * @param {string} offset the additional offset to check.\n     * @throws {Error} an Error if the offset is out of bounds.\n     */\n    checkOffset: function(offset) {\n        this.checkIndex(this.index + offset);\n    },\n    /**\n     * Check that the specifed index will not be too far.\n     * @param {string} newIndex the index to check.\n     * @throws {Error} an Error if the index is out of bounds.\n     */\n    checkIndex: function(newIndex) {\n        if (this.length < newIndex || newIndex < 0) {\n            throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");\n        }\n    },\n    /**\n     * Change the index.\n     * @param {number} newIndex The new index.\n     * @throws {Error} if the new index is out of the data.\n     */\n    setIndex: function(newIndex) {\n        this.checkIndex(newIndex);\n        this.index = newIndex;\n    },\n    /**\n     * Skip the next n bytes.\n     * @param {number} n the number of bytes to skip.\n     * @throws {Error} if the new index is out of the data.\n     */\n    skip: function(n) {\n        this.setIndex(this.index + n);\n    },\n    /**\n     * Get the byte at the specified index.\n     * @param {number} i the index to use.\n     * @return {number} a byte.\n     */\n    byteAt: function(i) {\n        // see implementations\n    },\n    /**\n     * Get the next number with a given byte size.\n     * @param {number} size the number of bytes to read.\n     * @return {number} the corresponding number.\n     */\n    readInt: function(size) {\n        var result = 0,\n            i;\n        this.checkOffset(size);\n        for (i = this.index + size - 1; i >= this.index; i--) {\n            result = (result << 8) + this.byteAt(i);\n        }\n        this.index += size;\n        return result;\n    },\n    /**\n     * Get the next string with a given byte size.\n     * @param {number} size the number of bytes to read.\n     * @return {string} the corresponding string.\n     */\n    readString: function(size) {\n        return utils.transformTo("string", this.readData(size));\n    },\n    /**\n     * Get raw data without conversion, <size> bytes.\n     * @param {number} size the number of bytes to read.\n     * @return {Object} the raw data, implementation specific.\n     */\n    readData: function(size) {\n        // see implementations\n    },\n    /**\n     * Find the last occurence of a zip signature (4 bytes).\n     * @param {string} sig the signature to find.\n     * @return {number} the index of the last occurence, -1 if not found.\n     */\n    lastIndexOfSignature: function(sig) {\n        // see implementations\n    },\n    /**\n     * Get the next date.\n     * @return {Date} the date.\n     */\n    readDate: function() {\n        var dostime = this.readInt(4);\n        return new Date(\n        ((dostime >> 25) & 0x7f) + 1980, // year\n        ((dostime >> 21) & 0x0f) - 1, // month\n        (dostime >> 16) & 0x1f, // day\n        (dostime >> 11) & 0x1f, // hour\n        (dostime >> 5) & 0x3f, // minute\n        (dostime & 0x1f) << 1); // second\n    }\n};\nmodule.exports = DataReader;\n\n},{"./utils":20}],8:[function(require,module,exports){\nexports.base64 = false;\nexports.binary = false;\nexports.dir = false;\nexports.date = null;\nexports.compression = null;\n},{}],9:[function(require,module,exports){\nvar context = {};\n(function() {\n\n    // https://github.com/imaya/zlib.js\n    // tag 0.1.6\n    // file bin/deflate.min.js\n\n    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */\n    (function() {\n        \'use strict\';\n        var n = void 0,\n            u = !0,\n            aa = this;\n\n        function ba(e, d) {\n            var c = e.split("."),\n                f = aa;\n            !(c[0] in f) && f.execScript && f.execScript("var " + c[0]);\n            for (var a; c.length && (a = c.shift());)!c.length && d !== n ? f[a] = d : f = f[a] ? f[a] : f[a] = {}\n        };\n        var C = "undefined" !== typeof Uint8Array && "undefined" !== typeof Uint16Array && "undefined" !== typeof Uint32Array;\n\n        function K(e, d) {\n            this.index = "number" === typeof d ? d : 0;\n            this.d = 0;\n            this.buffer = e instanceof(C ? Uint8Array : Array) ? e : new(C ? Uint8Array : Array)(32768);\n            if (2 * this.buffer.length <= this.index) throw Error("invalid index");\n            this.buffer.length <= this.index && ca(this)\n        }\n        function ca(e) {\n            var d = e.buffer,\n                c, f = d.length,\n                a = new(C ? Uint8Array : Array)(f << 1);\n            if (C) a.set(d);\n            else for (c = 0; c < f; ++c) a[c] = d[c];\n            return e.buffer = a\n        }\n        K.prototype.a = function(e, d, c) {\n            var f = this.buffer,\n                a = this.index,\n                b = this.d,\n                k = f[a],\n                m;\n            c && 1 < d && (e = 8 < d ? (L[e & 255] << 24 | L[e >>> 8 & 255] << 16 | L[e >>> 16 & 255] << 8 | L[e >>> 24 & 255]) >> 32 - d : L[e] >> 8 - d);\n            if (8 > d + b) k = k << d | e, b += d;\n            else for (m = 0; m < d; ++m) k = k << 1 | e >> d - m - 1 & 1, 8 === ++b && (b = 0, f[a++] = L[k], k = 0, a === f.length && (f = ca(this)));\n            f[a] = k;\n            this.buffer = f;\n            this.d = b;\n            this.index = a\n        };\n        K.prototype.finish = function() {\n            var e = this.buffer,\n                d = this.index,\n                c;\n            0 < this.d && (e[d] <<= 8 - this.d, e[d] = L[e[d]], d++);\n            C ? c = e.subarray(0, d) : (e.length = d, c = e);\n            return c\n        };\n        var ga = new(C ? Uint8Array : Array)(256),\n            M;\n        for (M = 0; 256 > M; ++M) {\n            for (var R = M, S = R, ha = 7, R = R >>> 1; R; R >>>= 1) S <<= 1, S |= R & 1, --ha;\n            ga[M] = (S << ha & 255) >>> 0\n        }\n        var L = ga;\n\n        function ja(e) {\n            this.buffer = new(C ? Uint16Array : Array)(2 * e);\n            this.length = 0\n        }\n        ja.prototype.getParent = function(e) {\n            return 2 * ((e - 2) / 4 | 0)\n        };\n        ja.prototype.push = function(e, d) {\n            var c, f, a = this.buffer,\n                b;\n            c = this.length;\n            a[this.length++] = d;\n            for (a[this.length++] = e; 0 < c;) if (f = this.getParent(c), a[c] > a[f]) b = a[c], a[c] = a[f], a[f] = b, b = a[c + 1], a[c + 1] = a[f + 1], a[f + 1] = b, c = f;\n            else break;\n            return this.length\n        };\n        ja.prototype.pop = function() {\n            var e, d, c = this.buffer,\n                f, a, b;\n            d = c[0];\n            e = c[1];\n            this.length -= 2;\n            c[0] = c[this.length];\n            c[1] = c[this.length + 1];\n            for (b = 0;;) {\n                a = 2 * b + 2;\n                if (a >= this.length) break;\n                a + 2 < this.length && c[a + 2] > c[a] && (a += 2);\n                if (c[a] > c[b]) f = c[b], c[b] = c[a], c[a] = f, f = c[b + 1], c[b + 1] = c[a + 1], c[a + 1] = f;\n                else break;\n                b = a\n            }\n            return {\n                index: e,\n                value: d,\n                length: this.length\n            }\n        };\n\n        function ka(e, d) {\n            this.e = ma;\n            this.f = 0;\n            this.input = C && e instanceof Array ? new Uint8Array(e) : e;\n            this.c = 0;\n            d && (d.lazy && (this.f = d.lazy), "number" === typeof d.compressionType && (this.e = d.compressionType), d.outputBuffer && (this.b = C && d.outputBuffer instanceof Array ? new Uint8Array(d.outputBuffer) : d.outputBuffer), "number" === typeof d.outputIndex && (this.c = d.outputIndex));\n            this.b || (this.b = new(C ? Uint8Array : Array)(32768))\n        }\n        var ma = 2,\n            T = [],\n            U;\n        for (U = 0; 288 > U; U++) switch (u) {\n        case 143 >= U:\n            T.push([U + 48, 8]);\n            break;\n        case 255 >= U:\n            T.push([U - 144 + 400, 9]);\n            break;\n        case 279 >= U:\n            T.push([U - 256 + 0, 7]);\n            break;\n        case 287 >= U:\n            T.push([U - 280 + 192, 8]);\n            break;\n        default:\n            throw "invalid literal: " + U;\n        }\n        ka.prototype.h = function() {\n            var e, d, c, f, a = this.input;\n            switch (this.e) {\n            case 0:\n                c = 0;\n                for (f = a.length; c < f;) {\n                    d = C ? a.subarray(c, c + 65535) : a.slice(c, c + 65535);\n                    c += d.length;\n                    var b = d,\n                        k = c === f,\n                        m = n,\n                        g = n,\n                        p = n,\n                        v = n,\n                        x = n,\n                        l = this.b,\n                        h = this.c;\n                    if (C) {\n                        for (l = new Uint8Array(this.b.buffer); l.length <= h + b.length + 5;) l = new Uint8Array(l.length << 1);\n                        l.set(this.b)\n                    }\n                    m = k ? 1 : 0;\n                    l[h++] = m | 0;\n                    g = b.length;\n                    p = ~g + 65536 & 65535;\n                    l[h++] = g & 255;\n                    l[h++] = g >>> 8 & 255;\n                    l[h++] = p & 255;\n                    l[h++] = p >>> 8 & 255;\n                    if (C) l.set(b, h), h += b.length, l = l.subarray(0, h);\n                    else {\n                        v = 0;\n                        for (x = b.length; v < x; ++v) l[h++] = b[v];\n                        l.length = h\n                    }\n                    this.c = h;\n                    this.b = l\n                }\n                break;\n            case 1:\n                var q = new K(C ? new Uint8Array(this.b.buffer) : this.b, this.c);\n                q.a(1, 1, u);\n                q.a(1, 2, u);\n                var t = na(this, a),\n                    w, da, z;\n                w = 0;\n                for (da = t.length; w < da; w++) if (z = t[w], K.prototype.a.apply(q, T[z]), 256 < z) q.a(t[++w], t[++w], u), q.a(t[++w], 5), q.a(t[++w], t[++w], u);\n                else if (256 === z) break;\n                this.b = q.finish();\n                this.c = this.b.length;\n                break;\n            case ma:\n                var B = new K(C ? new Uint8Array(this.b.buffer) : this.b, this.c),\n                    ra, J, N, O, P, Ia = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],\n                    W, sa, X, ta, ea, ia = Array(19),\n                    ua, Q, fa, y, va;\n                ra = ma;\n                B.a(1, 1, u);\n                B.a(ra, 2, u);\n                J = na(this, a);\n                W = oa(this.j, 15);\n                sa = pa(W);\n                X = oa(this.i, 7);\n                ta = pa(X);\n                for (N = 286; 257 < N && 0 === W[N - 1]; N--);\n                for (O = 30; 1 < O && 0 === X[O - 1]; O--);\n                var wa = N,\n                    xa = O,\n                    F = new(C ? Uint32Array : Array)(wa + xa),\n                    r, G, s, Y, E = new(C ? Uint32Array : Array)(316),\n                    D, A, H = new(C ? Uint8Array : Array)(19);\n                for (r = G = 0; r < wa; r++) F[G++] = W[r];\n                for (r = 0; r < xa; r++) F[G++] = X[r];\n                if (!C) {\n                    r = 0;\n                    for (Y = H.length; r < Y; ++r) H[r] = 0\n                }\n                r = D = 0;\n                for (Y = F.length; r < Y; r += G) {\n                    for (G = 1; r + G < Y && F[r + G] === F[r]; ++G);\n                    s = G;\n                    if (0 === F[r]) if (3 > s) for (; 0 < s--;) E[D++] = 0,\n                    H[0]++;\n                    else for (; 0 < s;) A = 138 > s ? s : 138, A > s - 3 && A < s && (A = s - 3), 10 >= A ? (E[D++] = 17, E[D++] = A - 3, H[17]++) : (E[D++] = 18, E[D++] = A - 11, H[18]++), s -= A;\n                    else if (E[D++] = F[r], H[F[r]]++, s--, 3 > s) for (; 0 < s--;) E[D++] = F[r], H[F[r]]++;\n                    else for (; 0 < s;) A = 6 > s ? s : 6, A > s - 3 && A < s && (A = s - 3), E[D++] = 16, E[D++] = A - 3, H[16]++, s -= A\n                }\n                e = C ? E.subarray(0, D) : E.slice(0, D);\n                ea = oa(H, 7);\n                for (y = 0; 19 > y; y++) ia[y] = ea[Ia[y]];\n                for (P = 19; 4 < P && 0 === ia[P - 1]; P--);\n                ua = pa(ea);\n                B.a(N - 257, 5, u);\n                B.a(O - 1, 5, u);\n                B.a(P - 4, 4, u);\n                for (y = 0; y < P; y++) B.a(ia[y], 3, u);\n                y = 0;\n                for (va = e.length; y < va; y++) if (Q = e[y], B.a(ua[Q], ea[Q], u), 16 <= Q) {\n                    y++;\n                    switch (Q) {\n                    case 16:\n                        fa = 2;\n                        break;\n                    case 17:\n                        fa = 3;\n                        break;\n                    case 18:\n                        fa = 7;\n                        break;\n                    default:\n                        throw "invalid code: " + Q;\n                    }\n                    B.a(e[y], fa, u)\n                }\n                var ya = [sa, W],\n                    za = [ta, X],\n                    I, Aa, Z, la, Ba, Ca, Da, Ea;\n                Ba = ya[0];\n                Ca = ya[1];\n                Da = za[0];\n                Ea = za[1];\n                I = 0;\n                for (Aa = J.length; I < Aa; ++I) if (Z = J[I], B.a(Ba[Z], Ca[Z], u), 256 < Z) B.a(J[++I], J[++I], u), la = J[++I], B.a(Da[la], Ea[la], u), B.a(J[++I], J[++I], u);\n                else if (256 === Z) break;\n                this.b = B.finish();\n                this.c = this.b.length;\n                break;\n            default:\n                throw "invalid compression type";\n            }\n            return this.b\n        };\n\n        function qa(e, d) {\n            this.length = e;\n            this.g = d\n        }\n        var Fa = function() {\n            function e(a) {\n                switch (u) {\n                case 3 === a:\n                    return [257, a - 3, 0];\n                case 4 === a:\n                    return [258, a - 4, 0];\n                case 5 === a:\n                    return [259, a - 5, 0];\n                case 6 === a:\n                    return [260, a - 6, 0];\n                case 7 === a:\n                    return [261, a - 7, 0];\n                case 8 === a:\n                    return [262, a - 8, 0];\n                case 9 === a:\n                    return [263, a - 9, 0];\n                case 10 === a:\n                    return [264, a - 10, 0];\n                case 12 >= a:\n                    return [265, a - 11, 1];\n                case 14 >= a:\n                    return [266, a - 13, 1];\n                case 16 >= a:\n                    return [267, a - 15, 1];\n                case 18 >= a:\n                    return [268, a - 17, 1];\n                case 22 >= a:\n                    return [269, a - 19, 2];\n                case 26 >= a:\n                    return [270, a - 23, 2];\n                case 30 >= a:\n                    return [271, a - 27, 2];\n                case 34 >= a:\n                    return [272,\n                    a - 31, 2];\n                case 42 >= a:\n                    return [273, a - 35, 3];\n                case 50 >= a:\n                    return [274, a - 43, 3];\n                case 58 >= a:\n                    return [275, a - 51, 3];\n                case 66 >= a:\n                    return [276, a - 59, 3];\n                case 82 >= a:\n                    return [277, a - 67, 4];\n                case 98 >= a:\n                    return [278, a - 83, 4];\n                case 114 >= a:\n                    return [279, a - 99, 4];\n                case 130 >= a:\n                    return [280, a - 115, 4];\n                case 162 >= a:\n                    return [281, a - 131, 5];\n                case 194 >= a:\n                    return [282, a - 163, 5];\n                case 226 >= a:\n                    return [283, a - 195, 5];\n                case 257 >= a:\n                    return [284, a - 227, 5];\n                case 258 === a:\n                    return [285, a - 258, 0];\n                default:\n                    throw "invalid length: " + a;\n                }\n            }\n            var d = [],\n                c, f;\n            for (c = 3; 258 >= c; c++) f = e(c), d[c] = f[2] << 24 | f[1] << 16 | f[0];\n            return d\n        }(),\n            Ga = C ? new Uint32Array(Fa) : Fa;\n\n        function na(e, d) {\n            function c(a, c) {\n                var b = a.g,\n                    d = [],\n                    f = 0,\n                    e;\n                e = Ga[a.length];\n                d[f++] = e & 65535;\n                d[f++] = e >> 16 & 255;\n                d[f++] = e >> 24;\n                var g;\n                switch (u) {\n                case 1 === b:\n                    g = [0, b - 1, 0];\n                    break;\n                case 2 === b:\n                    g = [1, b - 2, 0];\n                    break;\n                case 3 === b:\n                    g = [2, b - 3, 0];\n                    break;\n                case 4 === b:\n                    g = [3, b - 4, 0];\n                    break;\n                case 6 >= b:\n                    g = [4, b - 5, 1];\n                    break;\n                case 8 >= b:\n                    g = [5, b - 7, 1];\n                    break;\n                case 12 >= b:\n                    g = [6, b - 9, 2];\n                    break;\n                case 16 >= b:\n                    g = [7, b - 13, 2];\n                    break;\n                case 24 >= b:\n                    g = [8, b - 17, 3];\n                    break;\n                case 32 >= b:\n                    g = [9, b - 25, 3];\n                    break;\n                case 48 >= b:\n                    g = [10, b - 33, 4];\n                    break;\n                case 64 >= b:\n                    g = [11, b - 49, 4];\n                    break;\n                case 96 >= b:\n                    g = [12, b - 65, 5];\n                    break;\n                case 128 >= b:\n                    g = [13, b - 97, 5];\n                    break;\n                case 192 >= b:\n                    g = [14, b - 129, 6];\n                    break;\n                case 256 >= b:\n                    g = [15, b - 193, 6];\n                    break;\n                case 384 >= b:\n                    g = [16, b - 257, 7];\n                    break;\n                case 512 >= b:\n                    g = [17, b - 385, 7];\n                    break;\n                case 768 >= b:\n                    g = [18, b - 513, 8];\n                    break;\n                case 1024 >= b:\n                    g = [19, b - 769, 8];\n                    break;\n                case 1536 >= b:\n                    g = [20, b - 1025, 9];\n                    break;\n                case 2048 >= b:\n                    g = [21, b - 1537, 9];\n                    break;\n                case 3072 >= b:\n                    g = [22, b - 2049, 10];\n                    break;\n                case 4096 >= b:\n                    g = [23, b - 3073, 10];\n                    break;\n                case 6144 >= b:\n                    g = [24, b - 4097, 11];\n                    break;\n                case 8192 >= b:\n                    g = [25, b - 6145, 11];\n                    break;\n                case 12288 >= b:\n                    g = [26, b - 8193, 12];\n                    break;\n                case 16384 >= b:\n                    g = [27, b - 12289, 12];\n                    break;\n                case 24576 >= b:\n                    g = [28, b - 16385, 13];\n                    break;\n                case 32768 >= b:\n                    g = [29, b - 24577, 13];\n                    break;\n                default:\n                    throw "invalid distance";\n                }\n                e = g;\n                d[f++] = e[0];\n                d[f++] = e[1];\n                d[f++] = e[2];\n                var k, m;\n                k = 0;\n                for (m = d.length; k < m; ++k) l[h++] = d[k];\n                t[d[0]]++;\n                w[d[3]]++;\n                q = a.length + c - 1;\n                x = null\n            }\n            var f, a, b, k, m, g = {}, p, v, x, l = C ? new Uint16Array(2 * d.length) : [],\n                h = 0,\n                q = 0,\n                t = new(C ? Uint32Array : Array)(286),\n                w = new(C ? Uint32Array : Array)(30),\n                da = e.f,\n                z;\n            if (!C) {\n                for (b = 0; 285 >= b;) t[b++] = 0;\n                for (b = 0; 29 >= b;) w[b++] = 0\n            }\n            t[256] = 1;\n            f = 0;\n            for (a = d.length; f < a; ++f) {\n                b = m = 0;\n                for (k = 3; b < k && f + b !== a; ++b) m = m << 8 | d[f + b];\n                g[m] === n && (g[m] = []);\n                p = g[m];\n                if (!(0 < q--)) {\n                    for (; 0 < p.length && 32768 < f - p[0];) p.shift();\n                    if (f + 3 >= a) {\n                        x && c(x, - 1);\n                        b = 0;\n                        for (k = a - f; b < k; ++b) z = d[f + b], l[h++] = z, ++t[z];\n                        break\n                    }\n                    0 < p.length ? (v = Ha(d, f, p), x ? x.length < v.length ? (z = d[f - 1], l[h++] = z, ++t[z], c(v, 0)) : c(x, - 1) : v.length < da ? x = v : c(v, 0)) : x ? c(x, - 1) : (z = d[f], l[h++] = z, ++t[z])\n                }\n                p.push(f)\n            }\n            l[h++] = 256;\n            t[256]++;\n            e.j = t;\n            e.i = w;\n            return C ? l.subarray(0, h) : l\n        }\n\n        function Ha(e, d, c) {\n            var f, a, b = 0,\n                k, m, g, p, v = e.length;\n            m = 0;\n            p = c.length;\n            a: for (; m < p; m++) {\n                f = c[p - m - 1];\n                k = 3;\n                if (3 < b) {\n                    for (g = b; 3 < g; g--) if (e[f + g - 1] !== e[d + g - 1]) continue a;\n                    k = b\n                }\n                for (; 258 > k && d + k < v && e[f + k] === e[d + k];)++k;\n                k > b && (a = f, b = k);\n                if (258 === k) break\n            }\n            return new qa(b, d - a)\n        }\n\n        function oa(e, d) {\n            var c = e.length,\n                f = new ja(572),\n                a = new(C ? Uint8Array : Array)(c),\n                b, k, m, g, p;\n            if (!C) for (g = 0; g < c; g++) a[g] = 0;\n            for (g = 0; g < c; ++g) 0 < e[g] && f.push(g, e[g]);\n            b = Array(f.length / 2);\n            k = new(C ? Uint32Array : Array)(f.length / 2);\n            if (1 === b.length) return a[f.pop().index] = 1, a;\n            g = 0;\n            for (p = f.length / 2; g < p; ++g) b[g] = f.pop(), k[g] = b[g].value;\n            m = Ja(k, k.length, d);\n            g = 0;\n            for (p = b.length; g < p; ++g) a[b[g].index] = m[g];\n            return a\n        }\n\n        function Ja(e, d, c) {\n            function f(a) {\n                var b = g[a][p[a]];\n                b === d ? (f(a + 1), f(a + 1)) : --k[b];\n                ++p[a]\n            }\n            var a = new(C ? Uint16Array : Array)(c),\n                b = new(C ? Uint8Array : Array)(c),\n                k = new(C ? Uint8Array : Array)(d),\n                m = Array(c),\n                g = Array(c),\n                p = Array(c),\n                v = (1 << c) - d,\n                x = 1 << c - 1,\n                l, h, q, t, w;\n            a[c - 1] = d;\n            for (h = 0; h < c; ++h) v < x ? b[h] = 0 : (b[h] = 1, v -= x), v <<= 1, a[c - 2 - h] = (a[c - 1 - h] / 2 | 0) + d;\n            a[0] = b[0];\n            m[0] = Array(a[0]);\n            g[0] = Array(a[0]);\n            for (h = 1; h < c; ++h) a[h] > 2 * a[h - 1] + b[h] && (a[h] = 2 * a[h - 1] + b[h]), m[h] = Array(a[h]), g[h] = Array(a[h]);\n            for (l = 0; l < d; ++l) k[l] = c;\n            for (q = 0; q < a[c - 1]; ++q) m[c - 1][q] = e[q], g[c - 1][q] = q;\n            for (l = 0; l < c; ++l) p[l] = 0;\n            1 === b[c - 1] && (--k[0], ++p[c - 1]);\n            for (h = c - 2; 0 <= h; --h) {\n                t = l = 0;\n                w = p[h + 1];\n                for (q = 0; q < a[h]; q++) t = m[h + 1][w] + m[h + 1][w + 1], t > e[l] ? (m[h][q] = t, g[h][q] = d, w += 2) : (m[h][q] = e[l], g[h][q] = l, ++l);\n                p[h] = 0;\n                1 === b[h] && f(h)\n            }\n            return k\n        }\n\n        function pa(e) {\n            var d = new(C ? Uint16Array : Array)(e.length),\n                c = [],\n                f = [],\n                a = 0,\n                b, k, m, g;\n            b = 0;\n            for (k = e.length; b < k; b++) c[e[b]] = (c[e[b]] | 0) + 1;\n            b = 1;\n            for (k = 16; b <= k; b++) f[b] = a, a += c[b] | 0, a <<= 1;\n            b = 0;\n            for (k = e.length; b < k; b++) {\n                a = f[e[b]];\n                f[e[b]] += 1;\n                m = d[b] = 0;\n                for (g = e[b]; m < g; m++) d[b] = d[b] << 1 | a & 1, a >>>= 1\n            }\n            return d\n        };\n        ba("Zlib.RawDeflate", ka);\n        ba("Zlib.RawDeflate.prototype.compress", ka.prototype.h);\n        var Ka = {\n            NONE: 0,\n            FIXED: 1,\n            DYNAMIC: ma\n        }, V, La, $, Ma;\n        if (Object.keys) V = Object.keys(Ka);\n        else for (La in V = [], $ = 0, Ka) V[$++] = La;\n        $ = 0;\n        for (Ma = V.length; $ < Ma; ++$) La = V[$], ba("Zlib.RawDeflate.CompressionType." + La, Ka[La]);\n    }).call(this);\n\n\n}).call(context);\n\nmodule.exports = function(input) {\n    var deflate = new context.Zlib.RawDeflate(input);\n    return deflate.compress();\n};\n\n},{}],10:[function(require,module,exports){\nvar USE_TYPEDARRAY = (typeof Uint8Array !== \'undefined\') && (typeof Uint16Array !== \'undefined\') && (typeof Uint32Array !== \'undefined\');\nexports.magic = "\\x08\\x00";\nexports.uncompress = require(\'./inflate\');\nexports.uncompressInputType = USE_TYPEDARRAY ? "uint8array" : "array";\nexports.compress = require(\'./deflate\');\nexports.compressInputType = USE_TYPEDARRAY ? "uint8array" : "array";\n\n},{"./deflate":9,"./inflate":11}],11:[function(require,module,exports){\nvar context = {};\n(function() {\n\n    // https://github.com/imaya/zlib.js\n    // tag 0.1.6\n    // file bin/deflate.min.js\n\n    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */ (function() {\n        \'use strict\';\n        var l = void 0,\n            p = this;\n\n        function q(c, d) {\n            var a = c.split("."),\n                b = p;\n            !(a[0] in b) && b.execScript && b.execScript("var " + a[0]);\n            for (var e; a.length && (e = a.shift());)!a.length && d !== l ? b[e] = d : b = b[e] ? b[e] : b[e] = {}\n        };\n        var r = "undefined" !== typeof Uint8Array && "undefined" !== typeof Uint16Array && "undefined" !== typeof Uint32Array;\n\n        function u(c) {\n            var d = c.length,\n                a = 0,\n                b = Number.POSITIVE_INFINITY,\n                e, f, g, h, k, m, s, n, t;\n            for (n = 0; n < d; ++n) c[n] > a && (a = c[n]), c[n] < b && (b = c[n]);\n            e = 1 << a;\n            f = new(r ? Uint32Array : Array)(e);\n            g = 1;\n            h = 0;\n            for (k = 2; g <= a;) {\n                for (n = 0; n < d; ++n) if (c[n] === g) {\n                    m = 0;\n                    s = h;\n                    for (t = 0; t < g; ++t) m = m << 1 | s & 1, s >>= 1;\n                    for (t = m; t < e; t += k) f[t] = g << 16 | n;\n                    ++h\n                }++g;\n                h <<= 1;\n                k <<= 1\n            }\n            return [f, a, b]\n        };\n\n        function v(c, d) {\n            this.g = [];\n            this.h = 32768;\n            this.c = this.f = this.d = this.k = 0;\n            this.input = r ? new Uint8Array(c) : c;\n            this.l = !1;\n            this.i = w;\n            this.p = !1;\n            if (d || !(d = {})) d.index && (this.d = d.index), d.bufferSize && (this.h = d.bufferSize), d.bufferType && (this.i = d.bufferType), d.resize && (this.p = d.resize);\n            switch (this.i) {\n            case x:\n                this.a = 32768;\n                this.b = new(r ? Uint8Array : Array)(32768 + this.h + 258);\n                break;\n            case w:\n                this.a = 0;\n                this.b = new(r ? Uint8Array : Array)(this.h);\n                this.e = this.u;\n                this.m = this.r;\n                this.j = this.s;\n                break;\n            default:\n                throw Error("invalid inflate mode");\n            }\n        }\n        var x = 0,\n            w = 1;\n        v.prototype.t = function() {\n            for (; !this.l;) {\n                var c = y(this, 3);\n                c & 1 && (this.l = !0);\n                c >>>= 1;\n                switch (c) {\n                case 0:\n                    var d = this.input,\n                        a = this.d,\n                        b = this.b,\n                        e = this.a,\n                        f = l,\n                        g = l,\n                        h = l,\n                        k = b.length,\n                        m = l;\n                    this.c = this.f = 0;\n                    f = d[a++];\n                    if (f === l) throw Error("invalid uncompressed block header: LEN (first byte)");\n                    g = f;\n                    f = d[a++];\n                    if (f === l) throw Error("invalid uncompressed block header: LEN (second byte)");\n                    g |= f << 8;\n                    f = d[a++];\n                    if (f === l) throw Error("invalid uncompressed block header: NLEN (first byte)");\n                    h = f;\n                    f = d[a++];\n                    if (f === l) throw Error("invalid uncompressed block header: NLEN (second byte)");\n                    h |= f << 8;\n                    if (g === ~h) throw Error("invalid uncompressed block header: length verify");\n                    if (a + g > d.length) throw Error("input buffer is broken");\n                    switch (this.i) {\n                    case x:\n                        for (; e + g > b.length;) {\n                            m = k - e;\n                            g -= m;\n                            if (r) b.set(d.subarray(a, a + m), e), e += m, a += m;\n                            else for (; m--;) b[e++] = d[a++];\n                            this.a = e;\n                            b = this.e();\n                            e = this.a\n                        }\n                        break;\n                    case w:\n                        for (; e + g > b.length;) b = this.e({\n                            o: 2\n                        });\n                        break;\n                    default:\n                        throw Error("invalid inflate mode");\n                    }\n                    if (r) b.set(d.subarray(a, a + g), e), e += g, a += g;\n                    else for (; g--;) b[e++] = d[a++];\n                    this.d = a;\n                    this.a = e;\n                    this.b = b;\n                    break;\n                case 1:\n                    this.j(z,\n                    A);\n                    break;\n                case 2:\n                    B(this);\n                    break;\n                default:\n                    throw Error("unknown BTYPE: " + c);\n                }\n            }\n            return this.m()\n        };\n        var C = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],\n            D = r ? new Uint16Array(C) : C,\n            E = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 258, 258],\n            F = r ? new Uint16Array(E) : E,\n            G = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0],\n            H = r ? new Uint8Array(G) : G,\n            I = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577],\n            J = r ? new Uint16Array(I) : I,\n            K = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,\n            13],\n            L = r ? new Uint8Array(K) : K,\n            M = new(r ? Uint8Array : Array)(288),\n            N, O;\n        N = 0;\n        for (O = M.length; N < O; ++N) M[N] = 143 >= N ? 8 : 255 >= N ? 9 : 279 >= N ? 7 : 8;\n        var z = u(M),\n            P = new(r ? Uint8Array : Array)(30),\n            Q, R;\n        Q = 0;\n        for (R = P.length; Q < R; ++Q) P[Q] = 5;\n        var A = u(P);\n\n        function y(c, d) {\n            for (var a = c.f, b = c.c, e = c.input, f = c.d, g; b < d;) {\n                g = e[f++];\n                if (g === l) throw Error("input buffer is broken");\n                a |= g << b;\n                b += 8\n            }\n            g = a & (1 << d) - 1;\n            c.f = a >>> d;\n            c.c = b - d;\n            c.d = f;\n            return g\n        }\n\n        function S(c, d) {\n            for (var a = c.f, b = c.c, e = c.input, f = c.d, g = d[0], h = d[1], k, m, s; b < h;) {\n                k = e[f++];\n                if (k === l) break;\n                a |= k << b;\n                b += 8\n            }\n            m = g[a & (1 << h) - 1];\n            s = m >>> 16;\n            c.f = a >> s;\n            c.c = b - s;\n            c.d = f;\n            return m & 65535\n        }\n\n        function B(c) {\n            function d(a, c, b) {\n                var d, f, e, g;\n                for (g = 0; g < a;) switch (d = S(this, c), d) {\n                case 16:\n                    for (e = 3 + y(this, 2); e--;) b[g++] = f;\n                    break;\n                case 17:\n                    for (e = 3 + y(this, 3); e--;) b[g++] = 0;\n                    f = 0;\n                    break;\n                case 18:\n                    for (e = 11 + y(this, 7); e--;) b[g++] = 0;\n                    f = 0;\n                    break;\n                default:\n                    f = b[g++] = d\n                }\n                return b\n            }\n            var a = y(c, 5) + 257,\n                b = y(c, 5) + 1,\n                e = y(c, 4) + 4,\n                f = new(r ? Uint8Array : Array)(D.length),\n                g, h, k, m;\n            for (m = 0; m < e; ++m) f[D[m]] = y(c, 3);\n            g = u(f);\n            h = new(r ? Uint8Array : Array)(a);\n            k = new(r ? Uint8Array : Array)(b);\n            c.j(u(d.call(c, a, g, h)), u(d.call(c, b, g, k)))\n        }\n        v.prototype.j = function(c, d) {\n            var a = this.b,\n                b = this.a;\n            this.n = c;\n            for (var e = a.length - 258, f, g, h, k; 256 !== (f = S(this, c));) if (256 > f) b >= e && (this.a = b, a = this.e(), b = this.a), a[b++] = f;\n            else {\n                g = f - 257;\n                k = F[g];\n                0 < H[g] && (k += y(this, H[g]));\n                f = S(this, d);\n                h = J[f];\n                0 < L[f] && (h += y(this, L[f]));\n                b >= e && (this.a = b, a = this.e(), b = this.a);\n                for (; k--;) a[b] = a[b++-h]\n            }\n            for (; 8 <= this.c;) this.c -= 8, this.d--;\n            this.a = b\n        };\n        v.prototype.s = function(c, d) {\n            var a = this.b,\n                b = this.a;\n            this.n = c;\n            for (var e = a.length, f, g, h, k; 256 !== (f = S(this, c));) if (256 > f) b >= e && (a = this.e(), e = a.length), a[b++] = f;\n            else {\n                g = f - 257;\n                k = F[g];\n                0 < H[g] && (k += y(this, H[g]));\n                f = S(this, d);\n                h = J[f];\n                0 < L[f] && (h += y(this, L[f]));\n                b + k > e && (a = this.e(), e = a.length);\n                for (; k--;) a[b] = a[b++-h]\n            }\n            for (; 8 <= this.c;) this.c -= 8, this.d--;\n            this.a = b\n        };\n        v.prototype.e = function() {\n            var c = new(r ? Uint8Array : Array)(this.a - 32768),\n                d = this.a - 32768,\n                a, b, e = this.b;\n            if (r) c.set(e.subarray(32768, c.length));\n            else {\n                a = 0;\n                for (b = c.length; a < b; ++a) c[a] = e[a + 32768]\n            }\n            this.g.push(c);\n            this.k += c.length;\n            if (r) e.set(e.subarray(d, d + 32768));\n            else for (a = 0; 32768 > a; ++a) e[a] = e[d + a];\n            this.a = 32768;\n            return e\n        };\n        v.prototype.u = function(c) {\n            var d, a = this.input.length / this.d + 1 | 0,\n                b, e, f, g = this.input,\n                h = this.b;\n            c && ("number" === typeof c.o && (a = c.o), "number" === typeof c.q && (a += c.q));\n            2 > a ? (b = (g.length - this.d) / this.n[2], f = 258 * (b / 2) | 0, e = f < h.length ? h.length + f : h.length << 1) : e = h.length * a;\n            r ? (d = new Uint8Array(e), d.set(h)) : d = h;\n            return this.b = d\n        };\n        v.prototype.m = function() {\n            var c = 0,\n                d = this.b,\n                a = this.g,\n                b, e = new(r ? Uint8Array : Array)(this.k + (this.a - 32768)),\n                f, g, h, k;\n            if (0 === a.length) return r ? this.b.subarray(32768, this.a) : this.b.slice(32768, this.a);\n            f = 0;\n            for (g = a.length; f < g; ++f) {\n                b = a[f];\n                h = 0;\n                for (k = b.length; h < k; ++h) e[c++] = b[h]\n            }\n            f = 32768;\n            for (g = this.a; f < g; ++f) e[c++] = d[f];\n            this.g = [];\n            return this.buffer = e\n        };\n        v.prototype.r = function() {\n            var c, d = this.a;\n            r ? this.p ? (c = new Uint8Array(d), c.set(this.b.subarray(0, d))) : c = this.b.subarray(0, d) : (this.b.length > d && (this.b.length = d), c = this.b);\n            return this.buffer = c\n        };\n        q("Zlib.RawInflate", v);\n        q("Zlib.RawInflate.prototype.decompress", v.prototype.t);\n        var T = {\n            ADAPTIVE: w,\n            BLOCK: x\n        }, U, V, W, X;\n        if (Object.keys) U = Object.keys(T);\n        else for (V in U = [], W = 0, T) U[W++] = V;\n        W = 0;\n        for (X = U.length; W < X; ++W) V = U[W], q("Zlib.RawInflate.BufferType." + V, T[V]);\n    }).call(this);\n\n\n}).call(context);\n\nmodule.exports = function(input) {\n    var inflate = new context.Zlib.RawInflate(new Uint8Array(input));\n    return inflate.decompress();\n};\n\n},{}],12:[function(require,module,exports){\n/**\n\nJSZip - A Javascript class for generating and reading zip files\n<http://stuartk.com/jszip>\n\n(c) 2009-2012 Stuart Knightley <stuart [at] stuartk.com>\nDual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/master/LICENSE.markdown.\n\nUsage:\n   zip = new JSZip();\n   zip.file("hello.txt", "Hello, World!").file("tempfile", "nothing");\n   zip.folder("images").file("smile.gif", base64Data, {base64: true});\n   zip.file("Xmas.txt", "Ho ho ho !", {date : new Date("December 25, 2007 00:00:01")});\n   zip.remove("tempfile");\n\n   base64zip = zip.generate();\n\n**/\n\n/**\n * Representation a of zip file in js\n * @constructor\n * @param {String=|ArrayBuffer=|Uint8Array=} data the data to load, if any (optional).\n * @param {Object=} options the options for creating this objects (optional).\n */\n\nvar JSZip = function(data, options) {\n    // object containing the files :\n    // {\n    //   "folder/" : {...},\n    //   "folder/data.txt" : {...}\n    // }\n    this.files = {};\n\n    // Where we are in the hierarchy\n    this.root = "";\n\n    if (data) {\n        this.load(data, options);\n    }\n};\n\n\n\nJSZip.prototype = require(\'./object\');\nJSZip.prototype.clone = function() {\n    var newObj = new JSZip();\n    for (var i in this) {\n        if (typeof this[i] !== "function") {\n            newObj[i] = this[i];\n        }\n    }\n    return newObj;\n};\nJSZip.prototype.load = require(\'./load\');\nJSZip.support = require(\'./support\');\nJSZip.utils = require(\'./utils\');\nJSZip.base64 = require(\'./base64\');\nJSZip.compressions = require(\'./compressions\');\nmodule.exports = JSZip;\n\n},{"./base64":4,"./compressions":6,"./load":13,"./object":15,"./support":18,"./utils":20}],13:[function(require,module,exports){\nvar base64 = require(\'./base64\');\nvar ZipEntries = require(\'./zipEntries\');\nmodule.exports = function(data, options) {\n    var files, zipEntries, i, input;\n    options = options || {};\n    if (options.base64) {\n        data = base64.decode(data);\n    }\n\n    zipEntries = new ZipEntries(data, options);\n    files = zipEntries.files;\n    for (i = 0; i < files.length; i++) {\n        input = files[i];\n        this.file(input.fileName, input.decompressed, {\n            binary: true,\n            optimizedBinaryString: true,\n            date: input.date,\n            dir: input.dir\n        });\n    }\n\n    return this;\n};\n\n},{"./base64":4,"./zipEntries":21}],14:[function(require,module,exports){\nvar Uint8ArrayReader = require(\'./uint8ArrayReader\');\n\nfunction NodeBufferReader(data) {\n    this.data = data;\n    this.length = this.data.length;\n    this.index = 0;\n}\nNodeBufferReader.prototype = new Uint8ArrayReader();\n\n/**\n * @see DataReader.readData\n */\nNodeBufferReader.prototype.readData = function(size) {\n    this.checkOffset(size);\n    var result = this.data.slice(this.index, this.index + size);\n    this.index += size;\n    return result;\n};\nmodule.exports = NodeBufferReader;\n\n},{"./uint8ArrayReader":19}],15:[function(require,module,exports){\n(function (Buffer){\nvar support = require(\'./support\');\nvar utils = require(\'./utils\');\nvar signature = require(\'./signature\');\nvar defaults = require(\'./defaults\');\nvar base64 = require(\'./base64\');\nvar compressions = require(\'./compressions\');\nvar CompressedObject = require(\'./compressedObject\');\n/**\n * Returns the raw data of a ZipObject, decompress the content if necessary.\n * @param {ZipObject} file the file to use.\n * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.\n */\n\nvar getRawData = function(file) {\n    if (file._data instanceof CompressedObject) {\n        file._data = file._data.getContent();\n        file.options.binary = true;\n        file.options.base64 = false;\n\n        if (utils.getTypeOf(file._data) === "uint8array") {\n            var copy = file._data;\n            // when reading an arraybuffer, the CompressedObject mechanism will keep it and subarray() a Uint8Array.\n            // if we request a file in the same format, we might get the same Uint8Array or its ArrayBuffer (the original zip file).\n            file._data = new Uint8Array(copy.length);\n            // with an empty Uint8Array, Opera fails with a "Offset larger than array size"\n            if (copy.length !== 0) {\n                file._data.set(copy, 0);\n            }\n        }\n    }\n    return file._data;\n};\n\n/**\n * Returns the data of a ZipObject in a binary form. If the content is an unicode string, encode it.\n * @param {ZipObject} file the file to use.\n * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.\n */\nvar getBinaryData = function(file) {\n    var result = getRawData(file),\n        type = utils.getTypeOf(result);\n    if (type === "string") {\n        if (!file.options.binary) {\n            // unicode text !\n            // unicode string => binary string is a painful process, check if we can avoid it.\n            if (support.uint8array && typeof TextEncoder === "function") {\n                return TextEncoder("utf-8").encode(result);\n            }\n            if (support.nodebuffer) {\n                return new Buffer(result, "utf-8");\n            }\n        }\n        return file.asBinary();\n    }\n    return result;\n}\n\n/**\n * Transform this._data into a string.\n * @param {function} filter a function String -> String, applied if not null on the result.\n * @return {String} the string representing this._data.\n */\nvar dataToString = function(asUTF8) {\n    var result = getRawData(this);\n    if (result === null || typeof result === "undefined") {\n        return "";\n    }\n    // if the data is a base64 string, we decode it before checking the encoding !\n    if (this.options.base64) {\n        result = base64.decode(result);\n    }\n    if (asUTF8 && this.options.binary) {\n        // JSZip.prototype.utf8decode supports arrays as input\n        // skip to array => string step, utf8decode will do it.\n        result = out.utf8decode(result);\n    }\n    else {\n        // no utf8 transformation, do the array => string step.\n        result = utils.transformTo("string", result);\n    }\n\n    if (!asUTF8 && !this.options.binary) {\n        result = out.utf8encode(result);\n    }\n    return result;\n};\n/**\n * A simple object representing a file in the zip file.\n * @constructor\n * @param {string} name the name of the file\n * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data\n * @param {Object} options the options of the file\n */\nvar ZipObject = function(name, data, options) {\n    this.name = name;\n    this._data = data;\n    this.options = options;\n};\n\nZipObject.prototype = {\n    /**\n     * Return the content as UTF8 string.\n     * @return {string} the UTF8 string.\n     */\n    asText: function() {\n        return dataToString.call(this, true);\n    },\n    /**\n     * Returns the binary content.\n     * @return {string} the content as binary.\n     */\n    asBinary: function() {\n        return dataToString.call(this, false);\n    },\n    /**\n     * Returns the content as a nodejs Buffer.\n     * @return {Buffer} the content as a Buffer.\n     */\n    asNodeBuffer: function() {\n        var result = getBinaryData(this);\n        return utils.transformTo("nodebuffer", result);\n    },\n    /**\n     * Returns the content as an Uint8Array.\n     * @return {Uint8Array} the content as an Uint8Array.\n     */\n    asUint8Array: function() {\n        var result = getBinaryData(this);\n        return utils.transformTo("uint8array", result);\n    },\n    /**\n     * Returns the content as an ArrayBuffer.\n     * @return {ArrayBuffer} the content as an ArrayBufer.\n     */\n    asArrayBuffer: function() {\n        return this.asUint8Array().buffer;\n    }\n};\n\n/**\n * Transform an integer into a string in hexadecimal.\n * @private\n * @param {number} dec the number to convert.\n * @param {number} bytes the number of bytes to generate.\n * @returns {string} the result.\n */\nvar decToHex = function(dec, bytes) {\n    var hex = "",\n        i;\n    for (i = 0; i < bytes; i++) {\n        hex += String.fromCharCode(dec & 0xff);\n        dec = dec >>> 8;\n    }\n    return hex;\n};\n\n/**\n * Merge the objects passed as parameters into a new one.\n * @private\n * @param {...Object} var_args All objects to merge.\n * @return {Object} a new object with the data of the others.\n */\nvar extend = function() {\n    var result = {}, i, attr;\n    for (i = 0; i < arguments.length; i++) { // arguments is not enumerable in some browsers\n        for (attr in arguments[i]) {\n            if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {\n                result[attr] = arguments[i][attr];\n            }\n        }\n    }\n    return result;\n};\n\n/**\n * Transforms the (incomplete) options from the user into the complete\n * set of options to create a file.\n * @private\n * @param {Object} o the options from the user.\n * @return {Object} the complete set of options.\n */\nvar prepareFileAttrs = function(o) {\n    o = o || {};\n    if (o.base64 === true && o.binary == null) {\n        o.binary = true;\n    }\n    o = extend(o, defaults);\n    o.date = o.date || new Date();\n    if (o.compression !== null) o.compression = o.compression.toUpperCase();\n\n    return o;\n};\n\n/**\n * Add a file in the current folder.\n * @private\n * @param {string} name the name of the file\n * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data of the file\n * @param {Object} o the options of the file\n * @return {Object} the new file.\n */\nvar fileAdd = function(name, data, o) {\n    // be sure sub folders exist\n    var parent = parentFolder(name),\n        dataType = utils.getTypeOf(data);\n    if (parent) {\n        folderAdd.call(this, parent);\n    }\n\n    o = prepareFileAttrs(o);\n\n    if (o.dir || data === null || typeof data === "undefined") {\n        o.base64 = false;\n        o.binary = false;\n        data = null;\n    }\n    else if (dataType === "string") {\n        if (o.binary && !o.base64) {\n            // optimizedBinaryString == true means that the file has already been filtered with a 0xFF mask\n            if (o.optimizedBinaryString !== true) {\n                // this is a string, not in a base64 format.\n                // Be sure that this is a correct "binary string"\n                data = utils.string2binary(data);\n            }\n        }\n    }\n    else { // arraybuffer, uint8array, ...\n        o.base64 = false;\n        o.binary = true;\n\n        if (!dataType && !(data instanceof CompressedObject)) {\n            throw new Error("The data of \'" + name + "\' is in an unsupported format !");\n        }\n\n        // special case : it\'s way easier to work with Uint8Array than with ArrayBuffer\n        if (dataType === "arraybuffer") {\n            data = utils.transformTo("uint8array", data);\n        }\n    }\n\n    return this.files[name] = new ZipObject(name, data, o);\n};\n\n\n/**\n * Find the parent folder of the path.\n * @private\n * @param {string} path the path to use\n * @return {string} the parent folder, or ""\n */\nvar parentFolder = function(path) {\n    if (path.slice(-1) == \'/\') {\n        path = path.substring(0, path.length - 1);\n    }\n    var lastSlash = path.lastIndexOf(\'/\');\n    return (lastSlash > 0) ? path.substring(0, lastSlash) : "";\n};\n\n/**\n * Add a (sub) folder in the current folder.\n * @private\n * @param {string} name the folder\'s name\n * @return {Object} the new folder.\n */\nvar folderAdd = function(name) {\n    // Check the name ends with a /\n    if (name.slice(-1) != "/") {\n        name += "/"; // IE doesn\'t like substr(-1)\n    }\n\n    // Does this folder already exist?\n    if (!this.files[name]) {\n        fileAdd.call(this, name, null, {\n            dir: true\n        });\n    }\n    return this.files[name];\n};\n\n/**\n * Generate a JSZip.CompressedObject for a given zipOject.\n * @param {ZipObject} file the object to read.\n * @param {JSZip.compression} compression the compression to use.\n * @return {JSZip.CompressedObject} the compressed result.\n */\nvar generateCompressedObjectFrom = function(file, compression) {\n    var result = new CompressedObject(),\n        content;\n\n    // the data has not been decompressed, we might reuse things !\n    if (file._data instanceof CompressedObject) {\n        result.uncompressedSize = file._data.uncompressedSize;\n        result.crc32 = file._data.crc32;\n\n        if (result.uncompressedSize === 0 || file.options.dir) {\n            compression = compressions[\'STORE\'];\n            result.compressedContent = "";\n            result.crc32 = 0;\n        }\n        else if (file._data.compressionMethod === compression.magic) {\n            result.compressedContent = file._data.getCompressedContent();\n        }\n        else {\n            content = file._data.getContent()\n            // need to decompress / recompress\n            result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content));\n        }\n    }\n    else {\n        // have uncompressed data\n        content = getBinaryData(file);\n        if (!content || content.length === 0 || file.options.dir) {\n            compression = compressions[\'STORE\'];\n            content = "";\n        }\n        result.uncompressedSize = content.length;\n        result.crc32 = this.crc32(content);\n        result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content));\n    }\n\n    result.compressedSize = result.compressedContent.length;\n    result.compressionMethod = compression.magic;\n\n    return result;\n};\n\n/**\n * Generate the various parts used in the construction of the final zip file.\n * @param {string} name the file name.\n * @param {ZipObject} file the file content.\n * @param {JSZip.CompressedObject} compressedObject the compressed object.\n * @param {number} offset the current offset from the start of the zip file.\n * @return {object} the zip parts.\n */\nvar generateZipParts = function(name, file, compressedObject, offset) {\n    var data = compressedObject.compressedContent,\n        utfEncodedFileName = this.utf8encode(file.name),\n        useUTF8 = utfEncodedFileName !== file.name,\n        o = file.options,\n        dosTime,\n        dosDate;\n\n    // date\n    // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html\n    // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html\n    // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html\n\n    dosTime = o.date.getHours();\n    dosTime = dosTime << 6;\n    dosTime = dosTime | o.date.getMinutes();\n    dosTime = dosTime << 5;\n    dosTime = dosTime | o.date.getSeconds() / 2;\n\n    dosDate = o.date.getFullYear() - 1980;\n    dosDate = dosDate << 4;\n    dosDate = dosDate | (o.date.getMonth() + 1);\n    dosDate = dosDate << 5;\n    dosDate = dosDate | o.date.getDate();\n\n\n    var header = "";\n\n    // version needed to extract\n    header += "\\x0A\\x00";\n    // general purpose bit flag\n    // set bit 11 if utf8\n    header += useUTF8 ? "\\x00\\x08" : "\\x00\\x00";\n    // compression method\n    header += compressedObject.compressionMethod;\n    // last mod file time\n    header += decToHex(dosTime, 2);\n    // last mod file date\n    header += decToHex(dosDate, 2);\n    // crc-32\n    header += decToHex(compressedObject.crc32, 4);\n    // compressed size\n    header += decToHex(compressedObject.compressedSize, 4);\n    // uncompressed size\n    header += decToHex(compressedObject.uncompressedSize, 4);\n    // file name length\n    header += decToHex(utfEncodedFileName.length, 2);\n    // extra field length\n    header += "\\x00\\x00";\n\n\n    var fileRecord = signature.LOCAL_FILE_HEADER + header + utfEncodedFileName;\n\n    var dirRecord = signature.CENTRAL_FILE_HEADER +\n    // version made by (00: DOS)\n    "\\x14\\x00" +\n    // file header (common to file and central directory)\n    header +\n    // file comment length\n    "\\x00\\x00" +\n    // disk number start\n    "\\x00\\x00" +\n    // internal file attributes TODO\n    "\\x00\\x00" +\n    // external file attributes\n    (file.options.dir === true ? "\\x10\\x00\\x00\\x00" : "\\x00\\x00\\x00\\x00") +\n    // relative offset of local header\n    decToHex(offset, 4) +\n    // file name\n    utfEncodedFileName;\n\n\n    return {\n        fileRecord: fileRecord,\n        dirRecord: dirRecord,\n        compressedObject: compressedObject\n    };\n};\n\n/**\n * An object to write any content to a string.\n * @constructor\n */\nvar StringWriter = function() {\n    this.data = [];\n};\nStringWriter.prototype = {\n    /**\n     * Append any content to the current string.\n     * @param {Object} input the content to add.\n     */\n    append: function(input) {\n        input = utils.transformTo("string", input);\n        this.data.push(input);\n    },\n    /**\n     * Finalize the construction an return the result.\n     * @return {string} the generated string.\n     */\n    finalize: function() {\n        return this.data.join("");\n    }\n};\n/**\n * An object to write any content to an Uint8Array.\n * @constructor\n * @param {number} length The length of the array.\n */\nvar Uint8ArrayWriter = function(length) {\n    this.data = new Uint8Array(length);\n    this.index = 0;\n};\nUint8ArrayWriter.prototype = {\n    /**\n     * Append any content to the current array.\n     * @param {Object} input the content to add.\n     */\n    append: function(input) {\n        if (input.length !== 0) {\n            // with an empty Uint8Array, Opera fails with a "Offset larger than array size"\n            input = utils.transformTo("uint8array", input);\n            this.data.set(input, this.index);\n            this.index += input.length;\n        }\n    },\n    /**\n     * Finalize the construction an return the result.\n     * @return {Uint8Array} the generated array.\n     */\n    finalize: function() {\n        return this.data;\n    }\n};\n\n// return the actual prototype of JSZip\nvar out = {\n    /**\n     * Read an existing zip and merge the data in the current JSZip object.\n     * The implementation is in jszip-load.js, don\'t forget to include it.\n     * @param {String|ArrayBuffer|Uint8Array|Buffer} stream  The stream to load\n     * @param {Object} options Options for loading the stream.\n     *  options.base64 : is the stream in base64 ? default : false\n     * @return {JSZip} the current JSZip object\n     */\n    load: function(stream, options) {\n        throw new Error("Load method is not defined. Is the file jszip-load.js included ?");\n    },\n\n    /**\n     * Filter nested files/folders with the specified function.\n     * @param {Function} search the predicate to use :\n     * function (relativePath, file) {...}\n     * It takes 2 arguments : the relative path and the file.\n     * @return {Array} An array of matching elements.\n     */\n    filter: function(search) {\n        var result = [],\n            filename, relativePath, file, fileClone;\n        for (filename in this.files) {\n            if (!this.files.hasOwnProperty(filename)) {\n                continue;\n            }\n            file = this.files[filename];\n            // return a new object, don\'t let the user mess with our internal objects :)\n            fileClone = new ZipObject(file.name, file._data, extend(file.options));\n            relativePath = filename.slice(this.root.length, filename.length);\n            if (filename.slice(0, this.root.length) === this.root && // the file is in the current root\n            search(relativePath, fileClone)) { // and the file matches the function\n                result.push(fileClone);\n            }\n        }\n        return result;\n    },\n\n    /**\n     * Add a file to the zip file, or search a file.\n     * @param   {string|RegExp} name The name of the file to add (if data is defined),\n     * the name of the file to find (if no data) or a regex to match files.\n     * @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded\n     * @param   {Object} o     File options\n     * @return  {JSZip|Object|Array} this JSZip object (when adding a file),\n     * a file (when searching by string) or an array of files (when searching by regex).\n     */\n    file: function(name, data, o) {\n        if (arguments.length === 1) {\n            if (name instanceof RegExp) {\n                var regexp = name;\n                return this.filter(function(relativePath, file) {\n                    return !file.options.dir && regexp.test(relativePath);\n                });\n            }\n            else { // text\n                return this.filter(function(relativePath, file) {\n                    return !file.options.dir && relativePath === name;\n                })[0] || null;\n            }\n        }\n        else { // more than one argument : we have data !\n            name = this.root + name;\n            fileAdd.call(this, name, data, o);\n        }\n        return this;\n    },\n\n    /**\n     * Add a directory to the zip file, or search.\n     * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.\n     * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.\n     */\n    folder: function(arg) {\n        if (!arg) {\n            return this;\n        }\n\n        if (arg instanceof RegExp) {\n            return this.filter(function(relativePath, file) {\n                return file.options.dir && arg.test(relativePath);\n            });\n        }\n\n        // else, name is a new folder\n        var name = this.root + arg;\n        var newFolder = folderAdd.call(this, name);\n\n        // Allow chaining by returning a new object with this folder as the root\n        var ret = this.clone();\n        ret.root = newFolder.name;\n        return ret;\n    },\n\n    /**\n     * Delete a file, or a directory and all sub-files, from the zip\n     * @param {string} name the name of the file to delete\n     * @return {JSZip} this JSZip object\n     */\n    remove: function(name) {\n        name = this.root + name;\n        var file = this.files[name];\n        if (!file) {\n            // Look for any folders\n            if (name.slice(-1) != "/") {\n                name += "/";\n            }\n            file = this.files[name];\n        }\n\n        if (file) {\n            if (!file.options.dir) {\n                // file\n                delete this.files[name];\n            }\n            else {\n                // folder\n                var kids = this.filter(function(relativePath, file) {\n                    return file.name.slice(0, name.length) === name;\n                });\n                for (var i = 0; i < kids.length; i++) {\n                    delete this.files[kids[i].name];\n                }\n            }\n        }\n\n        return this;\n    },\n\n    /**\n     * Generate the complete zip file\n     * @param {Object} options the options to generate the zip file :\n     * - base64, (deprecated, use type instead) true to generate base64.\n     * - compression, "STORE" by default.\n     * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.\n     * @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the zip file\n     */\n    generate: function(options) {\n        options = extend(options || {}, {\n            base64: true,\n            compression: "STORE",\n            type: "base64"\n        });\n\n        utils.checkSupport(options.type);\n\n        var zipData = [],\n            localDirLength = 0,\n            centralDirLength = 0,\n            writer, i;\n\n\n        // first, generate all the zip parts.\n        for (var name in this.files) {\n            if (!this.files.hasOwnProperty(name)) {\n                continue;\n            }\n            var file = this.files[name];\n\n            var compressionName = file.options.compression || options.compression.toUpperCase();\n            var compression = compressions[compressionName];\n            if (!compression) {\n                throw new Error(compressionName + " is not a valid compression method !");\n            }\n\n            var compressedObject = generateCompressedObjectFrom.call(this, file, compression);\n\n            var zipPart = generateZipParts.call(this, name, file, compressedObject, localDirLength);\n            localDirLength += zipPart.fileRecord.length + compressedObject.compressedSize;\n            centralDirLength += zipPart.dirRecord.length;\n            zipData.push(zipPart);\n        }\n\n        var dirEnd = "";\n\n        // end of central dir signature\n        dirEnd = signature.CENTRAL_DIRECTORY_END +\n        // number of this disk\n        "\\x00\\x00" +\n        // number of the disk with the start of the central directory\n        "\\x00\\x00" +\n        // total number of entries in the central directory on this disk\n        decToHex(zipData.length, 2) +\n        // total number of entries in the central directory\n        decToHex(zipData.length, 2) +\n        // size of the central directory   4 bytes\n        decToHex(centralDirLength, 4) +\n        // offset of start of central directory with respect to the starting disk number\n        decToHex(localDirLength, 4) +\n        // .ZIP file comment length\n        "\\x00\\x00";\n\n\n        // we have all the parts (and the total length)\n        // time to create a writer !\n        switch (options.type.toLowerCase()) {\n        case "uint8array":\n        case "arraybuffer":\n        case "blob":\n        case "nodebuffer":\n            writer = new Uint8ArrayWriter(localDirLength + centralDirLength + dirEnd.length);\n            break;\n        case "base64":\n        default:\n            // case "string" :\n            writer = new StringWriter(localDirLength + centralDirLength + dirEnd.length);\n            break;\n        }\n\n        for (i = 0; i < zipData.length; i++) {\n            writer.append(zipData[i].fileRecord);\n            writer.append(zipData[i].compressedObject.compressedContent);\n        }\n        for (i = 0; i < zipData.length; i++) {\n            writer.append(zipData[i].dirRecord);\n        }\n\n        writer.append(dirEnd);\n\n        var zip = writer.finalize();\n\n\n\n        switch (options.type.toLowerCase()) {\n            // case "zip is an Uint8Array"\n        case "uint8array":\n        case "arraybuffer":\n        case "nodebuffer":\n            return utils.transformTo(options.type.toLowerCase(), zip);\n        case "blob":\n            return utils.arrayBuffer2Blob(utils.transformTo("arraybuffer", zip));\n\n            // case "zip is a string"\n        case "base64":\n            return (options.base64) ? base64.encode(zip) : zip;\n        default:\n            // case "string" :\n            return zip;\n        }\n    },\n\n    /**\n     *\n     *  Javascript crc32\n     *  http://www.webtoolkit.info/\n     *\n     */\n    crc32: function crc32(input, crc) {\n        if (typeof input === "undefined" || !input.length) {\n            return 0;\n        }\n\n        var isArray = utils.getTypeOf(input) !== "string";\n\n        var table = [\n        0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,\n        0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,\n        0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,\n        0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,\n        0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,\n        0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,\n        0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,\n        0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,\n        0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,\n        0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,\n        0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,\n        0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,\n        0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,\n        0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,\n        0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,\n        0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,\n        0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,\n        0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,\n        0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,\n        0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,\n        0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,\n        0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,\n        0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,\n        0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,\n        0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,\n        0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,\n        0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,\n        0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,\n        0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,\n        0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,\n        0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,\n        0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,\n        0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,\n        0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,\n        0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,\n        0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,\n        0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,\n        0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,\n        0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,\n        0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,\n        0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,\n        0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,\n        0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,\n        0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,\n        0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,\n        0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,\n        0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,\n        0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,\n        0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,\n        0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,\n        0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,\n        0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,\n        0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,\n        0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,\n        0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,\n        0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,\n        0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,\n        0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,\n        0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,\n        0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,\n        0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,\n        0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,\n        0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,\n        0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D];\n\n        if (typeof(crc) == "undefined") {\n            crc = 0;\n        }\n        var x = 0;\n        var y = 0;\n        var byte = 0;\n\n        crc = crc ^ (-1);\n        for (var i = 0, iTop = input.length; i < iTop; i++) {\n            byte = isArray ? input[i] : input.charCodeAt(i);\n            y = (crc ^ byte) & 0xFF;\n            x = table[y];\n            crc = (crc >>> 8) ^ x;\n        }\n\n        return crc ^ (-1);\n    },\n\n    // Inspired by http://my.opera.com/GreyWyvern/blog/show.dml/1725165\n\n    /**\n     * http://www.webtoolkit.info/javascript-utf8.html\n     */\n    utf8encode: function(string) {\n        // TextEncoder + Uint8Array to binary string is faster than checking every bytes on long strings.\n        // http://jsperf.com/utf8encode-vs-textencoder\n        // On short strings (file names for example), the TextEncoder API is (currently) slower.\n        if (support.uint8array && typeof TextEncoder === "function") {\n            var u8 = TextEncoder("utf-8").encode(string);\n            return utils.transformTo("string", u8);\n        }\n        if (support.nodebuffer) {\n            return utils.transformTo("string", new Buffer(string, "utf-8"));\n        }\n\n        // array.join may be slower than string concatenation but generates less objects (less time spent garbage collecting).\n        // See also http://jsperf.com/array-direct-assignment-vs-push/31\n        var result = [],\n            resIndex = 0;\n\n        for (var n = 0; n < string.length; n++) {\n\n            var c = string.charCodeAt(n);\n\n            if (c < 128) {\n                result[resIndex++] = String.fromCharCode(c);\n            }\n            else if ((c > 127) && (c < 2048)) {\n                result[resIndex++] = String.fromCharCode((c >> 6) | 192);\n                result[resIndex++] = String.fromCharCode((c & 63) | 128);\n            }\n            else {\n                result[resIndex++] = String.fromCharCode((c >> 12) | 224);\n                result[resIndex++] = String.fromCharCode(((c >> 6) & 63) | 128);\n                result[resIndex++] = String.fromCharCode((c & 63) | 128);\n            }\n\n        }\n\n        return result.join("");\n    },\n\n    /**\n     * http://www.webtoolkit.info/javascript-utf8.html\n     */\n    utf8decode: function(input) {\n        var result = [],\n            resIndex = 0;\n        var type = utils.getTypeOf(input);\n        var isArray = type !== "string";\n        var i = 0;\n        var c = 0,\n            c1 = 0,\n            c2 = 0,\n            c3 = 0;\n\n        // check if we can use the TextDecoder API\n        // see http://encoding.spec.whatwg.org/#api\n        if (support.uint8array && typeof TextDecoder === "function") {\n            return TextDecoder("utf-8").decode(\n            utils.transformTo("uint8array", input));\n        }\n        if (support.nodebuffer) {\n            return utils.transformTo("nodebuffer", input).toString("utf-8");\n        }\n\n        while (i < input.length) {\n\n            c = isArray ? input[i] : input.charCodeAt(i);\n\n            if (c < 128) {\n                result[resIndex++] = String.fromCharCode(c);\n                i++;\n            }\n            else if ((c > 191) && (c < 224)) {\n                c2 = isArray ? input[i + 1] : input.charCodeAt(i + 1);\n                result[resIndex++] = String.fromCharCode(((c & 31) << 6) | (c2 & 63));\n                i += 2;\n            }\n            else {\n                c2 = isArray ? input[i + 1] : input.charCodeAt(i + 1);\n                c3 = isArray ? input[i + 2] : input.charCodeAt(i + 2);\n                result[resIndex++] = String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));\n                i += 3;\n            }\n\n        }\n\n        return result.join("");\n    }\n};\nmodule.exports = out;\n\n}).call(this,require("buffer").Buffer)\n},{"./base64":4,"./compressedObject":5,"./compressions":6,"./defaults":8,"./signature":16,"./support":18,"./utils":20,"buffer":24}],16:[function(require,module,exports){\nexports.LOCAL_FILE_HEADER = "PK\\x03\\x04";\nexports.CENTRAL_FILE_HEADER = "PK\\x01\\x02";\nexports.CENTRAL_DIRECTORY_END = "PK\\x05\\x06";\nexports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\\x06\\x07";\nexports.ZIP64_CENTRAL_DIRECTORY_END = "PK\\x06\\x06";\nexports.DATA_DESCRIPTOR = "PK\\x07\\x08";\n\n},{}],17:[function(require,module,exports){\nvar DataReader = require(\'./dataReader\');\nvar utils = require(\'./utils\');\n\nfunction StringReader(data, optimizedBinaryString) {\n    this.data = data;\n    if (!optimizedBinaryString) {\n        this.data = utils.string2binary(this.data);\n    }\n    this.length = this.data.length;\n    this.index = 0;\n}\nStringReader.prototype = new DataReader();\n/**\n * @see DataReader.byteAt\n */\nStringReader.prototype.byteAt = function(i) {\n    return this.data.charCodeAt(i);\n};\n/**\n * @see DataReader.lastIndexOfSignature\n */\nStringReader.prototype.lastIndexOfSignature = function(sig) {\n    return this.data.lastIndexOf(sig);\n};\n/**\n * @see DataReader.readData\n */\nStringReader.prototype.readData = function(size) {\n    this.checkOffset(size);\n    // this will work because the constructor applied the "& 0xff" mask.\n    var result = this.data.slice(this.index, this.index + size);\n    this.index += size;\n    return result;\n};\nmodule.exports = StringReader;\n},{"./dataReader":7,"./utils":20}],18:[function(require,module,exports){\n(function (Buffer){\nexports.base64 = true;\nexports.array = true;\nexports.string = true;\nexports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";\n// contains true if JSZip can read/generate nodejs Buffer, false otherwise.\nexports.nodebuffer = typeof Buffer !== "undefined";\n// contains true if JSZip can read/generate Uint8Array, false otherwise.\nexports.uint8array = typeof Uint8Array !== "undefined";\n\nif (typeof ArrayBuffer === "undefined") {\n    exports.blob = false;\n}\nelse {\n    var buffer = new ArrayBuffer(0);\n    try {\n        exports.blob = new Blob([buffer], {\n            type: "application/zip"\n        }).size === 0;\n    }\n    catch (e) {\n        try {\n            var b = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;\n            var builder = new b();\n            builder.append(buffer);\n            exports.blob = builder.getBlob(\'application/zip\').size === 0;\n        }\n        catch (e) {\n            exports.blob = false;\n        }\n    }\n}\n\n}).call(this,require("buffer").Buffer)\n},{"buffer":24}],19:[function(require,module,exports){\nvar DataReader = require(\'./dataReader\');\n\nfunction Uint8ArrayReader(data) {\n    if (data) {\n        this.data = data;\n        this.length = this.data.length;\n        this.index = 0;\n    }\n}\nUint8ArrayReader.prototype = new DataReader();\n/**\n * @see DataReader.byteAt\n */\nUint8ArrayReader.prototype.byteAt = function(i) {\n    return this.data[i];\n};\n/**\n * @see DataReader.lastIndexOfSignature\n */\nUint8ArrayReader.prototype.lastIndexOfSignature = function(sig) {\n    var sig0 = sig.charCodeAt(0),\n        sig1 = sig.charCodeAt(1),\n        sig2 = sig.charCodeAt(2),\n        sig3 = sig.charCodeAt(3);\n    for (var i = this.length - 4; i >= 0; --i) {\n        if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {\n            return i;\n        }\n    }\n\n    return -1;\n};\n/**\n * @see DataReader.readData\n */\nUint8ArrayReader.prototype.readData = function(size) {\n    this.checkOffset(size);\n    var result = this.data.subarray(this.index, this.index + size);\n    this.index += size;\n    return result;\n};\nmodule.exports = Uint8ArrayReader;\n},{"./dataReader":7}],20:[function(require,module,exports){\n(function (Buffer){\nvar support = require(\'./support\');\nvar compressions = require(\'./compressions\');\n/**\n * Convert a string to a "binary string" : a string containing only char codes between 0 and 255.\n * @param {string} str the string to transform.\n * @return {String} the binary string.\n */\nexports.string2binary = function(str) {\n    var result = "";\n    for (var i = 0; i < str.length; i++) {\n        result += String.fromCharCode(str.charCodeAt(i) & 0xff);\n    }\n    return result;\n};\n/**\n * Create a Uint8Array from the string.\n * @param {string} str the string to transform.\n * @return {Uint8Array} the typed array.\n * @throws {Error} an Error if the browser doesn\'t support the requested feature.\n */\nexports.string2Uint8Array = function(str) {\n    return exports.transformTo("uint8array", str);\n};\n\n/**\n * Create a string from the Uint8Array.\n * @param {Uint8Array} array the array to transform.\n * @return {string} the string.\n * @throws {Error} an Error if the browser doesn\'t support the requested feature.\n */\nexports.uint8Array2String = function(array) {\n    return exports.transformTo("string", array);\n};\n/**\n * Create a blob from the given string.\n * @param {string} str the string to transform.\n * @return {Blob} the string.\n * @throws {Error} an Error if the browser doesn\'t support the requested feature.\n */\nexports.string2Blob = function(str) {\n    var buffer = exports.transformTo("arraybuffer", str);\n    return exports.arrayBuffer2Blob(buffer);\n};\nexports.arrayBuffer2Blob = function(buffer) {\n    exports.checkSupport("blob");\n\n    try {\n        // Blob constructor\n        return new Blob([buffer], {\n            type: "application/zip"\n        });\n    }\n    catch (e) {\n\n        try {\n            // deprecated, browser only, old way\n            var builder = new(window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder)();\n            builder.append(buffer);\n            return builder.getBlob(\'application/zip\');\n        }\n        catch (e) {\n\n            // well, fuck ?!\n            throw new Error("Bug : can\'t construct the Blob.");\n        }\n    }\n\n\n};\n/**\n * The identity function.\n * @param {Object} input the input.\n * @return {Object} the same input.\n */\nfunction identity(input) {\n    return input;\n};\n\n/**\n * Fill in an array with a string.\n * @param {String} str the string to use.\n * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to fill in (will be mutated).\n * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated array.\n */\nfunction stringToArrayLike(str, array) {\n    for (var i = 0; i < str.length; ++i) {\n        array[i] = str.charCodeAt(i) & 0xFF;\n    }\n    return array;\n};\n\n/**\n * Transform an array-like object to a string.\n * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.\n * @return {String} the result.\n */\nfunction arrayLikeToString(array) {\n    // Performances notes :\n    // --------------------\n    // String.fromCharCode.apply(null, array) is the fastest, see\n    // see http://jsperf.com/converting-a-uint8array-to-a-string/2\n    // but the stack is limited (and we can get huge arrays !).\n    //\n    // result += String.fromCharCode(array[i]); generate too many strings !\n    //\n    // This code is inspired by http://jsperf.com/arraybuffer-to-string-apply-performance/2\n    var chunk = 65536;\n    var result = [],\n        len = array.length,\n        type = exports.getTypeOf(array),\n        k = 0;\n\n    while (k < len && chunk > 1) {\n        try {\n            if (type === "array" || type === "nodebuffer") {\n                result.push(String.fromCharCode.apply(null, array.slice(k, Math.max(k + chunk, len))));\n            }\n            else {\n                result.push(String.fromCharCode.apply(null, array.subarray(k, k + chunk)));\n            }\n            k += chunk;\n        }\n        catch (e) {\n            chunk = Math.floor(chunk / 2);\n        }\n    }\n    return result.join("");\n};\n\n/**\n * Copy the data from an array-like to an other array-like.\n * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayFrom the origin array.\n * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayTo the destination array which will be mutated.\n * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated destination array.\n */\nfunction arrayLikeToArrayLike(arrayFrom, arrayTo) {\n    for (var i = 0; i < arrayFrom.length; i++) {\n        arrayTo[i] = arrayFrom[i];\n    }\n    return arrayTo;\n};\n\n// a matrix containing functions to transform everything into everything.\nvar transform = {};\n\n// string to ?\ntransform["string"] = {\n    "string": identity,\n    "array": function(input) {\n        return stringToArrayLike(input, new Array(input.length));\n    },\n    "arraybuffer": function(input) {\n        return transform["string"]["uint8array"](input).buffer;\n    },\n    "uint8array": function(input) {\n        return stringToArrayLike(input, new Uint8Array(input.length));\n    },\n    "nodebuffer": function(input) {\n        return stringToArrayLike(input, new Buffer(input.length));\n    }\n};\n\n// array to ?\ntransform["array"] = {\n    "string": arrayLikeToString,\n    "array": identity,\n    "arraybuffer": function(input) {\n        return (new Uint8Array(input)).buffer;\n    },\n    "uint8array": function(input) {\n        return new Uint8Array(input);\n    },\n    "nodebuffer": function(input) {\n        return new Buffer(input);\n    }\n};\n\n// arraybuffer to ?\ntransform["arraybuffer"] = {\n    "string": function(input) {\n        return arrayLikeToString(new Uint8Array(input));\n    },\n    "array": function(input) {\n        return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));\n    },\n    "arraybuffer": identity,\n    "uint8array": function(input) {\n        return new Uint8Array(input);\n    },\n    "nodebuffer": function(input) {\n        return new Buffer(new Uint8Array(input));\n    }\n};\n\n// uint8array to ?\ntransform["uint8array"] = {\n    "string": arrayLikeToString,\n    "array": function(input) {\n        return arrayLikeToArrayLike(input, new Array(input.length));\n    },\n    "arraybuffer": function(input) {\n        return input.buffer;\n    },\n    "uint8array": identity,\n    "nodebuffer": function(input) {\n        return new Buffer(input);\n    }\n};\n\n// nodebuffer to ?\ntransform["nodebuffer"] = {\n    "string": arrayLikeToString,\n    "array": function(input) {\n        return arrayLikeToArrayLike(input, new Array(input.length));\n    },\n    "arraybuffer": function(input) {\n        return transform["nodebuffer"]["uint8array"](input).buffer;\n    },\n    "uint8array": function(input) {\n        return arrayLikeToArrayLike(input, new Uint8Array(input.length));\n    },\n    "nodebuffer": identity\n};\n\n/**\n * Transform an input into any type.\n * The supported output type are : string, array, uint8array, arraybuffer, nodebuffer.\n * If no output type is specified, the unmodified input will be returned.\n * @param {String} outputType the output type.\n * @param {String|Array|ArrayBuffer|Uint8Array|Buffer} input the input to convert.\n * @throws {Error} an Error if the browser doesn\'t support the requested output type.\n */\nexports.transformTo = function(outputType, input) {\n    if (!input) {\n        // undefined, null, etc\n        // an empty string won\'t harm.\n        input = "";\n    }\n    if (!outputType) {\n        return input;\n    }\n    exports.checkSupport(outputType);\n    var inputType = exports.getTypeOf(input);\n    var result = transform[inputType][outputType](input);\n    return result;\n};\n\n/**\n * Return the type of the input.\n * The type will be in a format valid for JSZip.utils.transformTo : string, array, uint8array, arraybuffer.\n * @param {Object} input the input to identify.\n * @return {String} the (lowercase) type of the input.\n */\nexports.getTypeOf = function(input) {\n    if (typeof input === "string") {\n        return "string";\n    }\n    if (input instanceof Array) {\n        return "array";\n    }\n    if (support.nodebuffer && Buffer.isBuffer(input)) {\n        return "nodebuffer";\n    }\n    if (support.uint8array && input instanceof Uint8Array) {\n        return "uint8array";\n    }\n    if (support.arraybuffer && input instanceof ArrayBuffer) {\n        return "arraybuffer";\n    }\n};\n\n/**\n * Throw an exception if the type is not supported.\n * @param {String} type the type to check.\n * @throws {Error} an Error if the browser doesn\'t support the requested type.\n */\nexports.checkSupport = function(type) {\n    var supported = support[type.toLowerCase()];\n    if (!supported) {\n        throw new Error(type + " is not supported by this browser");\n    }\n};\nexports.MAX_VALUE_16BITS = 65535;\nexports.MAX_VALUE_32BITS = -1; // well, "\\xFF\\xFF\\xFF\\xFF\\xFF\\xFF\\xFF\\xFF" is parsed as -1\n\n/**\n * Prettify a string read as binary.\n * @param {string} str the string to prettify.\n * @return {string} a pretty string.\n */\nexports.pretty = function(str) {\n    var res = \'\',\n        code, i;\n    for (i = 0; i < (str || "").length; i++) {\n        code = str.charCodeAt(i);\n        res += \'\\\\x\' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();\n    }\n    return res;\n};\n\n/**\n * Find a compression registered in JSZip.\n * @param {string} compressionMethod the method magic to find.\n * @return {Object|null} the JSZip compression object, null if none found.\n */\nexports.findCompression = function(compressionMethod) {\n    for (var method in compressions) {\n        if (!compressions.hasOwnProperty(method)) {\n            continue;\n        }\n        if (compressions[method].magic === compressionMethod) {\n            return compressions[method];\n        }\n    }\n    return null;\n};\n\n}).call(this,require("buffer").Buffer)\n},{"./compressions":6,"./support":18,"buffer":24}],21:[function(require,module,exports){\nvar StringReader = require(\'./stringReader\');\nvar NodeBufferReader = require(\'./nodeBufferReader\');\nvar Uint8ArrayReader = require(\'./uint8ArrayReader\');\nvar utils = require(\'./utils\');\nvar sig = require(\'./signature\');\nvar ZipEntry = require(\'./zipEntry\');\nvar support = require(\'./support\');\n//  class ZipEntries {{{\n/**\n * All the entries in the zip file.\n * @constructor\n * @param {String|ArrayBuffer|Uint8Array} data the binary stream to load.\n * @param {Object} loadOptions Options for loading the stream.\n */\nfunction ZipEntries(data, loadOptions) {\n    this.files = [];\n    this.loadOptions = loadOptions;\n    if (data) {\n        this.load(data);\n    }\n}\nZipEntries.prototype = {\n    /**\n     * Check that the reader is on the speficied signature.\n     * @param {string} expectedSignature the expected signature.\n     * @throws {Error} if it is an other signature.\n     */\n    checkSignature: function(expectedSignature) {\n        var signature = this.reader.readString(4);\n        if (signature !== expectedSignature) {\n            throw new Error("Corrupted zip or bug : unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");\n        }\n    },\n    /**\n     * Read the end of the central directory.\n     */\n    readBlockEndOfCentral: function() {\n        this.diskNumber = this.reader.readInt(2);\n        this.diskWithCentralDirStart = this.reader.readInt(2);\n        this.centralDirRecordsOnThisDisk = this.reader.readInt(2);\n        this.centralDirRecords = this.reader.readInt(2);\n        this.centralDirSize = this.reader.readInt(4);\n        this.centralDirOffset = this.reader.readInt(4);\n\n        this.zipCommentLength = this.reader.readInt(2);\n        this.zipComment = this.reader.readString(this.zipCommentLength);\n    },\n    /**\n     * Read the end of the Zip 64 central directory.\n     * Not merged with the method readEndOfCentral :\n     * The end of central can coexist with its Zip64 brother,\n     * I don\'t want to read the wrong number of bytes !\n     */\n    readBlockZip64EndOfCentral: function() {\n        this.zip64EndOfCentralSize = this.reader.readInt(8);\n        this.versionMadeBy = this.reader.readString(2);\n        this.versionNeeded = this.reader.readInt(2);\n        this.diskNumber = this.reader.readInt(4);\n        this.diskWithCentralDirStart = this.reader.readInt(4);\n        this.centralDirRecordsOnThisDisk = this.reader.readInt(8);\n        this.centralDirRecords = this.reader.readInt(8);\n        this.centralDirSize = this.reader.readInt(8);\n        this.centralDirOffset = this.reader.readInt(8);\n\n        this.zip64ExtensibleData = {};\n        var extraDataSize = this.zip64EndOfCentralSize - 44,\n            index = 0,\n            extraFieldId,\n            extraFieldLength,\n            extraFieldValue;\n        while (index < extraDataSize) {\n            extraFieldId = this.reader.readInt(2);\n            extraFieldLength = this.reader.readInt(4);\n            extraFieldValue = this.reader.readString(extraFieldLength);\n            this.zip64ExtensibleData[extraFieldId] = {\n                id: extraFieldId,\n                length: extraFieldLength,\n                value: extraFieldValue\n            };\n        }\n    },\n    /**\n     * Read the end of the Zip 64 central directory locator.\n     */\n    readBlockZip64EndOfCentralLocator: function() {\n        this.diskWithZip64CentralDirStart = this.reader.readInt(4);\n        this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);\n        this.disksCount = this.reader.readInt(4);\n        if (this.disksCount > 1) {\n            throw new Error("Multi-volumes zip are not supported");\n        }\n    },\n    /**\n     * Read the local files, based on the offset read in the central part.\n     */\n    readLocalFiles: function() {\n        var i, file;\n        for (i = 0; i < this.files.length; i++) {\n            file = this.files[i];\n            this.reader.setIndex(file.localHeaderOffset);\n            this.checkSignature(sig.LOCAL_FILE_HEADER);\n            file.readLocalPart(this.reader);\n            file.handleUTF8();\n        }\n    },\n    /**\n     * Read the central directory.\n     */\n    readCentralDir: function() {\n        var file;\n\n        this.reader.setIndex(this.centralDirOffset);\n        while (this.reader.readString(4) === sig.CENTRAL_FILE_HEADER) {\n            file = new ZipEntry({\n                zip64: this.zip64\n            }, this.loadOptions);\n            file.readCentralPart(this.reader);\n            this.files.push(file);\n        }\n    },\n    /**\n     * Read the end of central directory.\n     */\n    readEndOfCentral: function() {\n        var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);\n        if (offset === -1) {\n            throw new Error("Corrupted zip : can\'t find end of central directory");\n        }\n        this.reader.setIndex(offset);\n        this.checkSignature(sig.CENTRAL_DIRECTORY_END);\n        this.readBlockEndOfCentral();\n\n\n        /* extract from the zip spec :\n            4)  If one of the fields in the end of central directory\n                record is too small to hold required data, the field\n                should be set to -1 (0xFFFF or 0xFFFFFFFF) and the\n                ZIP64 format record should be created.\n            5)  The end of central directory record and the\n                Zip64 end of central directory locator record must\n                reside on the same disk when splitting or spanning\n                an archive.\n         */\n        if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {\n            this.zip64 = true;\n\n            /*\n            Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from\n            the zip file can fit into a 32bits integer. This cannot be solved : Javascript represents\n            all numbers as 64-bit double precision IEEE 754 floating point numbers.\n            So, we have 53bits for integers and bitwise operations treat everything as 32bits.\n            see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators\n            and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5\n            */\n\n            // should look for a zip64 EOCD locator\n            offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);\n            if (offset === -1) {\n                throw new Error("Corrupted zip : can\'t find the ZIP64 end of central directory locator");\n            }\n            this.reader.setIndex(offset);\n            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);\n            this.readBlockZip64EndOfCentralLocator();\n\n            // now the zip64 EOCD record\n            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);\n            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);\n            this.readBlockZip64EndOfCentral();\n        }\n    },\n    prepareReader: function(data) {\n        var type = utils.getTypeOf(data);\n        if (type === "string" && !support.uint8array) {\n            this.reader = new StringReader(data, this.loadOptions.optimizedBinaryString);\n        }\n        else if (type === "nodebuffer") {\n            this.reader = new NodeBufferReader(data);\n        }\n        else {\n            this.reader = new Uint8ArrayReader(utils.transformTo("uint8array", data));\n        }\n    },\n    /**\n     * Read a zip file and create ZipEntries.\n     * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.\n     */\n    load: function(data) {\n        this.prepareReader(data);\n        this.readEndOfCentral();\n        this.readCentralDir();\n        this.readLocalFiles();\n    }\n};\n// }}} end of ZipEntries\nmodule.exports = ZipEntries;\n},{"./nodeBufferReader":14,"./signature":16,"./stringReader":17,"./support":18,"./uint8ArrayReader":19,"./utils":20,"./zipEntry":22}],22:[function(require,module,exports){\nvar StringReader = require(\'./stringReader\');\nvar utils = require(\'./utils\');\nvar CompressedObject = require(\'./compressedObject\');\nvar jszipProto = require(\'./object\');\n// class ZipEntry {{{\n/**\n * An entry in the zip file.\n * @constructor\n * @param {Object} options Options of the current file.\n * @param {Object} loadOptions Options for loading the stream.\n */\nfunction ZipEntry(options, loadOptions) {\n    this.options = options;\n    this.loadOptions = loadOptions;\n}\nZipEntry.prototype = {\n    /**\n     * say if the file is encrypted.\n     * @return {boolean} true if the file is encrypted, false otherwise.\n     */\n    isEncrypted: function() {\n        // bit 1 is set\n        return (this.bitFlag & 0x0001) === 0x0001;\n    },\n    /**\n     * say if the file has utf-8 filename/comment.\n     * @return {boolean} true if the filename/comment is in utf-8, false otherwise.\n     */\n    useUTF8: function() {\n        // bit 11 is set\n        return (this.bitFlag & 0x0800) === 0x0800;\n    },\n    /**\n     * Prepare the function used to generate the compressed content from this ZipFile.\n     * @param {DataReader} reader the reader to use.\n     * @param {number} from the offset from where we should read the data.\n     * @param {number} length the length of the data to read.\n     * @return {Function} the callback to get the compressed content (the type depends of the DataReader class).\n     */\n    prepareCompressedContent: function(reader, from, length) {\n        return function() {\n            var previousIndex = reader.index;\n            reader.setIndex(from);\n            var compressedFileData = reader.readData(length);\n            reader.setIndex(previousIndex);\n\n            return compressedFileData;\n        }\n    },\n    /**\n     * Prepare the function used to generate the uncompressed content from this ZipFile.\n     * @param {DataReader} reader the reader to use.\n     * @param {number} from the offset from where we should read the data.\n     * @param {number} length the length of the data to read.\n     * @param {JSZip.compression} compression the compression used on this file.\n     * @param {number} uncompressedSize the uncompressed size to expect.\n     * @return {Function} the callback to get the uncompressed content (the type depends of the DataReader class).\n     */\n    prepareContent: function(reader, from, length, compression, uncompressedSize) {\n        return function() {\n\n            var compressedFileData = utils.transformTo(compression.uncompressInputType, this.getCompressedContent());\n            var uncompressedFileData = compression.uncompress(compressedFileData);\n\n            if (uncompressedFileData.length !== uncompressedSize) {\n                throw new Error("Bug : uncompressed data size mismatch");\n            }\n\n            return uncompressedFileData;\n        }\n    },\n    /**\n     * Read the local part of a zip file and add the info in this object.\n     * @param {DataReader} reader the reader to use.\n     */\n    readLocalPart: function(reader) {\n        var compression, localExtraFieldsLength;\n\n        // we already know everything from the central dir !\n        // If the central dir data are false, we are doomed.\n        // On the bright side, the local part is scary  : zip64, data descriptors, both, etc.\n        // The less data we get here, the more reliable this should be.\n        // Let\'s skip the whole header and dash to the data !\n        reader.skip(22);\n        // in some zip created on windows, the filename stored in the central dir contains \\ instead of /.\n        // Strangely, the filename here is OK.\n        // I would love to treat these zip files as corrupted (see http://www.info-zip.org/FAQ.html#backslashes\n        // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes \'/\'") but there are a lot of bad zip generators...\n        // Search "unzip mismatching "local" filename continuing with "central" filename version" on\n        // the internet.\n        //\n        // I think I see the logic here : the central directory is used to display\n        // content and the local directory is used to extract the files. Mixing / and \\\n        // may be used to display \\ to windows users and use / when extracting the files.\n        // Unfortunately, this lead also to some issues : http://seclists.org/fulldisclosure/2009/Sep/394\n        this.fileNameLength = reader.readInt(2);\n        localExtraFieldsLength = reader.readInt(2); // can\'t be sure this will be the same as the central dir\n        this.fileName = reader.readString(this.fileNameLength);\n        reader.skip(localExtraFieldsLength);\n\n        if (this.compressedSize == -1 || this.uncompressedSize == -1) {\n            throw new Error("Bug or corrupted zip : didn\'t get enough informations from the central directory " + "(compressedSize == -1 || uncompressedSize == -1)");\n        }\n\n        compression = utils.findCompression(this.compressionMethod);\n        if (compression === null) { // no compression found\n            throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + this.fileName + ")");\n        }\n        this.decompressed = new CompressedObject();\n        this.decompressed.compressedSize = this.compressedSize;\n        this.decompressed.uncompressedSize = this.uncompressedSize;\n        this.decompressed.crc32 = this.crc32;\n        this.decompressed.compressionMethod = this.compressionMethod;\n        this.decompressed.getCompressedContent = this.prepareCompressedContent(reader, reader.index, this.compressedSize, compression);\n        this.decompressed.getContent = this.prepareContent(reader, reader.index, this.compressedSize, compression, this.uncompressedSize);\n\n        // we need to compute the crc32...\n        if (this.loadOptions.checkCRC32) {\n            this.decompressed = utils.transformTo("string", this.decompressed.getContent());\n            if (jszipProto.crc32(this.decompressed) !== this.crc32) {\n                throw new Error("Corrupted zip : CRC32 mismatch");\n            }\n        }\n    },\n\n    /**\n     * Read the central part of a zip file and add the info in this object.\n     * @param {DataReader} reader the reader to use.\n     */\n    readCentralPart: function(reader) {\n        this.versionMadeBy = reader.readString(2);\n        this.versionNeeded = reader.readInt(2);\n        this.bitFlag = reader.readInt(2);\n        this.compressionMethod = reader.readString(2);\n        this.date = reader.readDate();\n        this.crc32 = reader.readInt(4);\n        this.compressedSize = reader.readInt(4);\n        this.uncompressedSize = reader.readInt(4);\n        this.fileNameLength = reader.readInt(2);\n        this.extraFieldsLength = reader.readInt(2);\n        this.fileCommentLength = reader.readInt(2);\n        this.diskNumberStart = reader.readInt(2);\n        this.internalFileAttributes = reader.readInt(2);\n        this.externalFileAttributes = reader.readInt(4);\n        this.localHeaderOffset = reader.readInt(4);\n\n        if (this.isEncrypted()) {\n            throw new Error("Encrypted zip are not supported");\n        }\n\n        this.fileName = reader.readString(this.fileNameLength);\n        this.readExtraFields(reader);\n        this.parseZIP64ExtraField(reader);\n        this.fileComment = reader.readString(this.fileCommentLength);\n\n        // warning, this is true only for zip with madeBy == DOS (plateform dependent feature)\n        this.dir = this.externalFileAttributes & 0x00000010 ? true : false;\n    },\n    /**\n     * Parse the ZIP64 extra field and merge the info in the current ZipEntry.\n     * @param {DataReader} reader the reader to use.\n     */\n    parseZIP64ExtraField: function(reader) {\n\n        if (!this.extraFields[0x0001]) {\n            return;\n        }\n\n        // should be something, preparing the extra reader\n        var extraReader = new StringReader(this.extraFields[0x0001].value);\n\n        // I really hope that these 64bits integer can fit in 32 bits integer, because js\n        // won\'t let us have more.\n        if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {\n            this.uncompressedSize = extraReader.readInt(8);\n        }\n        if (this.compressedSize === utils.MAX_VALUE_32BITS) {\n            this.compressedSize = extraReader.readInt(8);\n        }\n        if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {\n            this.localHeaderOffset = extraReader.readInt(8);\n        }\n        if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {\n            this.diskNumberStart = extraReader.readInt(4);\n        }\n    },\n    /**\n     * Read the central part of a zip file and add the info in this object.\n     * @param {DataReader} reader the reader to use.\n     */\n    readExtraFields: function(reader) {\n        var start = reader.index,\n            extraFieldId,\n            extraFieldLength,\n            extraFieldValue;\n\n        this.extraFields = this.extraFields || {};\n\n        while (reader.index < start + this.extraFieldsLength) {\n            extraFieldId = reader.readInt(2);\n            extraFieldLength = reader.readInt(2);\n            extraFieldValue = reader.readString(extraFieldLength);\n\n            this.extraFields[extraFieldId] = {\n                id: extraFieldId,\n                length: extraFieldLength,\n                value: extraFieldValue\n            };\n        }\n    },\n    /**\n     * Apply an UTF8 transformation if needed.\n     */\n    handleUTF8: function() {\n        if (this.useUTF8()) {\n            this.fileName = jszipProto.utf8decode(this.fileName);\n            this.fileComment = jszipProto.utf8decode(this.fileComment);\n        }\n    }\n};\nmodule.exports = ZipEntry;\n\n},{"./compressedObject":5,"./object":15,"./stringReader":17,"./utils":20}],23:[function(require,module,exports){\n(function (Buffer){\n// wrapper for non-node envs\n;(function (sax) {\n\nsax.parser = function (strict, opt) { return new SAXParser(strict, opt) }\nsax.SAXParser = SAXParser\nsax.SAXStream = SAXStream\nsax.createStream = createStream\n\n// When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.\n// When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),\n// since that\'s the earliest that a buffer overrun could occur.  This way, checks are\n// as rare as required, but as often as necessary to ensure never crossing this bound.\n// Furthermore, buffers are only tested at most once per write(), so passing a very\n// large string into write() might have undesirable effects, but this is manageable by\n// the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme\n// edge case, result in creating at most one complete copy of the string passed in.\n// Set to Infinity to have unlimited buffers.\nsax.MAX_BUFFER_LENGTH = 64 * 1024\n\nvar buffers = [\n  "comment", "sgmlDecl", "textNode", "tagName", "doctype",\n  "procInstName", "procInstBody", "entity", "attribName",\n  "attribValue", "cdata", "script"\n]\n\nsax.EVENTS = // for discoverability.\n  [ "text"\n  , "processinginstruction"\n  , "sgmldeclaration"\n  , "doctype"\n  , "comment"\n  , "attribute"\n  , "opentag"\n  , "closetag"\n  , "opencdata"\n  , "cdata"\n  , "closecdata"\n  , "error"\n  , "end"\n  , "ready"\n  , "script"\n  , "opennamespace"\n  , "closenamespace"\n  ]\n\nfunction SAXParser (strict, opt) {\n  if (!(this instanceof SAXParser)) return new SAXParser(strict, opt)\n\n  var parser = this\n  clearBuffers(parser)\n  parser.q = parser.c = ""\n  parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH\n  parser.opt = opt || {}\n  parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags\n  parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase"\n  parser.tags = []\n  parser.closed = parser.closedRoot = parser.sawRoot = false\n  parser.tag = parser.error = null\n  parser.strict = !!strict\n  parser.noscript = !!(strict || parser.opt.noscript)\n  parser.state = S.BEGIN\n  parser.ENTITIES = Object.create(sax.ENTITIES)\n  parser.attribList = []\n\n  // namespaces form a prototype chain.\n  // it always points at the current tag,\n  // which protos to its parent tag.\n  if (parser.opt.xmlns) parser.ns = Object.create(rootNS)\n\n  // mostly just for error reporting\n  parser.trackPosition = parser.opt.position !== false\n  if (parser.trackPosition) {\n    parser.position = parser.line = parser.column = 0\n  }\n  emit(parser, "onready")\n}\n\nif (!Object.create) Object.create = function (o) {\n  function f () { this.__proto__ = o }\n  f.prototype = o\n  return new f\n}\n\nif (!Object.getPrototypeOf) Object.getPrototypeOf = function (o) {\n  return o.__proto__\n}\n\nif (!Object.keys) Object.keys = function (o) {\n  var a = []\n  for (var i in o) if (o.hasOwnProperty(i)) a.push(i)\n  return a\n}\n\nfunction checkBufferLength (parser) {\n  var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10)\n    , maxActual = 0\n  for (var i = 0, l = buffers.length; i < l; i ++) {\n    var len = parser[buffers[i]].length\n    if (len > maxAllowed) {\n      // Text/cdata nodes can get big, and since they\'re buffered,\n      // we can get here under normal conditions.\n      // Avoid issues by emitting the text node now,\n      // so at least it won\'t get any bigger.\n      switch (buffers[i]) {\n        case "textNode":\n          closeText(parser)\n        break\n\n        case "cdata":\n          emitNode(parser, "oncdata", parser.cdata)\n          parser.cdata = ""\n        break\n\n        case "script":\n          emitNode(parser, "onscript", parser.script)\n          parser.script = ""\n        break\n\n        default:\n          error(parser, "Max buffer length exceeded: "+buffers[i])\n      }\n    }\n    maxActual = Math.max(maxActual, len)\n  }\n  // schedule the next check for the earliest possible buffer overrun.\n  parser.bufferCheckPosition = (sax.MAX_BUFFER_LENGTH - maxActual)\n                             + parser.position\n}\n\nfunction clearBuffers (parser) {\n  for (var i = 0, l = buffers.length; i < l; i ++) {\n    parser[buffers[i]] = ""\n  }\n}\n\nfunction flushBuffers (parser) {\n  closeText(parser)\n  if (parser.cdata !== "") {\n    emitNode(parser, "oncdata", parser.cdata)\n    parser.cdata = ""\n  }\n  if (parser.script !== "") {\n    emitNode(parser, "onscript", parser.script)\n    parser.script = ""\n  }\n}\n\nSAXParser.prototype =\n  { end: function () { end(this) }\n  , write: write\n  , resume: function () { this.error = null; return this }\n  , close: function () { return this.write(null) }\n  , flush: function () { flushBuffers(this) }\n  }\n\ntry {\n  var Stream = require("stream").Stream\n} catch (ex) {\n  var Stream = function () {}\n}\n\n\nvar streamWraps = sax.EVENTS.filter(function (ev) {\n  return ev !== "error" && ev !== "end"\n})\n\nfunction createStream (strict, opt) {\n  return new SAXStream(strict, opt)\n}\n\nfunction SAXStream (strict, opt) {\n  if (!(this instanceof SAXStream)) return new SAXStream(strict, opt)\n\n  Stream.apply(this)\n\n  this._parser = new SAXParser(strict, opt)\n  this.writable = true\n  this.readable = true\n\n\n  var me = this\n\n  this._parser.onend = function () {\n    me.emit("end")\n  }\n\n  this._parser.onerror = function (er) {\n    me.emit("error", er)\n\n    // if didn\'t throw, then means error was handled.\n    // go ahead and clear error, so we can write again.\n    me._parser.error = null\n  }\n\n  this._decoder = null;\n\n  streamWraps.forEach(function (ev) {\n    Object.defineProperty(me, "on" + ev, {\n      get: function () { return me._parser["on" + ev] },\n      set: function (h) {\n        if (!h) {\n          me.removeAllListeners(ev)\n          return me._parser["on"+ev] = h\n        }\n        me.on(ev, h)\n      },\n      enumerable: true,\n      configurable: false\n    })\n  })\n}\n\nSAXStream.prototype = Object.create(Stream.prototype,\n  { constructor: { value: SAXStream } })\n\nSAXStream.prototype.write = function (data) {\n  if (typeof Buffer === \'function\' &&\n      typeof Buffer.isBuffer === \'function\' &&\n      Buffer.isBuffer(data)) {\n    if (!this._decoder) {\n      var SD = require(\'string_decoder\').StringDecoder\n      this._decoder = new SD(\'utf8\')\n    }\n    data = this._decoder.write(data);\n  }\n\n  this._parser.write(data.toString())\n  this.emit("data", data)\n  return true\n}\n\nSAXStream.prototype.end = function (chunk) {\n  if (chunk && chunk.length) this.write(chunk)\n  this._parser.end()\n  return true\n}\n\nSAXStream.prototype.on = function (ev, handler) {\n  var me = this\n  if (!me._parser["on"+ev] && streamWraps.indexOf(ev) !== -1) {\n    me._parser["on"+ev] = function () {\n      var args = arguments.length === 1 ? [arguments[0]]\n               : Array.apply(null, arguments)\n      args.splice(0, 0, ev)\n      me.emit.apply(me, args)\n    }\n  }\n\n  return Stream.prototype.on.call(me, ev, handler)\n}\n\n\n\n// character classes and tokens\nvar whitespace = "\\r\\n\\t "\n  // this really needs to be replaced with character classes.\n  // XML allows all manner of ridiculous numbers and digits.\n  , number = "0124356789"\n  , letter = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"\n  // (Letter | "_" | ":")\n  , quote = "\'\\""\n  , entity = number+letter+"#"\n  , attribEnd = whitespace + ">"\n  , CDATA = "[CDATA["\n  , DOCTYPE = "DOCTYPE"\n  , XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"\n  , XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"\n  , rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE }\n\n// turn all the string character sets into character class objects.\nwhitespace = charClass(whitespace)\nnumber = charClass(number)\nletter = charClass(letter)\n\n// http://www.w3.org/TR/REC-xml/#NT-NameStartChar\n// This implementation works on strings, a single character at a time\n// as such, it cannot ever support astral-plane characters (10000-EFFFF)\n// without a significant breaking change to either this  parser, or the\n// JavaScript language.  Implementation of an emoji-capable xml parser\n// is left as an exercise for the reader.\nvar nameStart = /[:_A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]/\n\nvar nameBody = /[:_A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u00B7\\u0300-\\u036F\\u203F-\\u2040\\.\\d-]/\n\nquote = charClass(quote)\nentity = charClass(entity)\nattribEnd = charClass(attribEnd)\n\nfunction charClass (str) {\n  return str.split("").reduce(function (s, c) {\n    s[c] = true\n    return s\n  }, {})\n}\n\nfunction isRegExp (c) {\n  return Object.prototype.toString.call(c) === \'[object RegExp]\'\n}\n\nfunction is (charclass, c) {\n  return isRegExp(charclass) ? !!c.match(charclass) : charclass[c]\n}\n\nfunction not (charclass, c) {\n  return !is(charclass, c)\n}\n\nvar S = 0\nsax.STATE =\n{ BEGIN                     : S++\n, TEXT                      : S++ // general stuff\n, TEXT_ENTITY               : S++ // &amp and such.\n, OPEN_WAKA                 : S++ // <\n, SGML_DECL                 : S++ // <!BLARG\n, SGML_DECL_QUOTED          : S++ // <!BLARG foo "bar\n, DOCTYPE                   : S++ // <!DOCTYPE\n, DOCTYPE_QUOTED            : S++ // <!DOCTYPE "//blah\n, DOCTYPE_DTD               : S++ // <!DOCTYPE "//blah" [ ...\n, DOCTYPE_DTD_QUOTED        : S++ // <!DOCTYPE "//blah" [ "foo\n, COMMENT_STARTING          : S++ // <!-\n, COMMENT                   : S++ // <!--\n, COMMENT_ENDING            : S++ // <!-- blah -\n, COMMENT_ENDED             : S++ // <!-- blah --\n, CDATA                     : S++ // <![CDATA[ something\n, CDATA_ENDING              : S++ // ]\n, CDATA_ENDING_2            : S++ // ]]\n, PROC_INST                 : S++ // <?hi\n, PROC_INST_BODY            : S++ // <?hi there\n, PROC_INST_ENDING          : S++ // <?hi "there" ?\n, OPEN_TAG                  : S++ // <strong\n, OPEN_TAG_SLASH            : S++ // <strong /\n, ATTRIB                    : S++ // <a\n, ATTRIB_NAME               : S++ // <a foo\n, ATTRIB_NAME_SAW_WHITE     : S++ // <a foo _\n, ATTRIB_VALUE              : S++ // <a foo=\n, ATTRIB_VALUE_QUOTED       : S++ // <a foo="bar\n, ATTRIB_VALUE_CLOSED       : S++ // <a foo="bar"\n, ATTRIB_VALUE_UNQUOTED     : S++ // <a foo=bar\n, ATTRIB_VALUE_ENTITY_Q     : S++ // <foo bar="&quot;"\n, ATTRIB_VALUE_ENTITY_U     : S++ // <foo bar=&quot;\n, CLOSE_TAG                 : S++ // </a\n, CLOSE_TAG_SAW_WHITE       : S++ // </a   >\n, SCRIPT                    : S++ // <script> ...\n, SCRIPT_ENDING             : S++ // <script> ... <\n}\n\nsax.ENTITIES =\n{ "amp" : "&"\n, "gt" : ">"\n, "lt" : "<"\n, "quot" : "\\""\n, "apos" : "\'"\n, "AElig" : 198\n, "Aacute" : 193\n, "Acirc" : 194\n, "Agrave" : 192\n, "Aring" : 197\n, "Atilde" : 195\n, "Auml" : 196\n, "Ccedil" : 199\n, "ETH" : 208\n, "Eacute" : 201\n, "Ecirc" : 202\n, "Egrave" : 200\n, "Euml" : 203\n, "Iacute" : 205\n, "Icirc" : 206\n, "Igrave" : 204\n, "Iuml" : 207\n, "Ntilde" : 209\n, "Oacute" : 211\n, "Ocirc" : 212\n, "Ograve" : 210\n, "Oslash" : 216\n, "Otilde" : 213\n, "Ouml" : 214\n, "THORN" : 222\n, "Uacute" : 218\n, "Ucirc" : 219\n, "Ugrave" : 217\n, "Uuml" : 220\n, "Yacute" : 221\n, "aacute" : 225\n, "acirc" : 226\n, "aelig" : 230\n, "agrave" : 224\n, "aring" : 229\n, "atilde" : 227\n, "auml" : 228\n, "ccedil" : 231\n, "eacute" : 233\n, "ecirc" : 234\n, "egrave" : 232\n, "eth" : 240\n, "euml" : 235\n, "iacute" : 237\n, "icirc" : 238\n, "igrave" : 236\n, "iuml" : 239\n, "ntilde" : 241\n, "oacute" : 243\n, "ocirc" : 244\n, "ograve" : 242\n, "oslash" : 248\n, "otilde" : 245\n, "ouml" : 246\n, "szlig" : 223\n, "thorn" : 254\n, "uacute" : 250\n, "ucirc" : 251\n, "ugrave" : 249\n, "uuml" : 252\n, "yacute" : 253\n, "yuml" : 255\n, "copy" : 169\n, "reg" : 174\n, "nbsp" : 160\n, "iexcl" : 161\n, "cent" : 162\n, "pound" : 163\n, "curren" : 164\n, "yen" : 165\n, "brvbar" : 166\n, "sect" : 167\n, "uml" : 168\n, "ordf" : 170\n, "laquo" : 171\n, "not" : 172\n, "shy" : 173\n, "macr" : 175\n, "deg" : 176\n, "plusmn" : 177\n, "sup1" : 185\n, "sup2" : 178\n, "sup3" : 179\n, "acute" : 180\n, "micro" : 181\n, "para" : 182\n, "middot" : 183\n, "cedil" : 184\n, "ordm" : 186\n, "raquo" : 187\n, "frac14" : 188\n, "frac12" : 189\n, "frac34" : 190\n, "iquest" : 191\n, "times" : 215\n, "divide" : 247\n, "OElig" : 338\n, "oelig" : 339\n, "Scaron" : 352\n, "scaron" : 353\n, "Yuml" : 376\n, "fnof" : 402\n, "circ" : 710\n, "tilde" : 732\n, "Alpha" : 913\n, "Beta" : 914\n, "Gamma" : 915\n, "Delta" : 916\n, "Epsilon" : 917\n, "Zeta" : 918\n, "Eta" : 919\n, "Theta" : 920\n, "Iota" : 921\n, "Kappa" : 922\n, "Lambda" : 923\n, "Mu" : 924\n, "Nu" : 925\n, "Xi" : 926\n, "Omicron" : 927\n, "Pi" : 928\n, "Rho" : 929\n, "Sigma" : 931\n, "Tau" : 932\n, "Upsilon" : 933\n, "Phi" : 934\n, "Chi" : 935\n, "Psi" : 936\n, "Omega" : 937\n, "alpha" : 945\n, "beta" : 946\n, "gamma" : 947\n, "delta" : 948\n, "epsilon" : 949\n, "zeta" : 950\n, "eta" : 951\n, "theta" : 952\n, "iota" : 953\n, "kappa" : 954\n, "lambda" : 955\n, "mu" : 956\n, "nu" : 957\n, "xi" : 958\n, "omicron" : 959\n, "pi" : 960\n, "rho" : 961\n, "sigmaf" : 962\n, "sigma" : 963\n, "tau" : 964\n, "upsilon" : 965\n, "phi" : 966\n, "chi" : 967\n, "psi" : 968\n, "omega" : 969\n, "thetasym" : 977\n, "upsih" : 978\n, "piv" : 982\n, "ensp" : 8194\n, "emsp" : 8195\n, "thinsp" : 8201\n, "zwnj" : 8204\n, "zwj" : 8205\n, "lrm" : 8206\n, "rlm" : 8207\n, "ndash" : 8211\n, "mdash" : 8212\n, "lsquo" : 8216\n, "rsquo" : 8217\n, "sbquo" : 8218\n, "ldquo" : 8220\n, "rdquo" : 8221\n, "bdquo" : 8222\n, "dagger" : 8224\n, "Dagger" : 8225\n, "bull" : 8226\n, "hellip" : 8230\n, "permil" : 8240\n, "prime" : 8242\n, "Prime" : 8243\n, "lsaquo" : 8249\n, "rsaquo" : 8250\n, "oline" : 8254\n, "frasl" : 8260\n, "euro" : 8364\n, "image" : 8465\n, "weierp" : 8472\n, "real" : 8476\n, "trade" : 8482\n, "alefsym" : 8501\n, "larr" : 8592\n, "uarr" : 8593\n, "rarr" : 8594\n, "darr" : 8595\n, "harr" : 8596\n, "crarr" : 8629\n, "lArr" : 8656\n, "uArr" : 8657\n, "rArr" : 8658\n, "dArr" : 8659\n, "hArr" : 8660\n, "forall" : 8704\n, "part" : 8706\n, "exist" : 8707\n, "empty" : 8709\n, "nabla" : 8711\n, "isin" : 8712\n, "notin" : 8713\n, "ni" : 8715\n, "prod" : 8719\n, "sum" : 8721\n, "minus" : 8722\n, "lowast" : 8727\n, "radic" : 8730\n, "prop" : 8733\n, "infin" : 8734\n, "ang" : 8736\n, "and" : 8743\n, "or" : 8744\n, "cap" : 8745\n, "cup" : 8746\n, "int" : 8747\n, "there4" : 8756\n, "sim" : 8764\n, "cong" : 8773\n, "asymp" : 8776\n, "ne" : 8800\n, "equiv" : 8801\n, "le" : 8804\n, "ge" : 8805\n, "sub" : 8834\n, "sup" : 8835\n, "nsub" : 8836\n, "sube" : 8838\n, "supe" : 8839\n, "oplus" : 8853\n, "otimes" : 8855\n, "perp" : 8869\n, "sdot" : 8901\n, "lceil" : 8968\n, "rceil" : 8969\n, "lfloor" : 8970\n, "rfloor" : 8971\n, "lang" : 9001\n, "rang" : 9002\n, "loz" : 9674\n, "spades" : 9824\n, "clubs" : 9827\n, "hearts" : 9829\n, "diams" : 9830\n}\n\nObject.keys(sax.ENTITIES).forEach(function (key) {\n    var e = sax.ENTITIES[key]\n    var s = typeof e === \'number\' ? String.fromCharCode(e) : e\n    sax.ENTITIES[key] = s\n})\n\nfor (var S in sax.STATE) sax.STATE[sax.STATE[S]] = S\n\n// shorthand\nS = sax.STATE\n\nfunction emit (parser, event, data) {\n  parser[event] && parser[event](data)\n}\n\nfunction emitNode (parser, nodeType, data) {\n  if (parser.textNode) closeText(parser)\n  emit(parser, nodeType, data)\n}\n\nfunction closeText (parser) {\n  parser.textNode = textopts(parser.opt, parser.textNode)\n  if (parser.textNode) emit(parser, "ontext", parser.textNode)\n  parser.textNode = ""\n}\n\nfunction textopts (opt, text) {\n  if (opt.trim) text = text.trim()\n  if (opt.normalize) text = text.replace(/\\s+/g, " ")\n  return text\n}\n\nfunction error (parser, er) {\n  closeText(parser)\n  if (parser.trackPosition) {\n    er += "\\nLine: "+parser.line+\n          "\\nColumn: "+parser.column+\n          "\\nChar: "+parser.c\n  }\n  er = new Error(er)\n  parser.error = er\n  emit(parser, "onerror", er)\n  return parser\n}\n\nfunction end (parser) {\n  if (!parser.closedRoot) strictFail(parser, "Unclosed root tag")\n  if ((parser.state !== S.BEGIN) && (parser.state !== S.TEXT)) error(parser, "Unexpected end")\n  closeText(parser)\n  parser.c = ""\n  parser.closed = true\n  emit(parser, "onend")\n  SAXParser.call(parser, parser.strict, parser.opt)\n  return parser\n}\n\nfunction strictFail (parser, message) {\n  if (typeof parser !== \'object\' || !(parser instanceof SAXParser))\n    throw new Error(\'bad call to strictFail\');\n  if (parser.strict) error(parser, message)\n}\n\nfunction newTag (parser) {\n  if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]()\n  var parent = parser.tags[parser.tags.length - 1] || parser\n    , tag = parser.tag = { name : parser.tagName, attributes : {} }\n\n  // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"\n  if (parser.opt.xmlns) tag.ns = parent.ns\n  parser.attribList.length = 0\n}\n\nfunction qname (name, attribute) {\n  var i = name.indexOf(":")\n    , qualName = i < 0 ? [ "", name ] : name.split(":")\n    , prefix = qualName[0]\n    , local = qualName[1]\n\n  // <x "xmlns"="http://foo">\n  if (attribute && name === "xmlns") {\n    prefix = "xmlns"\n    local = ""\n  }\n\n  return { prefix: prefix, local: local }\n}\n\nfunction attrib (parser) {\n  if (!parser.strict) parser.attribName = parser.attribName[parser.looseCase]()\n\n  if (parser.attribList.indexOf(parser.attribName) !== -1 ||\n      parser.tag.attributes.hasOwnProperty(parser.attribName)) {\n    return parser.attribName = parser.attribValue = ""\n  }\n\n  if (parser.opt.xmlns) {\n    var qn = qname(parser.attribName, true)\n      , prefix = qn.prefix\n      , local = qn.local\n\n    if (prefix === "xmlns") {\n      // namespace binding attribute; push the binding into scope\n      if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {\n        strictFail( parser\n                  , "xml: prefix must be bound to " + XML_NAMESPACE + "\\n"\n                  + "Actual: " + parser.attribValue )\n      } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {\n        strictFail( parser\n                  , "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\\n"\n                  + "Actual: " + parser.attribValue )\n      } else {\n        var tag = parser.tag\n          , parent = parser.tags[parser.tags.length - 1] || parser\n        if (tag.ns === parent.ns) {\n          tag.ns = Object.create(parent.ns)\n        }\n        tag.ns[local] = parser.attribValue\n      }\n    }\n\n    // defer onattribute events until all attributes have been seen\n    // so any new bindings can take effect; preserve attribute order\n    // so deferred events can be emitted in document order\n    parser.attribList.push([parser.attribName, parser.attribValue])\n  } else {\n    // in non-xmlns mode, we can emit the event right away\n    parser.tag.attributes[parser.attribName] = parser.attribValue\n    emitNode( parser\n            , "onattribute"\n            , { name: parser.attribName\n              , value: parser.attribValue } )\n  }\n\n  parser.attribName = parser.attribValue = ""\n}\n\nfunction openTag (parser, selfClosing) {\n  if (parser.opt.xmlns) {\n    // emit namespace binding events\n    var tag = parser.tag\n\n    // add namespace info to tag\n    var qn = qname(parser.tagName)\n    tag.prefix = qn.prefix\n    tag.local = qn.local\n    tag.uri = tag.ns[qn.prefix] || ""\n\n    if (tag.prefix && !tag.uri) {\n      strictFail(parser, "Unbound namespace prefix: "\n                       + JSON.stringify(parser.tagName))\n      tag.uri = qn.prefix\n    }\n\n    var parent = parser.tags[parser.tags.length - 1] || parser\n    if (tag.ns && parent.ns !== tag.ns) {\n      Object.keys(tag.ns).forEach(function (p) {\n        emitNode( parser\n                , "onopennamespace"\n                , { prefix: p , uri: tag.ns[p] } )\n      })\n    }\n\n    // handle deferred onattribute events\n    // Note: do not apply default ns to attributes:\n    //   http://www.w3.org/TR/REC-xml-names/#defaulting\n    for (var i = 0, l = parser.attribList.length; i < l; i ++) {\n      var nv = parser.attribList[i]\n      var name = nv[0]\n        , value = nv[1]\n        , qualName = qname(name, true)\n        , prefix = qualName.prefix\n        , local = qualName.local\n        , uri = prefix == "" ? "" : (tag.ns[prefix] || "")\n        , a = { name: name\n              , value: value\n              , prefix: prefix\n              , local: local\n              , uri: uri\n              }\n\n      // if there\'s any attributes with an undefined namespace,\n      // then fail on them now.\n      if (prefix && prefix != "xmlns" && !uri) {\n        strictFail(parser, "Unbound namespace prefix: "\n                         + JSON.stringify(prefix))\n        a.uri = prefix\n      }\n      parser.tag.attributes[name] = a\n      emitNode(parser, "onattribute", a)\n    }\n    parser.attribList.length = 0\n  }\n\n  parser.tag.isSelfClosing = !!selfClosing\n\n  // process the tag\n  parser.sawRoot = true\n  parser.tags.push(parser.tag)\n  emitNode(parser, "onopentag", parser.tag)\n  if (!selfClosing) {\n    // special case for <script> in non-strict mode.\n    if (!parser.noscript && parser.tagName.toLowerCase() === "script") {\n      parser.state = S.SCRIPT\n    } else {\n      parser.state = S.TEXT\n    }\n    parser.tag = null\n    parser.tagName = ""\n  }\n  parser.attribName = parser.attribValue = ""\n  parser.attribList.length = 0\n}\n\nfunction closeTag (parser) {\n  if (!parser.tagName) {\n    strictFail(parser, "Weird empty close tag.")\n    parser.textNode += "</>"\n    parser.state = S.TEXT\n    return\n  }\n\n  if (parser.script) {\n    if (parser.tagName !== "script") {\n      parser.script += "</" + parser.tagName + ">"\n      parser.tagName = ""\n      parser.state = S.SCRIPT\n      return\n    }\n    emitNode(parser, "onscript", parser.script)\n    parser.script = ""\n  }\n\n  // first make sure that the closing tag actually exists.\n  // <a><b></c></b></a> will close everything, otherwise.\n  var t = parser.tags.length\n  var tagName = parser.tagName\n  if (!parser.strict) tagName = tagName[parser.looseCase]()\n  var closeTo = tagName\n  while (t --) {\n    var close = parser.tags[t]\n    if (close.name !== closeTo) {\n      // fail the first time in strict mode\n      strictFail(parser, "Unexpected close tag")\n    } else break\n  }\n\n  // didn\'t find it.  we already failed for strict, so just abort.\n  if (t < 0) {\n    strictFail(parser, "Unmatched closing tag: "+parser.tagName)\n    parser.textNode += "</" + parser.tagName + ">"\n    parser.state = S.TEXT\n    return\n  }\n  parser.tagName = tagName\n  var s = parser.tags.length\n  while (s --> t) {\n    var tag = parser.tag = parser.tags.pop()\n    parser.tagName = parser.tag.name\n    emitNode(parser, "onclosetag", parser.tagName)\n\n    var x = {}\n    for (var i in tag.ns) x[i] = tag.ns[i]\n\n    var parent = parser.tags[parser.tags.length - 1] || parser\n    if (parser.opt.xmlns && tag.ns !== parent.ns) {\n      // remove namespace bindings introduced by tag\n      Object.keys(tag.ns).forEach(function (p) {\n        var n = tag.ns[p]\n        emitNode(parser, "onclosenamespace", { prefix: p, uri: n })\n      })\n    }\n  }\n  if (t === 0) parser.closedRoot = true\n  parser.tagName = parser.attribValue = parser.attribName = ""\n  parser.attribList.length = 0\n  parser.state = S.TEXT\n}\n\nfunction parseEntity (parser) {\n  var entity = parser.entity\n    , entityLC = entity.toLowerCase()\n    , num\n    , numStr = ""\n  if (parser.ENTITIES[entity])\n    return parser.ENTITIES[entity]\n  if (parser.ENTITIES[entityLC])\n    return parser.ENTITIES[entityLC]\n  entity = entityLC\n  if (entity.charAt(0) === "#") {\n    if (entity.charAt(1) === "x") {\n      entity = entity.slice(2)\n      num = parseInt(entity, 16)\n      numStr = num.toString(16)\n    } else {\n      entity = entity.slice(1)\n      num = parseInt(entity, 10)\n      numStr = num.toString(10)\n    }\n  }\n  entity = entity.replace(/^0+/, "")\n  if (numStr.toLowerCase() !== entity) {\n    strictFail(parser, "Invalid character entity")\n    return "&"+parser.entity + ";"\n  }\n  return String.fromCharCode(num)\n}\n\nfunction write (chunk) {\n  var parser = this\n  if (this.error) throw this.error\n  if (parser.closed) return error(parser,\n    "Cannot write after close. Assign an onready handler.")\n  if (chunk === null) return end(parser)\n  var i = 0, c = ""\n  while (parser.c = c = chunk.charAt(i++)) {\n    if (parser.trackPosition) {\n      parser.position ++\n      if (c === "\\n") {\n        parser.line ++\n        parser.column = 0\n      } else parser.column ++\n    }\n    switch (parser.state) {\n\n      case S.BEGIN:\n        if (c === "<") {\n          parser.state = S.OPEN_WAKA\n          parser.startTagPosition = parser.position\n        } else if (not(whitespace,c)) {\n          // have to process this as a text node.\n          // weird, but happens.\n          strictFail(parser, "Non-whitespace before first tag.")\n          parser.textNode = c\n          parser.state = S.TEXT\n        }\n      continue\n\n      case S.TEXT:\n        if (parser.sawRoot && !parser.closedRoot) {\n          var starti = i-1\n          while (c && c!=="<" && c!=="&") {\n            c = chunk.charAt(i++)\n            if (c && parser.trackPosition) {\n              parser.position ++\n              if (c === "\\n") {\n                parser.line ++\n                parser.column = 0\n              } else parser.column ++\n            }\n          }\n          parser.textNode += chunk.substring(starti, i-1)\n        }\n        if (c === "<") {\n          parser.state = S.OPEN_WAKA\n          parser.startTagPosition = parser.position\n        } else {\n          if (not(whitespace, c) && (!parser.sawRoot || parser.closedRoot))\n            strictFail(parser, "Text data outside of root node.")\n          if (c === "&") parser.state = S.TEXT_ENTITY\n          else parser.textNode += c\n        }\n      continue\n\n      case S.SCRIPT:\n        // only non-strict\n        if (c === "<") {\n          parser.state = S.SCRIPT_ENDING\n        } else parser.script += c\n      continue\n\n      case S.SCRIPT_ENDING:\n        if (c === "/") {\n          parser.state = S.CLOSE_TAG\n        } else {\n          parser.script += "<" + c\n          parser.state = S.SCRIPT\n        }\n      continue\n\n      case S.OPEN_WAKA:\n        // either a /, ?, !, or text is coming next.\n        if (c === "!") {\n          parser.state = S.SGML_DECL\n          parser.sgmlDecl = ""\n        } else if (is(whitespace, c)) {\n          // wait for it...\n        } else if (is(nameStart,c)) {\n          parser.state = S.OPEN_TAG\n          parser.tagName = c\n        } else if (c === "/") {\n          parser.state = S.CLOSE_TAG\n          parser.tagName = ""\n        } else if (c === "?") {\n          parser.state = S.PROC_INST\n          parser.procInstName = parser.procInstBody = ""\n        } else {\n          strictFail(parser, "Unencoded <")\n          // if there was some whitespace, then add that in.\n          if (parser.startTagPosition + 1 < parser.position) {\n            var pad = parser.position - parser.startTagPosition\n            c = new Array(pad).join(" ") + c\n          }\n          parser.textNode += "<" + c\n          parser.state = S.TEXT\n        }\n      continue\n\n      case S.SGML_DECL:\n        if ((parser.sgmlDecl+c).toUpperCase() === CDATA) {\n          emitNode(parser, "onopencdata")\n          parser.state = S.CDATA\n          parser.sgmlDecl = ""\n          parser.cdata = ""\n        } else if (parser.sgmlDecl+c === "--") {\n          parser.state = S.COMMENT\n          parser.comment = ""\n          parser.sgmlDecl = ""\n        } else if ((parser.sgmlDecl+c).toUpperCase() === DOCTYPE) {\n          parser.state = S.DOCTYPE\n          if (parser.doctype || parser.sawRoot) strictFail(parser,\n            "Inappropriately located doctype declaration")\n          parser.doctype = ""\n          parser.sgmlDecl = ""\n        } else if (c === ">") {\n          emitNode(parser, "onsgmldeclaration", parser.sgmlDecl)\n          parser.sgmlDecl = ""\n          parser.state = S.TEXT\n        } else if (is(quote, c)) {\n          parser.state = S.SGML_DECL_QUOTED\n          parser.sgmlDecl += c\n        } else parser.sgmlDecl += c\n      continue\n\n      case S.SGML_DECL_QUOTED:\n        if (c === parser.q) {\n          parser.state = S.SGML_DECL\n          parser.q = ""\n        }\n        parser.sgmlDecl += c\n      continue\n\n      case S.DOCTYPE:\n        if (c === ">") {\n          parser.state = S.TEXT\n          emitNode(parser, "ondoctype", parser.doctype)\n          parser.doctype = true // just remember that we saw it.\n        } else {\n          parser.doctype += c\n          if (c === "[") parser.state = S.DOCTYPE_DTD\n          else if (is(quote, c)) {\n            parser.state = S.DOCTYPE_QUOTED\n            parser.q = c\n          }\n        }\n      continue\n\n      case S.DOCTYPE_QUOTED:\n        parser.doctype += c\n        if (c === parser.q) {\n          parser.q = ""\n          parser.state = S.DOCTYPE\n        }\n      continue\n\n      case S.DOCTYPE_DTD:\n        parser.doctype += c\n        if (c === "]") parser.state = S.DOCTYPE\n        else if (is(quote,c)) {\n          parser.state = S.DOCTYPE_DTD_QUOTED\n          parser.q = c\n        }\n      continue\n\n      case S.DOCTYPE_DTD_QUOTED:\n        parser.doctype += c\n        if (c === parser.q) {\n          parser.state = S.DOCTYPE_DTD\n          parser.q = ""\n        }\n      continue\n\n      case S.COMMENT:\n        if (c === "-") parser.state = S.COMMENT_ENDING\n        else parser.comment += c\n      continue\n\n      case S.COMMENT_ENDING:\n        if (c === "-") {\n          parser.state = S.COMMENT_ENDED\n          parser.comment = textopts(parser.opt, parser.comment)\n          if (parser.comment) emitNode(parser, "oncomment", parser.comment)\n          parser.comment = ""\n        } else {\n          parser.comment += "-" + c\n          parser.state = S.COMMENT\n        }\n      continue\n\n      case S.COMMENT_ENDED:\n        if (c !== ">") {\n          strictFail(parser, "Malformed comment")\n          // allow <!-- blah -- bloo --> in non-strict mode,\n          // which is a comment of " blah -- bloo "\n          parser.comment += "--" + c\n          parser.state = S.COMMENT\n        } else parser.state = S.TEXT\n      continue\n\n      case S.CDATA:\n        if (c === "]") parser.state = S.CDATA_ENDING\n        else parser.cdata += c\n      continue\n\n      case S.CDATA_ENDING:\n        if (c === "]") parser.state = S.CDATA_ENDING_2\n        else {\n          parser.cdata += "]" + c\n          parser.state = S.CDATA\n        }\n      continue\n\n      case S.CDATA_ENDING_2:\n        if (c === ">") {\n          if (parser.cdata) emitNode(parser, "oncdata", parser.cdata)\n          emitNode(parser, "onclosecdata")\n          parser.cdata = ""\n          parser.state = S.TEXT\n        } else if (c === "]") {\n          parser.cdata += "]"\n        } else {\n          parser.cdata += "]]" + c\n          parser.state = S.CDATA\n        }\n      continue\n\n      case S.PROC_INST:\n        if (c === "?") parser.state = S.PROC_INST_ENDING\n        else if (is(whitespace, c)) parser.state = S.PROC_INST_BODY\n        else parser.procInstName += c\n      continue\n\n      case S.PROC_INST_BODY:\n        if (!parser.procInstBody && is(whitespace, c)) continue\n        else if (c === "?") parser.state = S.PROC_INST_ENDING\n        else parser.procInstBody += c\n      continue\n\n      case S.PROC_INST_ENDING:\n        if (c === ">") {\n          emitNode(parser, "onprocessinginstruction", {\n            name : parser.procInstName,\n            body : parser.procInstBody\n          })\n          parser.procInstName = parser.procInstBody = ""\n          parser.state = S.TEXT\n        } else {\n          parser.procInstBody += "?" + c\n          parser.state = S.PROC_INST_BODY\n        }\n      continue\n\n      case S.OPEN_TAG:\n        if (is(nameBody, c)) parser.tagName += c\n        else {\n          newTag(parser)\n          if (c === ">") openTag(parser)\n          else if (c === "/") parser.state = S.OPEN_TAG_SLASH\n          else {\n            if (not(whitespace, c)) strictFail(\n              parser, "Invalid character in tag name")\n            parser.state = S.ATTRIB\n          }\n        }\n      continue\n\n      case S.OPEN_TAG_SLASH:\n        if (c === ">") {\n          openTag(parser, true)\n          closeTag(parser)\n        } else {\n          strictFail(parser, "Forward-slash in opening tag not followed by >")\n          parser.state = S.ATTRIB\n        }\n      continue\n\n      case S.ATTRIB:\n        // haven\'t read the attribute name yet.\n        if (is(whitespace, c)) continue\n        else if (c === ">") openTag(parser)\n        else if (c === "/") parser.state = S.OPEN_TAG_SLASH\n        else if (is(nameStart, c)) {\n          parser.attribName = c\n          parser.attribValue = ""\n          parser.state = S.ATTRIB_NAME\n        } else strictFail(parser, "Invalid attribute name")\n      continue\n\n      case S.ATTRIB_NAME:\n        if (c === "=") parser.state = S.ATTRIB_VALUE\n        else if (c === ">") {\n          strictFail(parser, "Attribute without value")\n          parser.attribValue = parser.attribName\n          attrib(parser)\n          openTag(parser)\n        }\n        else if (is(whitespace, c)) parser.state = S.ATTRIB_NAME_SAW_WHITE\n        else if (is(nameBody, c)) parser.attribName += c\n        else strictFail(parser, "Invalid attribute name")\n      continue\n\n      case S.ATTRIB_NAME_SAW_WHITE:\n        if (c === "=") parser.state = S.ATTRIB_VALUE\n        else if (is(whitespace, c)) continue\n        else {\n          strictFail(parser, "Attribute without value")\n          parser.tag.attributes[parser.attribName] = ""\n          parser.attribValue = ""\n          emitNode(parser, "onattribute",\n                   { name : parser.attribName, value : "" })\n          parser.attribName = ""\n          if (c === ">") openTag(parser)\n          else if (is(nameStart, c)) {\n            parser.attribName = c\n            parser.state = S.ATTRIB_NAME\n          } else {\n            strictFail(parser, "Invalid attribute name")\n            parser.state = S.ATTRIB\n          }\n        }\n      continue\n\n      case S.ATTRIB_VALUE:\n        if (is(whitespace, c)) continue\n        else if (is(quote, c)) {\n          parser.q = c\n          parser.state = S.ATTRIB_VALUE_QUOTED\n        } else {\n          strictFail(parser, "Unquoted attribute value")\n          parser.state = S.ATTRIB_VALUE_UNQUOTED\n          parser.attribValue = c\n        }\n      continue\n\n      case S.ATTRIB_VALUE_QUOTED:\n        if (c !== parser.q) {\n          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_Q\n          else parser.attribValue += c\n          continue\n        }\n        attrib(parser)\n        parser.q = ""\n        parser.state = S.ATTRIB_VALUE_CLOSED\n      continue\n\n      case S.ATTRIB_VALUE_CLOSED:\n        if (is(whitespace, c)) {\n          parser.state = S.ATTRIB\n        } else if (c === ">") openTag(parser)\n        else if (c === "/") parser.state = S.OPEN_TAG_SLASH\n        else if (is(nameStart, c)) {\n          strictFail(parser, "No whitespace between attributes")\n          parser.attribName = c\n          parser.attribValue = ""\n          parser.state = S.ATTRIB_NAME\n        } else strictFail(parser, "Invalid attribute name")\n      continue\n\n      case S.ATTRIB_VALUE_UNQUOTED:\n        if (not(attribEnd,c)) {\n          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_U\n          else parser.attribValue += c\n          continue\n        }\n        attrib(parser)\n        if (c === ">") openTag(parser)\n        else parser.state = S.ATTRIB\n      continue\n\n      case S.CLOSE_TAG:\n        if (!parser.tagName) {\n          if (is(whitespace, c)) continue\n          else if (not(nameStart, c)) {\n            if (parser.script) {\n              parser.script += "</" + c\n              parser.state = S.SCRIPT\n            } else {\n              strictFail(parser, "Invalid tagname in closing tag.")\n            }\n          } else parser.tagName = c\n        }\n        else if (c === ">") closeTag(parser)\n        else if (is(nameBody, c)) parser.tagName += c\n        else if (parser.script) {\n          parser.script += "</" + parser.tagName\n          parser.tagName = ""\n          parser.state = S.SCRIPT\n        } else {\n          if (not(whitespace, c)) strictFail(parser,\n            "Invalid tagname in closing tag")\n          parser.state = S.CLOSE_TAG_SAW_WHITE\n        }\n      continue\n\n      case S.CLOSE_TAG_SAW_WHITE:\n        if (is(whitespace, c)) continue\n        if (c === ">") closeTag(parser)\n        else strictFail(parser, "Invalid characters in closing tag")\n      continue\n\n      case S.TEXT_ENTITY:\n      case S.ATTRIB_VALUE_ENTITY_Q:\n      case S.ATTRIB_VALUE_ENTITY_U:\n        switch(parser.state) {\n          case S.TEXT_ENTITY:\n            var returnState = S.TEXT, buffer = "textNode"\n          break\n\n          case S.ATTRIB_VALUE_ENTITY_Q:\n            var returnState = S.ATTRIB_VALUE_QUOTED, buffer = "attribValue"\n          break\n\n          case S.ATTRIB_VALUE_ENTITY_U:\n            var returnState = S.ATTRIB_VALUE_UNQUOTED, buffer = "attribValue"\n          break\n        }\n        if (c === ";") {\n          parser[buffer] += parseEntity(parser)\n          parser.entity = ""\n          parser.state = returnState\n        }\n        else if (is(entity, c)) parser.entity += c\n        else {\n          strictFail(parser, "Invalid character entity")\n          parser[buffer] += "&" + parser.entity + c\n          parser.entity = ""\n          parser.state = returnState\n        }\n      continue\n\n      default:\n        throw new Error(parser, "Unknown state: " + parser.state)\n    }\n  } // while\n  // cdata blocks can get very big under normal conditions. emit and move on.\n  // if (parser.state === S.CDATA && parser.cdata) {\n  //   emitNode(parser, "oncdata", parser.cdata)\n  //   parser.cdata = ""\n  // }\n  if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser)\n  return parser\n}\n\n})(typeof exports === "undefined" ? sax = {} : exports)\n\n}).call(this,require("buffer").Buffer)\n},{"buffer":24,"stream":31,"string_decoder":37}],24:[function(require,module,exports){\n/*!\n * The buffer module from node.js, for the browser.\n *\n * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>\n * @license  MIT\n */\n\nvar base64 = require(\'base64-js\')\nvar ieee754 = require(\'ieee754\')\n\nexports.Buffer = Buffer\nexports.SlowBuffer = Buffer\nexports.INSPECT_MAX_BYTES = 50\nBuffer.poolSize = 8192\n\n/**\n * If `Buffer._useTypedArrays`:\n *   === true    Use Uint8Array implementation (fastest)\n *   === false   Use Object implementation (compatible down to IE6)\n */\nBuffer._useTypedArrays = (function () {\n  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,\n  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding\n  // properties to `Uint8Array` instances, then that\'s the same as no `Uint8Array` support\n  // because we need to be able to add all the node Buffer API methods. This is an issue\n  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438\n  try {\n    var buf = new ArrayBuffer(0)\n    var arr = new Uint8Array(buf)\n    arr.foo = function () { return 42 }\n    return 42 === arr.foo() &&\n        typeof arr.subarray === \'function\' // Chrome 9-10 lack `subarray`\n  } catch (e) {\n    return false\n  }\n})()\n\n/**\n * Class: Buffer\n * =============\n *\n * The Buffer constructor returns instances of `Uint8Array` that are augmented\n * with function properties for all the node `Buffer` API functions. We use\n * `Uint8Array` so that square bracket notation works as expected -- it returns\n * a single octet.\n *\n * By augmenting the instances, we can avoid modifying the `Uint8Array`\n * prototype.\n */\nfunction Buffer (subject, encoding, noZero) {\n  if (!(this instanceof Buffer))\n    return new Buffer(subject, encoding, noZero)\n\n  var type = typeof subject\n\n  // Workaround: node\'s base64 implementation allows for non-padded strings\n  // while base64-js does not.\n  if (encoding === \'base64\' && type === \'string\') {\n    subject = stringtrim(subject)\n    while (subject.length % 4 !== 0) {\n      subject = subject + \'=\'\n    }\n  }\n\n  // Find the length\n  var length\n  if (type === \'number\')\n    length = coerce(subject)\n  else if (type === \'string\')\n    length = Buffer.byteLength(subject, encoding)\n  else if (type === \'object\')\n    length = coerce(subject.length) // assume that object is array-like\n  else\n    throw new Error(\'First argument needs to be a number, array or string.\')\n\n  var buf\n  if (Buffer._useTypedArrays) {\n    // Preferred: Return an augmented `Uint8Array` instance for best performance\n    buf = Buffer._augment(new Uint8Array(length))\n  } else {\n    // Fallback: Return THIS instance of Buffer (created by `new`)\n    buf = this\n    buf.length = length\n    buf._isBuffer = true\n  }\n\n  var i\n  if (Buffer._useTypedArrays && typeof subject.byteLength === \'number\') {\n    // Speed optimization -- use set if we\'re copying from a typed array\n    buf._set(subject)\n  } else if (isArrayish(subject)) {\n    // Treat array-ish objects as a byte array\n    for (i = 0; i < length; i++) {\n      if (Buffer.isBuffer(subject))\n        buf[i] = subject.readUInt8(i)\n      else\n        buf[i] = subject[i]\n    }\n  } else if (type === \'string\') {\n    buf.write(subject, 0, encoding)\n  } else if (type === \'number\' && !Buffer._useTypedArrays && !noZero) {\n    for (i = 0; i < length; i++) {\n      buf[i] = 0\n    }\n  }\n\n  return buf\n}\n\n// STATIC METHODS\n// ==============\n\nBuffer.isEncoding = function (encoding) {\n  switch (String(encoding).toLowerCase()) {\n    case \'hex\':\n    case \'utf8\':\n    case \'utf-8\':\n    case \'ascii\':\n    case \'binary\':\n    case \'base64\':\n    case \'raw\':\n    case \'ucs2\':\n    case \'ucs-2\':\n    case \'utf16le\':\n    case \'utf-16le\':\n      return true\n    default:\n      return false\n  }\n}\n\nBuffer.isBuffer = function (b) {\n  return !!(b !== null && b !== undefined && b._isBuffer)\n}\n\nBuffer.byteLength = function (str, encoding) {\n  var ret\n  str = str + \'\'\n  switch (encoding || \'utf8\') {\n    case \'hex\':\n      ret = str.length / 2\n      break\n    case \'utf8\':\n    case \'utf-8\':\n      ret = utf8ToBytes(str).length\n      break\n    case \'ascii\':\n    case \'binary\':\n    case \'raw\':\n      ret = str.length\n      break\n    case \'base64\':\n      ret = base64ToBytes(str).length\n      break\n    case \'ucs2\':\n    case \'ucs-2\':\n    case \'utf16le\':\n    case \'utf-16le\':\n      ret = str.length * 2\n      break\n    default:\n      throw new Error(\'Unknown encoding\')\n  }\n  return ret\n}\n\nBuffer.concat = function (list, totalLength) {\n  assert(isArray(list), \'Usage: Buffer.concat(list, [totalLength])\\n\' +\n      \'list should be an Array.\')\n\n  if (list.length === 0) {\n    return new Buffer(0)\n  } else if (list.length === 1) {\n    return list[0]\n  }\n\n  var i\n  if (typeof totalLength !== \'number\') {\n    totalLength = 0\n    for (i = 0; i < list.length; i++) {\n      totalLength += list[i].length\n    }\n  }\n\n  var buf = new Buffer(totalLength)\n  var pos = 0\n  for (i = 0; i < list.length; i++) {\n    var item = list[i]\n    item.copy(buf, pos)\n    pos += item.length\n  }\n  return buf\n}\n\n// BUFFER INSTANCE METHODS\n// =======================\n\nfunction _hexWrite (buf, string, offset, length) {\n  offset = Number(offset) || 0\n  var remaining = buf.length - offset\n  if (!length) {\n    length = remaining\n  } else {\n    length = Number(length)\n    if (length > remaining) {\n      length = remaining\n    }\n  }\n\n  // must be an even number of digits\n  var strLen = string.length\n  assert(strLen % 2 === 0, \'Invalid hex string\')\n\n  if (length > strLen / 2) {\n    length = strLen / 2\n  }\n  for (var i = 0; i < length; i++) {\n    var byte = parseInt(string.substr(i * 2, 2), 16)\n    assert(!isNaN(byte), \'Invalid hex string\')\n    buf[offset + i] = byte\n  }\n  Buffer._charsWritten = i * 2\n  return i\n}\n\nfunction _utf8Write (buf, string, offset, length) {\n  var charsWritten = Buffer._charsWritten =\n    blitBuffer(utf8ToBytes(string), buf, offset, length)\n  return charsWritten\n}\n\nfunction _asciiWrite (buf, string, offset, length) {\n  var charsWritten = Buffer._charsWritten =\n    blitBuffer(asciiToBytes(string), buf, offset, length)\n  return charsWritten\n}\n\nfunction _binaryWrite (buf, string, offset, length) {\n  return _asciiWrite(buf, string, offset, length)\n}\n\nfunction _base64Write (buf, string, offset, length) {\n  var charsWritten = Buffer._charsWritten =\n    blitBuffer(base64ToBytes(string), buf, offset, length)\n  return charsWritten\n}\n\nfunction _utf16leWrite (buf, string, offset, length) {\n  var charsWritten = Buffer._charsWritten =\n    blitBuffer(utf16leToBytes(string), buf, offset, length)\n  return charsWritten\n}\n\nBuffer.prototype.write = function (string, offset, length, encoding) {\n  // Support both (string, offset, length, encoding)\n  // and the legacy (string, encoding, offset, length)\n  if (isFinite(offset)) {\n    if (!isFinite(length)) {\n      encoding = length\n      length = undefined\n    }\n  } else {  // legacy\n    var swap = encoding\n    encoding = offset\n    offset = length\n    length = swap\n  }\n\n  offset = Number(offset) || 0\n  var remaining = this.length - offset\n  if (!length) {\n    length = remaining\n  } else {\n    length = Number(length)\n    if (length > remaining) {\n      length = remaining\n    }\n  }\n  encoding = String(encoding || \'utf8\').toLowerCase()\n\n  var ret\n  switch (encoding) {\n    case \'hex\':\n      ret = _hexWrite(this, string, offset, length)\n      break\n    case \'utf8\':\n    case \'utf-8\':\n      ret = _utf8Write(this, string, offset, length)\n      break\n    case \'ascii\':\n      ret = _asciiWrite(this, string, offset, length)\n      break\n    case \'binary\':\n      ret = _binaryWrite(this, string, offset, length)\n      break\n    case \'base64\':\n      ret = _base64Write(this, string, offset, length)\n      break\n    case \'ucs2\':\n    case \'ucs-2\':\n    case \'utf16le\':\n    case \'utf-16le\':\n      ret = _utf16leWrite(this, string, offset, length)\n      break\n    default:\n      throw new Error(\'Unknown encoding\')\n  }\n  return ret\n}\n\nBuffer.prototype.toString = function (encoding, start, end) {\n  var self = this\n\n  encoding = String(encoding || \'utf8\').toLowerCase()\n  start = Number(start) || 0\n  end = (end !== undefined)\n    ? Number(end)\n    : end = self.length\n\n  // Fastpath empty strings\n  if (end === start)\n    return \'\'\n\n  var ret\n  switch (encoding) {\n    case \'hex\':\n      ret = _hexSlice(self, start, end)\n      break\n    case \'utf8\':\n    case \'utf-8\':\n      ret = _utf8Slice(self, start, end)\n      break\n    case \'ascii\':\n      ret = _asciiSlice(self, start, end)\n      break\n    case \'binary\':\n      ret = _binarySlice(self, start, end)\n      break\n    case \'base64\':\n      ret = _base64Slice(self, start, end)\n      break\n    case \'ucs2\':\n    case \'ucs-2\':\n    case \'utf16le\':\n    case \'utf-16le\':\n      ret = _utf16leSlice(self, start, end)\n      break\n    default:\n      throw new Error(\'Unknown encoding\')\n  }\n  return ret\n}\n\nBuffer.prototype.toJSON = function () {\n  return {\n    type: \'Buffer\',\n    data: Array.prototype.slice.call(this._arr || this, 0)\n  }\n}\n\n// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)\nBuffer.prototype.copy = function (target, target_start, start, end) {\n  var source = this\n\n  if (!start) start = 0\n  if (!end && end !== 0) end = this.length\n  if (!target_start) target_start = 0\n\n  // Copy 0 bytes; we\'re done\n  if (end === start) return\n  if (target.length === 0 || source.length === 0) return\n\n  // Fatal error conditions\n  assert(end >= start, \'sourceEnd < sourceStart\')\n  assert(target_start >= 0 && target_start < target.length,\n      \'targetStart out of bounds\')\n  assert(start >= 0 && start < source.length, \'sourceStart out of bounds\')\n  assert(end >= 0 && end <= source.length, \'sourceEnd out of bounds\')\n\n  // Are we oob?\n  if (end > this.length)\n    end = this.length\n  if (target.length - target_start < end - start)\n    end = target.length - target_start + start\n\n  var len = end - start\n\n  if (len < 100 || !Buffer._useTypedArrays) {\n    for (var i = 0; i < len; i++)\n      target[i + target_start] = this[i + start]\n  } else {\n    target._set(this.subarray(start, start + len), target_start)\n  }\n}\n\nfunction _base64Slice (buf, start, end) {\n  if (start === 0 && end === buf.length) {\n    return base64.fromByteArray(buf)\n  } else {\n    return base64.fromByteArray(buf.slice(start, end))\n  }\n}\n\nfunction _utf8Slice (buf, start, end) {\n  var res = \'\'\n  var tmp = \'\'\n  end = Math.min(buf.length, end)\n\n  for (var i = start; i < end; i++) {\n    if (buf[i] <= 0x7F) {\n      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])\n      tmp = \'\'\n    } else {\n      tmp += \'%\' + buf[i].toString(16)\n    }\n  }\n\n  return res + decodeUtf8Char(tmp)\n}\n\nfunction _asciiSlice (buf, start, end) {\n  var ret = \'\'\n  end = Math.min(buf.length, end)\n\n  for (var i = start; i < end; i++)\n    ret += String.fromCharCode(buf[i])\n  return ret\n}\n\nfunction _binarySlice (buf, start, end) {\n  return _asciiSlice(buf, start, end)\n}\n\nfunction _hexSlice (buf, start, end) {\n  var len = buf.length\n\n  if (!start || start < 0) start = 0\n  if (!end || end < 0 || end > len) end = len\n\n  var out = \'\'\n  for (var i = start; i < end; i++) {\n    out += toHex(buf[i])\n  }\n  return out\n}\n\nfunction _utf16leSlice (buf, start, end) {\n  var bytes = buf.slice(start, end)\n  var res = \'\'\n  for (var i = 0; i < bytes.length; i += 2) {\n    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)\n  }\n  return res\n}\n\nBuffer.prototype.slice = function (start, end) {\n  var len = this.length\n  start = clamp(start, len, 0)\n  end = clamp(end, len, len)\n\n  if (Buffer._useTypedArrays) {\n    return Buffer._augment(this.subarray(start, end))\n  } else {\n    var sliceLen = end - start\n    var newBuf = new Buffer(sliceLen, undefined, true)\n    for (var i = 0; i < sliceLen; i++) {\n      newBuf[i] = this[i + start]\n    }\n    return newBuf\n  }\n}\n\n// `get` will be removed in Node 0.13+\nBuffer.prototype.get = function (offset) {\n  console.log(\'.get() is deprecated. Access using array indexes instead.\')\n  return this.readUInt8(offset)\n}\n\n// `set` will be removed in Node 0.13+\nBuffer.prototype.set = function (v, offset) {\n  console.log(\'.set() is deprecated. Access using array indexes instead.\')\n  return this.writeUInt8(v, offset)\n}\n\nBuffer.prototype.readUInt8 = function (offset, noAssert) {\n  if (!noAssert) {\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset < this.length, \'Trying to read beyond buffer length\')\n  }\n\n  if (offset >= this.length)\n    return\n\n  return this[offset]\n}\n\nfunction _readUInt16 (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 1 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  var val\n  if (littleEndian) {\n    val = buf[offset]\n    if (offset + 1 < len)\n      val |= buf[offset + 1] << 8\n  } else {\n    val = buf[offset] << 8\n    if (offset + 1 < len)\n      val |= buf[offset + 1]\n  }\n  return val\n}\n\nBuffer.prototype.readUInt16LE = function (offset, noAssert) {\n  return _readUInt16(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readUInt16BE = function (offset, noAssert) {\n  return _readUInt16(this, offset, false, noAssert)\n}\n\nfunction _readUInt32 (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 3 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  var val\n  if (littleEndian) {\n    if (offset + 2 < len)\n      val = buf[offset + 2] << 16\n    if (offset + 1 < len)\n      val |= buf[offset + 1] << 8\n    val |= buf[offset]\n    if (offset + 3 < len)\n      val = val + (buf[offset + 3] << 24 >>> 0)\n  } else {\n    if (offset + 1 < len)\n      val = buf[offset + 1] << 16\n    if (offset + 2 < len)\n      val |= buf[offset + 2] << 8\n    if (offset + 3 < len)\n      val |= buf[offset + 3]\n    val = val + (buf[offset] << 24 >>> 0)\n  }\n  return val\n}\n\nBuffer.prototype.readUInt32LE = function (offset, noAssert) {\n  return _readUInt32(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readUInt32BE = function (offset, noAssert) {\n  return _readUInt32(this, offset, false, noAssert)\n}\n\nBuffer.prototype.readInt8 = function (offset, noAssert) {\n  if (!noAssert) {\n    assert(offset !== undefined && offset !== null,\n        \'missing offset\')\n    assert(offset < this.length, \'Trying to read beyond buffer length\')\n  }\n\n  if (offset >= this.length)\n    return\n\n  var neg = this[offset] & 0x80\n  if (neg)\n    return (0xff - this[offset] + 1) * -1\n  else\n    return this[offset]\n}\n\nfunction _readInt16 (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 1 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  var val = _readUInt16(buf, offset, littleEndian, true)\n  var neg = val & 0x8000\n  if (neg)\n    return (0xffff - val + 1) * -1\n  else\n    return val\n}\n\nBuffer.prototype.readInt16LE = function (offset, noAssert) {\n  return _readInt16(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readInt16BE = function (offset, noAssert) {\n  return _readInt16(this, offset, false, noAssert)\n}\n\nfunction _readInt32 (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 3 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  var val = _readUInt32(buf, offset, littleEndian, true)\n  var neg = val & 0x80000000\n  if (neg)\n    return (0xffffffff - val + 1) * -1\n  else\n    return val\n}\n\nBuffer.prototype.readInt32LE = function (offset, noAssert) {\n  return _readInt32(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readInt32BE = function (offset, noAssert) {\n  return _readInt32(this, offset, false, noAssert)\n}\n\nfunction _readFloat (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset + 3 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  return ieee754.read(buf, offset, littleEndian, 23, 4)\n}\n\nBuffer.prototype.readFloatLE = function (offset, noAssert) {\n  return _readFloat(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readFloatBE = function (offset, noAssert) {\n  return _readFloat(this, offset, false, noAssert)\n}\n\nfunction _readDouble (buf, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset + 7 < buf.length, \'Trying to read beyond buffer length\')\n  }\n\n  return ieee754.read(buf, offset, littleEndian, 52, 8)\n}\n\nBuffer.prototype.readDoubleLE = function (offset, noAssert) {\n  return _readDouble(this, offset, true, noAssert)\n}\n\nBuffer.prototype.readDoubleBE = function (offset, noAssert) {\n  return _readDouble(this, offset, false, noAssert)\n}\n\nBuffer.prototype.writeUInt8 = function (value, offset, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset < this.length, \'trying to write beyond buffer length\')\n    verifuint(value, 0xff)\n  }\n\n  if (offset >= this.length) return\n\n  this[offset] = value\n}\n\nfunction _writeUInt16 (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 1 < buf.length, \'trying to write beyond buffer length\')\n    verifuint(value, 0xffff)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {\n    buf[offset + i] =\n        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>\n            (littleEndian ? i : 1 - i) * 8\n  }\n}\n\nBuffer.prototype.writeUInt16LE = function (value, offset, noAssert) {\n  _writeUInt16(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeUInt16BE = function (value, offset, noAssert) {\n  _writeUInt16(this, value, offset, false, noAssert)\n}\n\nfunction _writeUInt32 (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 3 < buf.length, \'trying to write beyond buffer length\')\n    verifuint(value, 0xffffffff)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {\n    buf[offset + i] =\n        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff\n  }\n}\n\nBuffer.prototype.writeUInt32LE = function (value, offset, noAssert) {\n  _writeUInt32(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeUInt32BE = function (value, offset, noAssert) {\n  _writeUInt32(this, value, offset, false, noAssert)\n}\n\nBuffer.prototype.writeInt8 = function (value, offset, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset < this.length, \'Trying to write beyond buffer length\')\n    verifsint(value, 0x7f, -0x80)\n  }\n\n  if (offset >= this.length)\n    return\n\n  if (value >= 0)\n    this.writeUInt8(value, offset, noAssert)\n  else\n    this.writeUInt8(0xff + value + 1, offset, noAssert)\n}\n\nfunction _writeInt16 (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 1 < buf.length, \'Trying to write beyond buffer length\')\n    verifsint(value, 0x7fff, -0x8000)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  if (value >= 0)\n    _writeUInt16(buf, value, offset, littleEndian, noAssert)\n  else\n    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)\n}\n\nBuffer.prototype.writeInt16LE = function (value, offset, noAssert) {\n  _writeInt16(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeInt16BE = function (value, offset, noAssert) {\n  _writeInt16(this, value, offset, false, noAssert)\n}\n\nfunction _writeInt32 (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 3 < buf.length, \'Trying to write beyond buffer length\')\n    verifsint(value, 0x7fffffff, -0x80000000)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  if (value >= 0)\n    _writeUInt32(buf, value, offset, littleEndian, noAssert)\n  else\n    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)\n}\n\nBuffer.prototype.writeInt32LE = function (value, offset, noAssert) {\n  _writeInt32(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeInt32BE = function (value, offset, noAssert) {\n  _writeInt32(this, value, offset, false, noAssert)\n}\n\nfunction _writeFloat (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 3 < buf.length, \'Trying to write beyond buffer length\')\n    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  ieee754.write(buf, value, offset, littleEndian, 23, 4)\n}\n\nBuffer.prototype.writeFloatLE = function (value, offset, noAssert) {\n  _writeFloat(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeFloatBE = function (value, offset, noAssert) {\n  _writeFloat(this, value, offset, false, noAssert)\n}\n\nfunction _writeDouble (buf, value, offset, littleEndian, noAssert) {\n  if (!noAssert) {\n    assert(value !== undefined && value !== null, \'missing value\')\n    assert(typeof littleEndian === \'boolean\', \'missing or invalid endian\')\n    assert(offset !== undefined && offset !== null, \'missing offset\')\n    assert(offset + 7 < buf.length,\n        \'Trying to write beyond buffer length\')\n    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)\n  }\n\n  var len = buf.length\n  if (offset >= len)\n    return\n\n  ieee754.write(buf, value, offset, littleEndian, 52, 8)\n}\n\nBuffer.prototype.writeDoubleLE = function (value, offset, noAssert) {\n  _writeDouble(this, value, offset, true, noAssert)\n}\n\nBuffer.prototype.writeDoubleBE = function (value, offset, noAssert) {\n  _writeDouble(this, value, offset, false, noAssert)\n}\n\n// fill(value, start=0, end=buffer.length)\nBuffer.prototype.fill = function (value, start, end) {\n  if (!value) value = 0\n  if (!start) start = 0\n  if (!end) end = this.length\n\n  if (typeof value === \'string\') {\n    value = value.charCodeAt(0)\n  }\n\n  assert(typeof value === \'number\' && !isNaN(value), \'value is not a number\')\n  assert(end >= start, \'end < start\')\n\n  // Fill 0 bytes; we\'re done\n  if (end === start) return\n  if (this.length === 0) return\n\n  assert(start >= 0 && start < this.length, \'start out of bounds\')\n  assert(end >= 0 && end <= this.length, \'end out of bounds\')\n\n  for (var i = start; i < end; i++) {\n    this[i] = value\n  }\n}\n\nBuffer.prototype.inspect = function () {\n  var out = []\n  var len = this.length\n  for (var i = 0; i < len; i++) {\n    out[i] = toHex(this[i])\n    if (i === exports.INSPECT_MAX_BYTES) {\n      out[i + 1] = \'...\'\n      break\n    }\n  }\n  return \'<Buffer \' + out.join(\' \') + \'>\'\n}\n\n/**\n * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.\n * Added in Node 0.12. Only available in browsers that support ArrayBuffer.\n */\nBuffer.prototype.toArrayBuffer = function () {\n  if (typeof Uint8Array !== \'undefined\') {\n    if (Buffer._useTypedArrays) {\n      return (new Buffer(this)).buffer\n    } else {\n      var buf = new Uint8Array(this.length)\n      for (var i = 0, len = buf.length; i < len; i += 1)\n        buf[i] = this[i]\n      return buf.buffer\n    }\n  } else {\n    throw new Error(\'Buffer.toArrayBuffer not supported in this browser\')\n  }\n}\n\n// HELPER FUNCTIONS\n// ================\n\nfunction stringtrim (str) {\n  if (str.trim) return str.trim()\n  return str.replace(/^\\s+|\\s+$/g, \'\')\n}\n\nvar BP = Buffer.prototype\n\n/**\n * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods\n */\nBuffer._augment = function (arr) {\n  arr._isBuffer = true\n\n  // save reference to original Uint8Array get/set methods before overwriting\n  arr._get = arr.get\n  arr._set = arr.set\n\n  // deprecated, will be removed in node 0.13+\n  arr.get = BP.get\n  arr.set = BP.set\n\n  arr.write = BP.write\n  arr.toString = BP.toString\n  arr.toLocaleString = BP.toString\n  arr.toJSON = BP.toJSON\n  arr.copy = BP.copy\n  arr.slice = BP.slice\n  arr.readUInt8 = BP.readUInt8\n  arr.readUInt16LE = BP.readUInt16LE\n  arr.readUInt16BE = BP.readUInt16BE\n  arr.readUInt32LE = BP.readUInt32LE\n  arr.readUInt32BE = BP.readUInt32BE\n  arr.readInt8 = BP.readInt8\n  arr.readInt16LE = BP.readInt16LE\n  arr.readInt16BE = BP.readInt16BE\n  arr.readInt32LE = BP.readInt32LE\n  arr.readInt32BE = BP.readInt32BE\n  arr.readFloatLE = BP.readFloatLE\n  arr.readFloatBE = BP.readFloatBE\n  arr.readDoubleLE = BP.readDoubleLE\n  arr.readDoubleBE = BP.readDoubleBE\n  arr.writeUInt8 = BP.writeUInt8\n  arr.writeUInt16LE = BP.writeUInt16LE\n  arr.writeUInt16BE = BP.writeUInt16BE\n  arr.writeUInt32LE = BP.writeUInt32LE\n  arr.writeUInt32BE = BP.writeUInt32BE\n  arr.writeInt8 = BP.writeInt8\n  arr.writeInt16LE = BP.writeInt16LE\n  arr.writeInt16BE = BP.writeInt16BE\n  arr.writeInt32LE = BP.writeInt32LE\n  arr.writeInt32BE = BP.writeInt32BE\n  arr.writeFloatLE = BP.writeFloatLE\n  arr.writeFloatBE = BP.writeFloatBE\n  arr.writeDoubleLE = BP.writeDoubleLE\n  arr.writeDoubleBE = BP.writeDoubleBE\n  arr.fill = BP.fill\n  arr.inspect = BP.inspect\n  arr.toArrayBuffer = BP.toArrayBuffer\n\n  return arr\n}\n\n// slice(start, end)\nfunction clamp (index, len, defaultValue) {\n  if (typeof index !== \'number\') return defaultValue\n  index = ~~index;  // Coerce to integer.\n  if (index >= len) return len\n  if (index >= 0) return index\n  index += len\n  if (index >= 0) return index\n  return 0\n}\n\nfunction coerce (length) {\n  // Coerce length to a number (possibly NaN), round up\n  // in case it\'s fractional (e.g. 123.456) then do a\n  // double negate to coerce a NaN to 0. Easy, right?\n  length = ~~Math.ceil(+length)\n  return length < 0 ? 0 : length\n}\n\nfunction isArray (subject) {\n  return (Array.isArray || function (subject) {\n    return Object.prototype.toString.call(subject) === \'[object Array]\'\n  })(subject)\n}\n\nfunction isArrayish (subject) {\n  return isArray(subject) || Buffer.isBuffer(subject) ||\n      subject && typeof subject === \'object\' &&\n      typeof subject.length === \'number\'\n}\n\nfunction toHex (n) {\n  if (n < 16) return \'0\' + n.toString(16)\n  return n.toString(16)\n}\n\nfunction utf8ToBytes (str) {\n  var byteArray = []\n  for (var i = 0; i < str.length; i++) {\n    var b = str.charCodeAt(i)\n    if (b <= 0x7F)\n      byteArray.push(str.charCodeAt(i))\n    else {\n      var start = i\n      if (b >= 0xD800 && b <= 0xDFFF) i++\n      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split(\'%\')\n      for (var j = 0; j < h.length; j++)\n        byteArray.push(parseInt(h[j], 16))\n    }\n  }\n  return byteArray\n}\n\nfunction asciiToBytes (str) {\n  var byteArray = []\n  for (var i = 0; i < str.length; i++) {\n    // Node\'s code seems to be doing this and not & 0x7F..\n    byteArray.push(str.charCodeAt(i) & 0xFF)\n  }\n  return byteArray\n}\n\nfunction utf16leToBytes (str) {\n  var c, hi, lo\n  var byteArray = []\n  for (var i = 0; i < str.length; i++) {\n    c = str.charCodeAt(i)\n    hi = c >> 8\n    lo = c % 256\n    byteArray.push(lo)\n    byteArray.push(hi)\n  }\n\n  return byteArray\n}\n\nfunction base64ToBytes (str) {\n  return base64.toByteArray(str)\n}\n\nfunction blitBuffer (src, dst, offset, length) {\n  var pos\n  for (var i = 0; i < length; i++) {\n    if ((i + offset >= dst.length) || (i >= src.length))\n      break\n    dst[i + offset] = src[i]\n  }\n  return i\n}\n\nfunction decodeUtf8Char (str) {\n  try {\n    return decodeURIComponent(str)\n  } catch (err) {\n    return String.fromCharCode(0xFFFD) // UTF 8 invalid char\n  }\n}\n\n/*\n * We have to make sure that the value is a valid integer. This means that it\n * is non-negative. It has no fractional component and that it does not\n * exceed the maximum allowed value.\n */\nfunction verifuint (value, max) {\n  assert(typeof value === \'number\', \'cannot write a non-number as a number\')\n  assert(value >= 0, \'specified a negative value for writing an unsigned value\')\n  assert(value <= max, \'value is larger than maximum value for type\')\n  assert(Math.floor(value) === value, \'value has a fractional component\')\n}\n\nfunction verifsint (value, max, min) {\n  assert(typeof value === \'number\', \'cannot write a non-number as a number\')\n  assert(value <= max, \'value larger than maximum allowed value\')\n  assert(value >= min, \'value smaller than minimum allowed value\')\n  assert(Math.floor(value) === value, \'value has a fractional component\')\n}\n\nfunction verifIEEE754 (value, max, min) {\n  assert(typeof value === \'number\', \'cannot write a non-number as a number\')\n  assert(value <= max, \'value larger than maximum allowed value\')\n  assert(value >= min, \'value smaller than minimum allowed value\')\n}\n\nfunction assert (test, message) {\n  if (!test) throw new Error(message || \'Failed assertion\')\n}\n\n},{"base64-js":25,"ieee754":26}],25:[function(require,module,exports){\nvar lookup = \'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/\';\n\n;(function (exports) {\n\t\'use strict\';\n\n  var Arr = (typeof Uint8Array !== \'undefined\')\n    ? Uint8Array\n    : Array\n\n\tvar PLUS   = \'+\'.charCodeAt(0)\n\tvar SLASH  = \'/\'.charCodeAt(0)\n\tvar NUMBER = \'0\'.charCodeAt(0)\n\tvar LOWER  = \'a\'.charCodeAt(0)\n\tvar UPPER  = \'A\'.charCodeAt(0)\n\n\tfunction decode (elt) {\n\t\tvar code = elt.charCodeAt(0)\n\t\tif (code === PLUS)\n\t\t\treturn 62 // \'+\'\n\t\tif (code === SLASH)\n\t\t\treturn 63 // \'/\'\n\t\tif (code < NUMBER)\n\t\t\treturn -1 //no match\n\t\tif (code < NUMBER + 10)\n\t\t\treturn code - NUMBER + 26 + 26\n\t\tif (code < UPPER + 26)\n\t\t\treturn code - UPPER\n\t\tif (code < LOWER + 26)\n\t\t\treturn code - LOWER + 26\n\t}\n\n\tfunction b64ToByteArray (b64) {\n\t\tvar i, j, l, tmp, placeHolders, arr\n\n\t\tif (b64.length % 4 > 0) {\n\t\t\tthrow new Error(\'Invalid string. Length must be a multiple of 4\')\n\t\t}\n\n\t\t// the number of equal signs (place holders)\n\t\t// if there are two placeholders, than the two characters before it\n\t\t// represent one byte\n\t\t// if there is only one, then the three characters before it represent 2 bytes\n\t\t// this is just a cheap hack to not do indexOf twice\n\t\tvar len = b64.length\n\t\tplaceHolders = \'=\' === b64.charAt(len - 2) ? 2 : \'=\' === b64.charAt(len - 1) ? 1 : 0\n\n\t\t// base64 is 4/3 + up to two characters of the original data\n\t\tarr = new Arr(b64.length * 3 / 4 - placeHolders)\n\n\t\t// if there are placeholders, only get up to the last complete 4 chars\n\t\tl = placeHolders > 0 ? b64.length - 4 : b64.length\n\n\t\tvar L = 0\n\n\t\tfunction push (v) {\n\t\t\tarr[L++] = v\n\t\t}\n\n\t\tfor (i = 0, j = 0; i < l; i += 4, j += 3) {\n\t\t\ttmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))\n\t\t\tpush((tmp & 0xFF0000) >> 16)\n\t\t\tpush((tmp & 0xFF00) >> 8)\n\t\t\tpush(tmp & 0xFF)\n\t\t}\n\n\t\tif (placeHolders === 2) {\n\t\t\ttmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)\n\t\t\tpush(tmp & 0xFF)\n\t\t} else if (placeHolders === 1) {\n\t\t\ttmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)\n\t\t\tpush((tmp >> 8) & 0xFF)\n\t\t\tpush(tmp & 0xFF)\n\t\t}\n\n\t\treturn arr\n\t}\n\n\tfunction uint8ToBase64 (uint8) {\n\t\tvar i,\n\t\t\textraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes\n\t\t\toutput = "",\n\t\t\ttemp, length\n\n\t\tfunction encode (num) {\n\t\t\treturn lookup.charAt(num)\n\t\t}\n\n\t\tfunction tripletToBase64 (num) {\n\t\t\treturn encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)\n\t\t}\n\n\t\t// go through the array every three bytes, we\'ll deal with trailing stuff later\n\t\tfor (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {\n\t\t\ttemp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])\n\t\t\toutput += tripletToBase64(temp)\n\t\t}\n\n\t\t// pad the end with zeros, but make sure to not forget the extra bytes\n\t\tswitch (extraBytes) {\n\t\t\tcase 1:\n\t\t\t\ttemp = uint8[uint8.length - 1]\n\t\t\t\toutput += encode(temp >> 2)\n\t\t\t\toutput += encode((temp << 4) & 0x3F)\n\t\t\t\toutput += \'==\'\n\t\t\t\tbreak\n\t\t\tcase 2:\n\t\t\t\ttemp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])\n\t\t\t\toutput += encode(temp >> 10)\n\t\t\t\toutput += encode((temp >> 4) & 0x3F)\n\t\t\t\toutput += encode((temp << 2) & 0x3F)\n\t\t\t\toutput += \'=\'\n\t\t\t\tbreak\n\t\t}\n\n\t\treturn output\n\t}\n\n\texports.toByteArray = b64ToByteArray\n\texports.fromByteArray = uint8ToBase64\n}(typeof exports === \'undefined\' ? (this.base64js = {}) : exports))\n\n},{}],26:[function(require,module,exports){\nexports.read = function(buffer, offset, isLE, mLen, nBytes) {\n  var e, m,\n      eLen = nBytes * 8 - mLen - 1,\n      eMax = (1 << eLen) - 1,\n      eBias = eMax >> 1,\n      nBits = -7,\n      i = isLE ? (nBytes - 1) : 0,\n      d = isLE ? -1 : 1,\n      s = buffer[offset + i];\n\n  i += d;\n\n  e = s & ((1 << (-nBits)) - 1);\n  s >>= (-nBits);\n  nBits += eLen;\n  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);\n\n  m = e & ((1 << (-nBits)) - 1);\n  e >>= (-nBits);\n  nBits += mLen;\n  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);\n\n  if (e === 0) {\n    e = 1 - eBias;\n  } else if (e === eMax) {\n    return m ? NaN : ((s ? -1 : 1) * Infinity);\n  } else {\n    m = m + Math.pow(2, mLen);\n    e = e - eBias;\n  }\n  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);\n};\n\nexports.write = function(buffer, value, offset, isLE, mLen, nBytes) {\n  var e, m, c,\n      eLen = nBytes * 8 - mLen - 1,\n      eMax = (1 << eLen) - 1,\n      eBias = eMax >> 1,\n      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),\n      i = isLE ? 0 : (nBytes - 1),\n      d = isLE ? 1 : -1,\n      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;\n\n  value = Math.abs(value);\n\n  if (isNaN(value) || value === Infinity) {\n    m = isNaN(value) ? 1 : 0;\n    e = eMax;\n  } else {\n    e = Math.floor(Math.log(value) / Math.LN2);\n    if (value * (c = Math.pow(2, -e)) < 1) {\n      e--;\n      c *= 2;\n    }\n    if (e + eBias >= 1) {\n      value += rt / c;\n    } else {\n      value += rt * Math.pow(2, 1 - eBias);\n    }\n    if (value * c >= 2) {\n      e++;\n      c /= 2;\n    }\n\n    if (e + eBias >= eMax) {\n      m = 0;\n      e = eMax;\n    } else if (e + eBias >= 1) {\n      m = (value * c - 1) * Math.pow(2, mLen);\n      e = e + eBias;\n    } else {\n      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);\n      e = 0;\n    }\n  }\n\n  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);\n\n  e = (e << mLen) | m;\n  eLen += mLen;\n  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);\n\n  buffer[offset + i - d] |= s * 128;\n};\n\n},{}],27:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\nfunction EventEmitter() {\n  this._events = this._events || {};\n  this._maxListeners = this._maxListeners || undefined;\n}\nmodule.exports = EventEmitter;\n\n// Backwards-compat with node 0.10.x\nEventEmitter.EventEmitter = EventEmitter;\n\nEventEmitter.prototype._events = undefined;\nEventEmitter.prototype._maxListeners = undefined;\n\n// By default EventEmitters will print a warning if more than 10 listeners are\n// added to it. This is a useful default which helps finding memory leaks.\nEventEmitter.defaultMaxListeners = 10;\n\n// Obviously not all Emitters should be limited to 10. This function allows\n// that to be increased. Set to zero for unlimited.\nEventEmitter.prototype.setMaxListeners = function(n) {\n  if (!isNumber(n) || n < 0 || isNaN(n))\n    throw TypeError(\'n must be a positive number\');\n  this._maxListeners = n;\n  return this;\n};\n\nEventEmitter.prototype.emit = function(type) {\n  var er, handler, len, args, i, listeners;\n\n  if (!this._events)\n    this._events = {};\n\n  // If there is no \'error\' event listener then throw.\n  if (type === \'error\') {\n    if (!this._events.error ||\n        (isObject(this._events.error) && !this._events.error.length)) {\n      er = arguments[1];\n      if (er instanceof Error) {\n        throw er; // Unhandled \'error\' event\n      } else {\n        throw TypeError(\'Uncaught, unspecified "error" event.\');\n      }\n      return false;\n    }\n  }\n\n  handler = this._events[type];\n\n  if (isUndefined(handler))\n    return false;\n\n  if (isFunction(handler)) {\n    switch (arguments.length) {\n      // fast cases\n      case 1:\n        handler.call(this);\n        break;\n      case 2:\n        handler.call(this, arguments[1]);\n        break;\n      case 3:\n        handler.call(this, arguments[1], arguments[2]);\n        break;\n      // slower\n      default:\n        len = arguments.length;\n        args = new Array(len - 1);\n        for (i = 1; i < len; i++)\n          args[i - 1] = arguments[i];\n        handler.apply(this, args);\n    }\n  } else if (isObject(handler)) {\n    len = arguments.length;\n    args = new Array(len - 1);\n    for (i = 1; i < len; i++)\n      args[i - 1] = arguments[i];\n\n    listeners = handler.slice();\n    len = listeners.length;\n    for (i = 0; i < len; i++)\n      listeners[i].apply(this, args);\n  }\n\n  return true;\n};\n\nEventEmitter.prototype.addListener = function(type, listener) {\n  var m;\n\n  if (!isFunction(listener))\n    throw TypeError(\'listener must be a function\');\n\n  if (!this._events)\n    this._events = {};\n\n  // To avoid recursion in the case that type === "newListener"! Before\n  // adding it to the listeners, first emit "newListener".\n  if (this._events.newListener)\n    this.emit(\'newListener\', type,\n              isFunction(listener.listener) ?\n              listener.listener : listener);\n\n  if (!this._events[type])\n    // Optimize the case of one listener. Don\'t need the extra array object.\n    this._events[type] = listener;\n  else if (isObject(this._events[type]))\n    // If we\'ve already got an array, just append.\n    this._events[type].push(listener);\n  else\n    // Adding the second element, need to change to array.\n    this._events[type] = [this._events[type], listener];\n\n  // Check for listener leak\n  if (isObject(this._events[type]) && !this._events[type].warned) {\n    var m;\n    if (!isUndefined(this._maxListeners)) {\n      m = this._maxListeners;\n    } else {\n      m = EventEmitter.defaultMaxListeners;\n    }\n\n    if (m && m > 0 && this._events[type].length > m) {\n      this._events[type].warned = true;\n      console.error(\'(node) warning: possible EventEmitter memory \' +\n                    \'leak detected. %d listeners added. \' +\n                    \'Use emitter.setMaxListeners() to increase limit.\',\n                    this._events[type].length);\n      if (typeof console.trace === \'function\') {\n        // not supported in IE 10\n        console.trace();\n      }\n    }\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.on = EventEmitter.prototype.addListener;\n\nEventEmitter.prototype.once = function(type, listener) {\n  if (!isFunction(listener))\n    throw TypeError(\'listener must be a function\');\n\n  var fired = false;\n\n  function g() {\n    this.removeListener(type, g);\n\n    if (!fired) {\n      fired = true;\n      listener.apply(this, arguments);\n    }\n  }\n\n  g.listener = listener;\n  this.on(type, g);\n\n  return this;\n};\n\n// emits a \'removeListener\' event iff the listener was removed\nEventEmitter.prototype.removeListener = function(type, listener) {\n  var list, position, length, i;\n\n  if (!isFunction(listener))\n    throw TypeError(\'listener must be a function\');\n\n  if (!this._events || !this._events[type])\n    return this;\n\n  list = this._events[type];\n  length = list.length;\n  position = -1;\n\n  if (list === listener ||\n      (isFunction(list.listener) && list.listener === listener)) {\n    delete this._events[type];\n    if (this._events.removeListener)\n      this.emit(\'removeListener\', type, listener);\n\n  } else if (isObject(list)) {\n    for (i = length; i-- > 0;) {\n      if (list[i] === listener ||\n          (list[i].listener && list[i].listener === listener)) {\n        position = i;\n        break;\n      }\n    }\n\n    if (position < 0)\n      return this;\n\n    if (list.length === 1) {\n      list.length = 0;\n      delete this._events[type];\n    } else {\n      list.splice(position, 1);\n    }\n\n    if (this._events.removeListener)\n      this.emit(\'removeListener\', type, listener);\n  }\n\n  return this;\n};\n\nEventEmitter.prototype.removeAllListeners = function(type) {\n  var key, listeners;\n\n  if (!this._events)\n    return this;\n\n  // not listening for removeListener, no need to emit\n  if (!this._events.removeListener) {\n    if (arguments.length === 0)\n      this._events = {};\n    else if (this._events[type])\n      delete this._events[type];\n    return this;\n  }\n\n  // emit removeListener for all listeners on all events\n  if (arguments.length === 0) {\n    for (key in this._events) {\n      if (key === \'removeListener\') continue;\n      this.removeAllListeners(key);\n    }\n    this.removeAllListeners(\'removeListener\');\n    this._events = {};\n    return this;\n  }\n\n  listeners = this._events[type];\n\n  if (isFunction(listeners)) {\n    this.removeListener(type, listeners);\n  } else {\n    // LIFO order\n    while (listeners.length)\n      this.removeListener(type, listeners[listeners.length - 1]);\n  }\n  delete this._events[type];\n\n  return this;\n};\n\nEventEmitter.prototype.listeners = function(type) {\n  var ret;\n  if (!this._events || !this._events[type])\n    ret = [];\n  else if (isFunction(this._events[type]))\n    ret = [this._events[type]];\n  else\n    ret = this._events[type].slice();\n  return ret;\n};\n\nEventEmitter.listenerCount = function(emitter, type) {\n  var ret;\n  if (!emitter._events || !emitter._events[type])\n    ret = 0;\n  else if (isFunction(emitter._events[type]))\n    ret = 1;\n  else\n    ret = emitter._events[type].length;\n  return ret;\n};\n\nfunction isFunction(arg) {\n  return typeof arg === \'function\';\n}\n\nfunction isNumber(arg) {\n  return typeof arg === \'number\';\n}\n\nfunction isObject(arg) {\n  return typeof arg === \'object\' && arg !== null;\n}\n\nfunction isUndefined(arg) {\n  return arg === void 0;\n}\n\n},{}],28:[function(require,module,exports){\nif (typeof Object.create === \'function\') {\n  // implementation from standard node.js \'util\' module\n  module.exports = function inherits(ctor, superCtor) {\n    ctor.super_ = superCtor\n    ctor.prototype = Object.create(superCtor.prototype, {\n      constructor: {\n        value: ctor,\n        enumerable: false,\n        writable: true,\n        configurable: true\n      }\n    });\n  };\n} else {\n  // old school shim for old browsers\n  module.exports = function inherits(ctor, superCtor) {\n    ctor.super_ = superCtor\n    var TempCtor = function () {}\n    TempCtor.prototype = superCtor.prototype\n    ctor.prototype = new TempCtor()\n    ctor.prototype.constructor = ctor\n  }\n}\n\n},{}],29:[function(require,module,exports){\n// shim for using process in browser\n\nvar process = module.exports = {};\n\nprocess.nextTick = (function () {\n    var canSetImmediate = typeof window !== \'undefined\'\n    && window.setImmediate;\n    var canPost = typeof window !== \'undefined\'\n    && window.postMessage && window.addEventListener\n    ;\n\n    if (canSetImmediate) {\n        return function (f) { return window.setImmediate(f) };\n    }\n\n    if (canPost) {\n        var queue = [];\n        window.addEventListener(\'message\', function (ev) {\n            var source = ev.source;\n            if ((source === window || source === null) && ev.data === \'process-tick\') {\n                ev.stopPropagation();\n                if (queue.length > 0) {\n                    var fn = queue.shift();\n                    fn();\n                }\n            }\n        }, true);\n\n        return function nextTick(fn) {\n            queue.push(fn);\n            window.postMessage(\'process-tick\', \'*\');\n        };\n    }\n\n    return function nextTick(fn) {\n        setTimeout(fn, 0);\n    };\n})();\n\nprocess.title = \'browser\';\nprocess.browser = true;\nprocess.env = {};\nprocess.argv = [];\n\nfunction noop() {}\n\nprocess.on = noop;\nprocess.once = noop;\nprocess.off = noop;\nprocess.emit = noop;\n\nprocess.binding = function (name) {\n    throw new Error(\'process.binding is not supported\');\n}\n\n// TODO(shtylman)\nprocess.cwd = function () { return \'/\' };\nprocess.chdir = function (dir) {\n    throw new Error(\'process.chdir is not supported\');\n};\n\n},{}],30:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n// a duplex stream is just a stream that is both readable and writable.\n// Since JS doesn\'t have multiple prototypal inheritance, this class\n// prototypally inherits from Readable, and then parasitically from\n// Writable.\n\nmodule.exports = Duplex;\nvar inherits = require(\'inherits\');\nvar setImmediate = require(\'process/browser.js\').nextTick;\nvar Readable = require(\'./readable.js\');\nvar Writable = require(\'./writable.js\');\n\ninherits(Duplex, Readable);\n\nDuplex.prototype.write = Writable.prototype.write;\nDuplex.prototype.end = Writable.prototype.end;\nDuplex.prototype._write = Writable.prototype._write;\n\nfunction Duplex(options) {\n  if (!(this instanceof Duplex))\n    return new Duplex(options);\n\n  Readable.call(this, options);\n  Writable.call(this, options);\n\n  if (options && options.readable === false)\n    this.readable = false;\n\n  if (options && options.writable === false)\n    this.writable = false;\n\n  this.allowHalfOpen = true;\n  if (options && options.allowHalfOpen === false)\n    this.allowHalfOpen = false;\n\n  this.once(\'end\', onend);\n}\n\n// the no-half-open enforcer\nfunction onend() {\n  // if we allow half-open state, or if the writable side ended,\n  // then we\'re ok.\n  if (this.allowHalfOpen || this._writableState.ended)\n    return;\n\n  // no more data can be written.\n  // But allow more writes to happen in this tick.\n  var self = this;\n  setImmediate(function () {\n    self.end();\n  });\n}\n\n},{"./readable.js":34,"./writable.js":36,"inherits":28,"process/browser.js":32}],31:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\nmodule.exports = Stream;\n\nvar EE = require(\'events\').EventEmitter;\nvar inherits = require(\'inherits\');\n\ninherits(Stream, EE);\nStream.Readable = require(\'./readable.js\');\nStream.Writable = require(\'./writable.js\');\nStream.Duplex = require(\'./duplex.js\');\nStream.Transform = require(\'./transform.js\');\nStream.PassThrough = require(\'./passthrough.js\');\n\n// Backwards-compat with node 0.4.x\nStream.Stream = Stream;\n\n\n\n// old-style streams.  Note that the pipe method (the only relevant\n// part of this class) is overridden in the Readable class.\n\nfunction Stream() {\n  EE.call(this);\n}\n\nStream.prototype.pipe = function(dest, options) {\n  var source = this;\n\n  function ondata(chunk) {\n    if (dest.writable) {\n      if (false === dest.write(chunk) && source.pause) {\n        source.pause();\n      }\n    }\n  }\n\n  source.on(\'data\', ondata);\n\n  function ondrain() {\n    if (source.readable && source.resume) {\n      source.resume();\n    }\n  }\n\n  dest.on(\'drain\', ondrain);\n\n  // If the \'end\' option is not supplied, dest.end() will be called when\n  // source gets the \'end\' or \'close\' events.  Only dest.end() once.\n  if (!dest._isStdio && (!options || options.end !== false)) {\n    source.on(\'end\', onend);\n    source.on(\'close\', onclose);\n  }\n\n  var didOnEnd = false;\n  function onend() {\n    if (didOnEnd) return;\n    didOnEnd = true;\n\n    dest.end();\n  }\n\n\n  function onclose() {\n    if (didOnEnd) return;\n    didOnEnd = true;\n\n    if (typeof dest.destroy === \'function\') dest.destroy();\n  }\n\n  // don\'t leave dangling pipes when there are errors.\n  function onerror(er) {\n    cleanup();\n    if (EE.listenerCount(this, \'error\') === 0) {\n      throw er; // Unhandled stream error in pipe.\n    }\n  }\n\n  source.on(\'error\', onerror);\n  dest.on(\'error\', onerror);\n\n  // remove all the event listeners that were added.\n  function cleanup() {\n    source.removeListener(\'data\', ondata);\n    dest.removeListener(\'drain\', ondrain);\n\n    source.removeListener(\'end\', onend);\n    source.removeListener(\'close\', onclose);\n\n    source.removeListener(\'error\', onerror);\n    dest.removeListener(\'error\', onerror);\n\n    source.removeListener(\'end\', cleanup);\n    source.removeListener(\'close\', cleanup);\n\n    dest.removeListener(\'close\', cleanup);\n  }\n\n  source.on(\'end\', cleanup);\n  source.on(\'close\', cleanup);\n\n  dest.on(\'close\', cleanup);\n\n  dest.emit(\'pipe\', source);\n\n  // Allow for unix-like usage: A.pipe(B).pipe(C)\n  return dest;\n};\n\n},{"./duplex.js":30,"./passthrough.js":33,"./readable.js":34,"./transform.js":35,"./writable.js":36,"events":27,"inherits":28}],32:[function(require,module,exports){\n// shim for using process in browser\n\nvar process = module.exports = {};\n\nprocess.nextTick = (function () {\n    var canSetImmediate = typeof window !== \'undefined\'\n    && window.setImmediate;\n    var canPost = typeof window !== \'undefined\'\n    && window.postMessage && window.addEventListener\n    ;\n\n    if (canSetImmediate) {\n        return function (f) { return window.setImmediate(f) };\n    }\n\n    if (canPost) {\n        var queue = [];\n        window.addEventListener(\'message\', function (ev) {\n            var source = ev.source;\n            if ((source === window || source === null) && ev.data === \'process-tick\') {\n                ev.stopPropagation();\n                if (queue.length > 0) {\n                    var fn = queue.shift();\n                    fn();\n                }\n            }\n        }, true);\n\n        return function nextTick(fn) {\n            queue.push(fn);\n            window.postMessage(\'process-tick\', \'*\');\n        };\n    }\n\n    return function nextTick(fn) {\n        setTimeout(fn, 0);\n    };\n})();\n\nprocess.title = \'browser\';\nprocess.browser = true;\nprocess.env = {};\nprocess.argv = [];\n\nprocess.binding = function (name) {\n    throw new Error(\'process.binding is not supported\');\n}\n\n// TODO(shtylman)\nprocess.cwd = function () { return \'/\' };\nprocess.chdir = function (dir) {\n    throw new Error(\'process.chdir is not supported\');\n};\n\n},{}],33:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n// a passthrough stream.\n// basically just the most minimal sort of Transform stream.\n// Every written chunk gets output as-is.\n\nmodule.exports = PassThrough;\n\nvar Transform = require(\'./transform.js\');\nvar inherits = require(\'inherits\');\ninherits(PassThrough, Transform);\n\nfunction PassThrough(options) {\n  if (!(this instanceof PassThrough))\n    return new PassThrough(options);\n\n  Transform.call(this, options);\n}\n\nPassThrough.prototype._transform = function(chunk, encoding, cb) {\n  cb(null, chunk);\n};\n\n},{"./transform.js":35,"inherits":28}],34:[function(require,module,exports){\n(function (process){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\nmodule.exports = Readable;\nReadable.ReadableState = ReadableState;\n\nvar EE = require(\'events\').EventEmitter;\nvar Stream = require(\'./index.js\');\nvar Buffer = require(\'buffer\').Buffer;\nvar setImmediate = require(\'process/browser.js\').nextTick;\nvar StringDecoder;\n\nvar inherits = require(\'inherits\');\ninherits(Readable, Stream);\n\nfunction ReadableState(options, stream) {\n  options = options || {};\n\n  // the point at which it stops calling _read() to fill the buffer\n  // Note: 0 is a valid value, means "don\'t call _read preemptively ever"\n  var hwm = options.highWaterMark;\n  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;\n\n  // cast to ints.\n  this.highWaterMark = ~~this.highWaterMark;\n\n  this.buffer = [];\n  this.length = 0;\n  this.pipes = null;\n  this.pipesCount = 0;\n  this.flowing = false;\n  this.ended = false;\n  this.endEmitted = false;\n  this.reading = false;\n\n  // In streams that never have any data, and do push(null) right away,\n  // the consumer can miss the \'end\' event if they do some I/O before\n  // consuming the stream.  So, we don\'t emit(\'end\') until some reading\n  // happens.\n  this.calledRead = false;\n\n  // a flag to be able to tell if the onwrite cb is called immediately,\n  // or on a later tick.  We set this to true at first, becuase any\n  // actions that shouldn\'t happen until "later" should generally also\n  // not happen before the first write call.\n  this.sync = true;\n\n  // whenever we return null, then we set a flag to say\n  // that we\'re awaiting a \'readable\' event emission.\n  this.needReadable = false;\n  this.emittedReadable = false;\n  this.readableListening = false;\n\n\n  // object stream flag. Used to make read(n) ignore n and to\n  // make all the buffer merging and length checks go away\n  this.objectMode = !!options.objectMode;\n\n  // Crypto is kind of old and crusty.  Historically, its default string\n  // encoding is \'binary\' so we have to make this configurable.\n  // Everything else in the universe uses \'utf8\', though.\n  this.defaultEncoding = options.defaultEncoding || \'utf8\';\n\n  // when piping, we only care about \'readable\' events that happen\n  // after read()ing all the bytes and not getting any pushback.\n  this.ranOut = false;\n\n  // the number of writers that are awaiting a drain event in .pipe()s\n  this.awaitDrain = 0;\n\n  // if true, a maybeReadMore has been scheduled\n  this.readingMore = false;\n\n  this.decoder = null;\n  this.encoding = null;\n  if (options.encoding) {\n    if (!StringDecoder)\n      StringDecoder = require(\'string_decoder\').StringDecoder;\n    this.decoder = new StringDecoder(options.encoding);\n    this.encoding = options.encoding;\n  }\n}\n\nfunction Readable(options) {\n  if (!(this instanceof Readable))\n    return new Readable(options);\n\n  this._readableState = new ReadableState(options, this);\n\n  // legacy\n  this.readable = true;\n\n  Stream.call(this);\n}\n\n// Manually shove something into the read() buffer.\n// This returns true if the highWaterMark has not been hit yet,\n// similar to how Writable.write() returns true if you should\n// write() some more.\nReadable.prototype.push = function(chunk, encoding) {\n  var state = this._readableState;\n\n  if (typeof chunk === \'string\' && !state.objectMode) {\n    encoding = encoding || state.defaultEncoding;\n    if (encoding !== state.encoding) {\n      chunk = new Buffer(chunk, encoding);\n      encoding = \'\';\n    }\n  }\n\n  return readableAddChunk(this, state, chunk, encoding, false);\n};\n\n// Unshift should *always* be something directly out of read()\nReadable.prototype.unshift = function(chunk) {\n  var state = this._readableState;\n  return readableAddChunk(this, state, chunk, \'\', true);\n};\n\nfunction readableAddChunk(stream, state, chunk, encoding, addToFront) {\n  var er = chunkInvalid(state, chunk);\n  if (er) {\n    stream.emit(\'error\', er);\n  } else if (chunk === null || chunk === undefined) {\n    state.reading = false;\n    if (!state.ended)\n      onEofChunk(stream, state);\n  } else if (state.objectMode || chunk && chunk.length > 0) {\n    if (state.ended && !addToFront) {\n      var e = new Error(\'stream.push() after EOF\');\n      stream.emit(\'error\', e);\n    } else if (state.endEmitted && addToFront) {\n      var e = new Error(\'stream.unshift() after end event\');\n      stream.emit(\'error\', e);\n    } else {\n      if (state.decoder && !addToFront && !encoding)\n        chunk = state.decoder.write(chunk);\n\n      // update the buffer info.\n      state.length += state.objectMode ? 1 : chunk.length;\n      if (addToFront) {\n        state.buffer.unshift(chunk);\n      } else {\n        state.reading = false;\n        state.buffer.push(chunk);\n      }\n\n      if (state.needReadable)\n        emitReadable(stream);\n\n      maybeReadMore(stream, state);\n    }\n  } else if (!addToFront) {\n    state.reading = false;\n  }\n\n  return needMoreData(state);\n}\n\n\n\n// if it\'s past the high water mark, we can push in some more.\n// Also, if we have no data yet, we can stand some\n// more bytes.  This is to work around cases where hwm=0,\n// such as the repl.  Also, if the push() triggered a\n// readable event, and the user called read(largeNumber) such that\n// needReadable was set, then we ought to push more, so that another\n// \'readable\' event will be triggered.\nfunction needMoreData(state) {\n  return !state.ended &&\n         (state.needReadable ||\n          state.length < state.highWaterMark ||\n          state.length === 0);\n}\n\n// backwards compatibility.\nReadable.prototype.setEncoding = function(enc) {\n  if (!StringDecoder)\n    StringDecoder = require(\'string_decoder\').StringDecoder;\n  this._readableState.decoder = new StringDecoder(enc);\n  this._readableState.encoding = enc;\n};\n\n// Don\'t raise the hwm > 128MB\nvar MAX_HWM = 0x800000;\nfunction roundUpToNextPowerOf2(n) {\n  if (n >= MAX_HWM) {\n    n = MAX_HWM;\n  } else {\n    // Get the next highest power of 2\n    n--;\n    for (var p = 1; p < 32; p <<= 1) n |= n >> p;\n    n++;\n  }\n  return n;\n}\n\nfunction howMuchToRead(n, state) {\n  if (state.length === 0 && state.ended)\n    return 0;\n\n  if (state.objectMode)\n    return n === 0 ? 0 : 1;\n\n  if (isNaN(n) || n === null) {\n    // only flow one buffer at a time\n    if (state.flowing && state.buffer.length)\n      return state.buffer[0].length;\n    else\n      return state.length;\n  }\n\n  if (n <= 0)\n    return 0;\n\n  // If we\'re asking for more than the target buffer level,\n  // then raise the water mark.  Bump up to the next highest\n  // power of 2, to prevent increasing it excessively in tiny\n  // amounts.\n  if (n > state.highWaterMark)\n    state.highWaterMark = roundUpToNextPowerOf2(n);\n\n  // don\'t have that much.  return null, unless we\'ve ended.\n  if (n > state.length) {\n    if (!state.ended) {\n      state.needReadable = true;\n      return 0;\n    } else\n      return state.length;\n  }\n\n  return n;\n}\n\n// you can override either this method, or the async _read(n) below.\nReadable.prototype.read = function(n) {\n  var state = this._readableState;\n  state.calledRead = true;\n  var nOrig = n;\n\n  if (typeof n !== \'number\' || n > 0)\n    state.emittedReadable = false;\n\n  // if we\'re doing read(0) to trigger a readable event, but we\n  // already have a bunch of data in the buffer, then just trigger\n  // the \'readable\' event and move on.\n  if (n === 0 &&\n      state.needReadable &&\n      (state.length >= state.highWaterMark || state.ended)) {\n    emitReadable(this);\n    return null;\n  }\n\n  n = howMuchToRead(n, state);\n\n  // if we\'ve ended, and we\'re now clear, then finish it up.\n  if (n === 0 && state.ended) {\n    if (state.length === 0)\n      endReadable(this);\n    return null;\n  }\n\n  // All the actual chunk generation logic needs to be\n  // *below* the call to _read.  The reason is that in certain\n  // synthetic stream cases, such as passthrough streams, _read\n  // may be a completely synchronous operation which may change\n  // the state of the read buffer, providing enough data when\n  // before there was *not* enough.\n  //\n  // So, the steps are:\n  // 1. Figure out what the state of things will be after we do\n  // a read from the buffer.\n  //\n  // 2. If that resulting state will trigger a _read, then call _read.\n  // Note that this may be asynchronous, or synchronous.  Yes, it is\n  // deeply ugly to write APIs this way, but that still doesn\'t mean\n  // that the Readable class should behave improperly, as streams are\n  // designed to be sync/async agnostic.\n  // Take note if the _read call is sync or async (ie, if the read call\n  // has returned yet), so that we know whether or not it\'s safe to emit\n  // \'readable\' etc.\n  //\n  // 3. Actually pull the requested chunks out of the buffer and return.\n\n  // if we need a readable event, then we need to do some reading.\n  var doRead = state.needReadable;\n\n  // if we currently have less than the highWaterMark, then also read some\n  if (state.length - n <= state.highWaterMark)\n    doRead = true;\n\n  // however, if we\'ve ended, then there\'s no point, and if we\'re already\n  // reading, then it\'s unnecessary.\n  if (state.ended || state.reading)\n    doRead = false;\n\n  if (doRead) {\n    state.reading = true;\n    state.sync = true;\n    // if the length is currently zero, then we *need* a readable event.\n    if (state.length === 0)\n      state.needReadable = true;\n    // call internal read method\n    this._read(state.highWaterMark);\n    state.sync = false;\n  }\n\n  // If _read called its callback synchronously, then `reading`\n  // will be false, and we need to re-evaluate how much data we\n  // can return to the user.\n  if (doRead && !state.reading)\n    n = howMuchToRead(nOrig, state);\n\n  var ret;\n  if (n > 0)\n    ret = fromList(n, state);\n  else\n    ret = null;\n\n  if (ret === null) {\n    state.needReadable = true;\n    n = 0;\n  }\n\n  state.length -= n;\n\n  // If we have nothing in the buffer, then we want to know\n  // as soon as we *do* get something into the buffer.\n  if (state.length === 0 && !state.ended)\n    state.needReadable = true;\n\n  // If we happened to read() exactly the remaining amount in the\n  // buffer, and the EOF has been seen at this point, then make sure\n  // that we emit \'end\' on the very next tick.\n  if (state.ended && !state.endEmitted && state.length === 0)\n    endReadable(this);\n\n  return ret;\n};\n\nfunction chunkInvalid(state, chunk) {\n  var er = null;\n  if (!Buffer.isBuffer(chunk) &&\n      \'string\' !== typeof chunk &&\n      chunk !== null &&\n      chunk !== undefined &&\n      !state.objectMode &&\n      !er) {\n    er = new TypeError(\'Invalid non-string/buffer chunk\');\n  }\n  return er;\n}\n\n\nfunction onEofChunk(stream, state) {\n  if (state.decoder && !state.ended) {\n    var chunk = state.decoder.end();\n    if (chunk && chunk.length) {\n      state.buffer.push(chunk);\n      state.length += state.objectMode ? 1 : chunk.length;\n    }\n  }\n  state.ended = true;\n\n  // if we\'ve ended and we have some data left, then emit\n  // \'readable\' now to make sure it gets picked up.\n  if (state.length > 0)\n    emitReadable(stream);\n  else\n    endReadable(stream);\n}\n\n// Don\'t emit readable right away in sync mode, because this can trigger\n// another read() call => stack overflow.  This way, it might trigger\n// a nextTick recursion warning, but that\'s not so bad.\nfunction emitReadable(stream) {\n  var state = stream._readableState;\n  state.needReadable = false;\n  if (state.emittedReadable)\n    return;\n\n  state.emittedReadable = true;\n  if (state.sync)\n    setImmediate(function() {\n      emitReadable_(stream);\n    });\n  else\n    emitReadable_(stream);\n}\n\nfunction emitReadable_(stream) {\n  stream.emit(\'readable\');\n}\n\n\n// at this point, the user has presumably seen the \'readable\' event,\n// and called read() to consume some data.  that may have triggered\n// in turn another _read(n) call, in which case reading = true if\n// it\'s in progress.\n// However, if we\'re not ended, or reading, and the length < hwm,\n// then go ahead and try to read some more preemptively.\nfunction maybeReadMore(stream, state) {\n  if (!state.readingMore) {\n    state.readingMore = true;\n    setImmediate(function() {\n      maybeReadMore_(stream, state);\n    });\n  }\n}\n\nfunction maybeReadMore_(stream, state) {\n  var len = state.length;\n  while (!state.reading && !state.flowing && !state.ended &&\n         state.length < state.highWaterMark) {\n    stream.read(0);\n    if (len === state.length)\n      // didn\'t get any data, stop spinning.\n      break;\n    else\n      len = state.length;\n  }\n  state.readingMore = false;\n}\n\n// abstract method.  to be overridden in specific implementation classes.\n// call cb(er, data) where data is <= n in length.\n// for virtual (non-string, non-buffer) streams, "length" is somewhat\n// arbitrary, and perhaps not very meaningful.\nReadable.prototype._read = function(n) {\n  this.emit(\'error\', new Error(\'not implemented\'));\n};\n\nReadable.prototype.pipe = function(dest, pipeOpts) {\n  var src = this;\n  var state = this._readableState;\n\n  switch (state.pipesCount) {\n    case 0:\n      state.pipes = dest;\n      break;\n    case 1:\n      state.pipes = [state.pipes, dest];\n      break;\n    default:\n      state.pipes.push(dest);\n      break;\n  }\n  state.pipesCount += 1;\n\n  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&\n              dest !== process.stdout &&\n              dest !== process.stderr;\n\n  var endFn = doEnd ? onend : cleanup;\n  if (state.endEmitted)\n    setImmediate(endFn);\n  else\n    src.once(\'end\', endFn);\n\n  dest.on(\'unpipe\', onunpipe);\n  function onunpipe(readable) {\n    if (readable !== src) return;\n    cleanup();\n  }\n\n  function onend() {\n    dest.end();\n  }\n\n  // when the dest drains, it reduces the awaitDrain counter\n  // on the source.  This would be more elegant with a .once()\n  // handler in flow(), but adding and removing repeatedly is\n  // too slow.\n  var ondrain = pipeOnDrain(src);\n  dest.on(\'drain\', ondrain);\n\n  function cleanup() {\n    // cleanup event handlers once the pipe is broken\n    dest.removeListener(\'close\', onclose);\n    dest.removeListener(\'finish\', onfinish);\n    dest.removeListener(\'drain\', ondrain);\n    dest.removeListener(\'error\', onerror);\n    dest.removeListener(\'unpipe\', onunpipe);\n    src.removeListener(\'end\', onend);\n    src.removeListener(\'end\', cleanup);\n\n    // if the reader is waiting for a drain event from this\n    // specific writer, then it would cause it to never start\n    // flowing again.\n    // So, if this is awaiting a drain, then we just call it now.\n    // If we don\'t know, then assume that we are waiting for one.\n    if (!dest._writableState || dest._writableState.needDrain)\n      ondrain();\n  }\n\n  // if the dest has an error, then stop piping into it.\n  // however, don\'t suppress the throwing behavior for this.\n  // check for listeners before emit removes one-time listeners.\n  var errListeners = EE.listenerCount(dest, \'error\');\n  function onerror(er) {\n    unpipe();\n    if (errListeners === 0 && EE.listenerCount(dest, \'error\') === 0)\n      dest.emit(\'error\', er);\n  }\n  dest.once(\'error\', onerror);\n\n  // Both close and finish should trigger unpipe, but only once.\n  function onclose() {\n    dest.removeListener(\'finish\', onfinish);\n    unpipe();\n  }\n  dest.once(\'close\', onclose);\n  function onfinish() {\n    dest.removeListener(\'close\', onclose);\n    unpipe();\n  }\n  dest.once(\'finish\', onfinish);\n\n  function unpipe() {\n    src.unpipe(dest);\n  }\n\n  // tell the dest that it\'s being piped to\n  dest.emit(\'pipe\', src);\n\n  // start the flow if it hasn\'t been started already.\n  if (!state.flowing) {\n    // the handler that waits for readable events after all\n    // the data gets sucked out in flow.\n    // This would be easier to follow with a .once() handler\n    // in flow(), but that is too slow.\n    this.on(\'readable\', pipeOnReadable);\n\n    state.flowing = true;\n    setImmediate(function() {\n      flow(src);\n    });\n  }\n\n  return dest;\n};\n\nfunction pipeOnDrain(src) {\n  return function() {\n    var dest = this;\n    var state = src._readableState;\n    state.awaitDrain--;\n    if (state.awaitDrain === 0)\n      flow(src);\n  };\n}\n\nfunction flow(src) {\n  var state = src._readableState;\n  var chunk;\n  state.awaitDrain = 0;\n\n  function write(dest, i, list) {\n    var written = dest.write(chunk);\n    if (false === written) {\n      state.awaitDrain++;\n    }\n  }\n\n  while (state.pipesCount && null !== (chunk = src.read())) {\n\n    if (state.pipesCount === 1)\n      write(state.pipes, 0, null);\n    else\n      forEach(state.pipes, write);\n\n    src.emit(\'data\', chunk);\n\n    // if anyone needs a drain, then we have to wait for that.\n    if (state.awaitDrain > 0)\n      return;\n  }\n\n  // if every destination was unpiped, either before entering this\n  // function, or in the while loop, then stop flowing.\n  //\n  // NB: This is a pretty rare edge case.\n  if (state.pipesCount === 0) {\n    state.flowing = false;\n\n    // if there were data event listeners added, then switch to old mode.\n    if (EE.listenerCount(src, \'data\') > 0)\n      emitDataEvents(src);\n    return;\n  }\n\n  // at this point, no one needed a drain, so we just ran out of data\n  // on the next readable event, start it over again.\n  state.ranOut = true;\n}\n\nfunction pipeOnReadable() {\n  if (this._readableState.ranOut) {\n    this._readableState.ranOut = false;\n    flow(this);\n  }\n}\n\n\nReadable.prototype.unpipe = function(dest) {\n  var state = this._readableState;\n\n  // if we\'re not piping anywhere, then do nothing.\n  if (state.pipesCount === 0)\n    return this;\n\n  // just one destination.  most common case.\n  if (state.pipesCount === 1) {\n    // passed in one, but it\'s not the right one.\n    if (dest && dest !== state.pipes)\n      return this;\n\n    if (!dest)\n      dest = state.pipes;\n\n    // got a match.\n    state.pipes = null;\n    state.pipesCount = 0;\n    this.removeListener(\'readable\', pipeOnReadable);\n    state.flowing = false;\n    if (dest)\n      dest.emit(\'unpipe\', this);\n    return this;\n  }\n\n  // slow case. multiple pipe destinations.\n\n  if (!dest) {\n    // remove all.\n    var dests = state.pipes;\n    var len = state.pipesCount;\n    state.pipes = null;\n    state.pipesCount = 0;\n    this.removeListener(\'readable\', pipeOnReadable);\n    state.flowing = false;\n\n    for (var i = 0; i < len; i++)\n      dests[i].emit(\'unpipe\', this);\n    return this;\n  }\n\n  // try to find the right one.\n  var i = indexOf(state.pipes, dest);\n  if (i === -1)\n    return this;\n\n  state.pipes.splice(i, 1);\n  state.pipesCount -= 1;\n  if (state.pipesCount === 1)\n    state.pipes = state.pipes[0];\n\n  dest.emit(\'unpipe\', this);\n\n  return this;\n};\n\n// set up data events if they are asked for\n// Ensure readable listeners eventually get something\nReadable.prototype.on = function(ev, fn) {\n  var res = Stream.prototype.on.call(this, ev, fn);\n\n  if (ev === \'data\' && !this._readableState.flowing)\n    emitDataEvents(this);\n\n  if (ev === \'readable\' && this.readable) {\n    var state = this._readableState;\n    if (!state.readableListening) {\n      state.readableListening = true;\n      state.emittedReadable = false;\n      state.needReadable = true;\n      if (!state.reading) {\n        this.read(0);\n      } else if (state.length) {\n        emitReadable(this, state);\n      }\n    }\n  }\n\n  return res;\n};\nReadable.prototype.addListener = Readable.prototype.on;\n\n// pause() and resume() are remnants of the legacy readable stream API\n// If the user uses them, then switch into old mode.\nReadable.prototype.resume = function() {\n  emitDataEvents(this);\n  this.read(0);\n  this.emit(\'resume\');\n};\n\nReadable.prototype.pause = function() {\n  emitDataEvents(this, true);\n  this.emit(\'pause\');\n};\n\nfunction emitDataEvents(stream, startPaused) {\n  var state = stream._readableState;\n\n  if (state.flowing) {\n    // https://github.com/isaacs/readable-stream/issues/16\n    throw new Error(\'Cannot switch to old mode now.\');\n  }\n\n  var paused = startPaused || false;\n  var readable = false;\n\n  // convert to an old-style stream.\n  stream.readable = true;\n  stream.pipe = Stream.prototype.pipe;\n  stream.on = stream.addListener = Stream.prototype.on;\n\n  stream.on(\'readable\', function() {\n    readable = true;\n\n    var c;\n    while (!paused && (null !== (c = stream.read())))\n      stream.emit(\'data\', c);\n\n    if (c === null) {\n      readable = false;\n      stream._readableState.needReadable = true;\n    }\n  });\n\n  stream.pause = function() {\n    paused = true;\n    this.emit(\'pause\');\n  };\n\n  stream.resume = function() {\n    paused = false;\n    if (readable)\n      setImmediate(function() {\n        stream.emit(\'readable\');\n      });\n    else\n      this.read(0);\n    this.emit(\'resume\');\n  };\n\n  // now make it start, just in case it hadn\'t already.\n  stream.emit(\'readable\');\n}\n\n// wrap an old-style stream as the async data source.\n// This is *not* part of the readable stream interface.\n// It is an ugly unfortunate mess of history.\nReadable.prototype.wrap = function(stream) {\n  var state = this._readableState;\n  var paused = false;\n\n  var self = this;\n  stream.on(\'end\', function() {\n    if (state.decoder && !state.ended) {\n      var chunk = state.decoder.end();\n      if (chunk && chunk.length)\n        self.push(chunk);\n    }\n\n    self.push(null);\n  });\n\n  stream.on(\'data\', function(chunk) {\n    if (state.decoder)\n      chunk = state.decoder.write(chunk);\n    if (!chunk || !state.objectMode && !chunk.length)\n      return;\n\n    var ret = self.push(chunk);\n    if (!ret) {\n      paused = true;\n      stream.pause();\n    }\n  });\n\n  // proxy all the other methods.\n  // important when wrapping filters and duplexes.\n  for (var i in stream) {\n    if (typeof stream[i] === \'function\' &&\n        typeof this[i] === \'undefined\') {\n      this[i] = function(method) { return function() {\n        return stream[method].apply(stream, arguments);\n      }}(i);\n    }\n  }\n\n  // proxy certain important events.\n  var events = [\'error\', \'close\', \'destroy\', \'pause\', \'resume\'];\n  forEach(events, function(ev) {\n    stream.on(ev, function (x) {\n      return self.emit.apply(self, ev, x);\n    });\n  });\n\n  // when we try to consume some more bytes, simply unpause the\n  // underlying stream.\n  self._read = function(n) {\n    if (paused) {\n      paused = false;\n      stream.resume();\n    }\n  };\n\n  return self;\n};\n\n\n\n// exposed for testing purposes only.\nReadable._fromList = fromList;\n\n// Pluck off n bytes from an array of buffers.\n// Length is the combined lengths of all the buffers in the list.\nfunction fromList(n, state) {\n  var list = state.buffer;\n  var length = state.length;\n  var stringMode = !!state.decoder;\n  var objectMode = !!state.objectMode;\n  var ret;\n\n  // nothing in the list, definitely empty.\n  if (list.length === 0)\n    return null;\n\n  if (length === 0)\n    ret = null;\n  else if (objectMode)\n    ret = list.shift();\n  else if (!n || n >= length) {\n    // read it all, truncate the array.\n    if (stringMode)\n      ret = list.join(\'\');\n    else\n      ret = Buffer.concat(list, length);\n    list.length = 0;\n  } else {\n    // read just some of it.\n    if (n < list[0].length) {\n      // just take a part of the first list item.\n      // slice is the same for buffers and strings.\n      var buf = list[0];\n      ret = buf.slice(0, n);\n      list[0] = buf.slice(n);\n    } else if (n === list[0].length) {\n      // first list is a perfect match\n      ret = list.shift();\n    } else {\n      // complex case.\n      // we have enough to cover it, but it spans past the first buffer.\n      if (stringMode)\n        ret = \'\';\n      else\n        ret = new Buffer(n);\n\n      var c = 0;\n      for (var i = 0, l = list.length; i < l && c < n; i++) {\n        var buf = list[0];\n        var cpy = Math.min(n - c, buf.length);\n\n        if (stringMode)\n          ret += buf.slice(0, cpy);\n        else\n          buf.copy(ret, c, 0, cpy);\n\n        if (cpy < buf.length)\n          list[0] = buf.slice(cpy);\n        else\n          list.shift();\n\n        c += cpy;\n      }\n    }\n  }\n\n  return ret;\n}\n\nfunction endReadable(stream) {\n  var state = stream._readableState;\n\n  // If we get here before consuming all the bytes, then that is a\n  // bug in node.  Should never happen.\n  if (state.length > 0)\n    throw new Error(\'endReadable called on non-empty stream\');\n\n  if (!state.endEmitted && state.calledRead) {\n    state.ended = true;\n    setImmediate(function() {\n      // Check that we didn\'t get one last unshift.\n      if (!state.endEmitted && state.length === 0) {\n        state.endEmitted = true;\n        stream.readable = false;\n        stream.emit(\'end\');\n      }\n    });\n  }\n}\n\nfunction forEach (xs, f) {\n  for (var i = 0, l = xs.length; i < l; i++) {\n    f(xs[i], i);\n  }\n}\n\nfunction indexOf (xs, x) {\n  for (var i = 0, l = xs.length; i < l; i++) {\n    if (xs[i] === x) return i;\n  }\n  return -1;\n}\n\n}).call(this,require("/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/workerify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))\n},{"./index.js":31,"/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/workerify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":29,"buffer":24,"events":27,"inherits":28,"process/browser.js":32,"string_decoder":37}],35:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n// a transform stream is a readable/writable stream where you do\n// something with the data.  Sometimes it\'s called a "filter",\n// but that\'s not a great name for it, since that implies a thing where\n// some bits pass through, and others are simply ignored.  (That would\n// be a valid example of a transform, of course.)\n//\n// While the output is causally related to the input, it\'s not a\n// necessarily symmetric or synchronous transformation.  For example,\n// a zlib stream might take multiple plain-text writes(), and then\n// emit a single compressed chunk some time in the future.\n//\n// Here\'s how this works:\n//\n// The Transform stream has all the aspects of the readable and writable\n// stream classes.  When you write(chunk), that calls _write(chunk,cb)\n// internally, and returns false if there\'s a lot of pending writes\n// buffered up.  When you call read(), that calls _read(n) until\n// there\'s enough pending readable data buffered up.\n//\n// In a transform stream, the written data is placed in a buffer.  When\n// _read(n) is called, it transforms the queued up data, calling the\n// buffered _write cb\'s as it consumes chunks.  If consuming a single\n// written chunk would result in multiple output chunks, then the first\n// outputted bit calls the readcb, and subsequent chunks just go into\n// the read buffer, and will cause it to emit \'readable\' if necessary.\n//\n// This way, back-pressure is actually determined by the reading side,\n// since _read has to be called to start processing a new chunk.  However,\n// a pathological inflate type of transform can cause excessive buffering\n// here.  For example, imagine a stream where every byte of input is\n// interpreted as an integer from 0-255, and then results in that many\n// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in\n// 1kb of data being output.  In this case, you could write a very small\n// amount of input, and end up with a very large amount of output.  In\n// such a pathological inflating mechanism, there\'d be no way to tell\n// the system to stop doing the transform.  A single 4MB write could\n// cause the system to run out of memory.\n//\n// However, even in such a pathological case, only a single written chunk\n// would be consumed, and then the rest would wait (un-transformed) until\n// the results of the previous transformed chunk were consumed.\n\nmodule.exports = Transform;\n\nvar Duplex = require(\'./duplex.js\');\nvar inherits = require(\'inherits\');\ninherits(Transform, Duplex);\n\n\nfunction TransformState(options, stream) {\n  this.afterTransform = function(er, data) {\n    return afterTransform(stream, er, data);\n  };\n\n  this.needTransform = false;\n  this.transforming = false;\n  this.writecb = null;\n  this.writechunk = null;\n}\n\nfunction afterTransform(stream, er, data) {\n  var ts = stream._transformState;\n  ts.transforming = false;\n\n  var cb = ts.writecb;\n\n  if (!cb)\n    return stream.emit(\'error\', new Error(\'no writecb in Transform class\'));\n\n  ts.writechunk = null;\n  ts.writecb = null;\n\n  if (data !== null && data !== undefined)\n    stream.push(data);\n\n  if (cb)\n    cb(er);\n\n  var rs = stream._readableState;\n  rs.reading = false;\n  if (rs.needReadable || rs.length < rs.highWaterMark) {\n    stream._read(rs.highWaterMark);\n  }\n}\n\n\nfunction Transform(options) {\n  if (!(this instanceof Transform))\n    return new Transform(options);\n\n  Duplex.call(this, options);\n\n  var ts = this._transformState = new TransformState(options, this);\n\n  // when the writable side finishes, then flush out anything remaining.\n  var stream = this;\n\n  // start out asking for a readable event once data is transformed.\n  this._readableState.needReadable = true;\n\n  // we have implemented the _read method, and done the other things\n  // that Readable wants before the first _read call, so unset the\n  // sync guard flag.\n  this._readableState.sync = false;\n\n  this.once(\'finish\', function() {\n    if (\'function\' === typeof this._flush)\n      this._flush(function(er) {\n        done(stream, er);\n      });\n    else\n      done(stream);\n  });\n}\n\nTransform.prototype.push = function(chunk, encoding) {\n  this._transformState.needTransform = false;\n  return Duplex.prototype.push.call(this, chunk, encoding);\n};\n\n// This is the part where you do stuff!\n// override this function in implementation classes.\n// \'chunk\' is an input chunk.\n//\n// Call `push(newChunk)` to pass along transformed output\n// to the readable side.  You may call \'push\' zero or more times.\n//\n// Call `cb(err)` when you are done with this chunk.  If you pass\n// an error, then that\'ll put the hurt on the whole operation.  If you\n// never call cb(), then you\'ll never get another chunk.\nTransform.prototype._transform = function(chunk, encoding, cb) {\n  throw new Error(\'not implemented\');\n};\n\nTransform.prototype._write = function(chunk, encoding, cb) {\n  var ts = this._transformState;\n  ts.writecb = cb;\n  ts.writechunk = chunk;\n  ts.writeencoding = encoding;\n  if (!ts.transforming) {\n    var rs = this._readableState;\n    if (ts.needTransform ||\n        rs.needReadable ||\n        rs.length < rs.highWaterMark)\n      this._read(rs.highWaterMark);\n  }\n};\n\n// Doesn\'t matter what the args are here.\n// _transform does all the work.\n// That we got here means that the readable side wants more data.\nTransform.prototype._read = function(n) {\n  var ts = this._transformState;\n\n  if (ts.writechunk && ts.writecb && !ts.transforming) {\n    ts.transforming = true;\n    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);\n  } else {\n    // mark that we need a transform, so that any data that comes in\n    // will get processed, now that we\'ve asked for it.\n    ts.needTransform = true;\n  }\n};\n\n\nfunction done(stream, er) {\n  if (er)\n    return stream.emit(\'error\', er);\n\n  // if there\'s nothing in the write buffer, then that means\n  // that nothing more will ever be provided\n  var ws = stream._writableState;\n  var rs = stream._readableState;\n  var ts = stream._transformState;\n\n  if (ws.length)\n    throw new Error(\'calling transform done when ws.length != 0\');\n\n  if (ts.transforming)\n    throw new Error(\'calling transform done when still transforming\');\n\n  return stream.push(null);\n}\n\n},{"./duplex.js":30,"inherits":28}],36:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\n// A bit simpler than readable streams.\n// Implement an async ._write(chunk, cb), and it\'ll handle all\n// the drain event emission and buffering.\n\nmodule.exports = Writable;\nWritable.WritableState = WritableState;\n\nvar isUint8Array = typeof Uint8Array !== \'undefined\'\n  ? function (x) { return x instanceof Uint8Array }\n  : function (x) {\n    return x && x.constructor && x.constructor.name === \'Uint8Array\'\n  }\n;\nvar isArrayBuffer = typeof ArrayBuffer !== \'undefined\'\n  ? function (x) { return x instanceof ArrayBuffer }\n  : function (x) {\n    return x && x.constructor && x.constructor.name === \'ArrayBuffer\'\n  }\n;\n\nvar inherits = require(\'inherits\');\nvar Stream = require(\'./index.js\');\nvar setImmediate = require(\'process/browser.js\').nextTick;\nvar Buffer = require(\'buffer\').Buffer;\n\ninherits(Writable, Stream);\n\nfunction WriteReq(chunk, encoding, cb) {\n  this.chunk = chunk;\n  this.encoding = encoding;\n  this.callback = cb;\n}\n\nfunction WritableState(options, stream) {\n  options = options || {};\n\n  // the point at which write() starts returning false\n  // Note: 0 is a valid value, means that we always return false if\n  // the entire buffer is not flushed immediately on write()\n  var hwm = options.highWaterMark;\n  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;\n\n  // object stream flag to indicate whether or not this stream\n  // contains buffers or objects.\n  this.objectMode = !!options.objectMode;\n\n  // cast to ints.\n  this.highWaterMark = ~~this.highWaterMark;\n\n  this.needDrain = false;\n  // at the start of calling end()\n  this.ending = false;\n  // when end() has been called, and returned\n  this.ended = false;\n  // when \'finish\' is emitted\n  this.finished = false;\n\n  // should we decode strings into buffers before passing to _write?\n  // this is here so that some node-core streams can optimize string\n  // handling at a lower level.\n  var noDecode = options.decodeStrings === false;\n  this.decodeStrings = !noDecode;\n\n  // Crypto is kind of old and crusty.  Historically, its default string\n  // encoding is \'binary\' so we have to make this configurable.\n  // Everything else in the universe uses \'utf8\', though.\n  this.defaultEncoding = options.defaultEncoding || \'utf8\';\n\n  // not an actual buffer we keep track of, but a measurement\n  // of how much we\'re waiting to get pushed to some underlying\n  // socket or file.\n  this.length = 0;\n\n  // a flag to see when we\'re in the middle of a write.\n  this.writing = false;\n\n  // a flag to be able to tell if the onwrite cb is called immediately,\n  // or on a later tick.  We set this to true at first, becuase any\n  // actions that shouldn\'t happen until "later" should generally also\n  // not happen before the first write call.\n  this.sync = true;\n\n  // a flag to know if we\'re processing previously buffered items, which\n  // may call the _write() callback in the same tick, so that we don\'t\n  // end up in an overlapped onwrite situation.\n  this.bufferProcessing = false;\n\n  // the callback that\'s passed to _write(chunk,cb)\n  this.onwrite = function(er) {\n    onwrite(stream, er);\n  };\n\n  // the callback that the user supplies to write(chunk,encoding,cb)\n  this.writecb = null;\n\n  // the amount that is being written when _write is called.\n  this.writelen = 0;\n\n  this.buffer = [];\n}\n\nfunction Writable(options) {\n  // Writable ctor is applied to Duplexes, though they\'re not\n  // instanceof Writable, they\'re instanceof Readable.\n  if (!(this instanceof Writable) && !(this instanceof Stream.Duplex))\n    return new Writable(options);\n\n  this._writableState = new WritableState(options, this);\n\n  // legacy.\n  this.writable = true;\n\n  Stream.call(this);\n}\n\n// Otherwise people can pipe Writable streams, which is just wrong.\nWritable.prototype.pipe = function() {\n  this.emit(\'error\', new Error(\'Cannot pipe. Not readable.\'));\n};\n\n\nfunction writeAfterEnd(stream, state, cb) {\n  var er = new Error(\'write after end\');\n  // TODO: defer error events consistently everywhere, not just the cb\n  stream.emit(\'error\', er);\n  setImmediate(function() {\n    cb(er);\n  });\n}\n\n// If we get something that is not a buffer, string, null, or undefined,\n// and we\'re not in objectMode, then that\'s an error.\n// Otherwise stream chunks are all considered to be of length=1, and the\n// watermarks determine how many objects to keep in the buffer, rather than\n// how many bytes or characters.\nfunction validChunk(stream, state, chunk, cb) {\n  var valid = true;\n  if (!Buffer.isBuffer(chunk) &&\n      \'string\' !== typeof chunk &&\n      chunk !== null &&\n      chunk !== undefined &&\n      !state.objectMode) {\n    var er = new TypeError(\'Invalid non-string/buffer chunk\');\n    stream.emit(\'error\', er);\n    setImmediate(function() {\n      cb(er);\n    });\n    valid = false;\n  }\n  return valid;\n}\n\nWritable.prototype.write = function(chunk, encoding, cb) {\n  var state = this._writableState;\n  var ret = false;\n\n  if (typeof encoding === \'function\') {\n    cb = encoding;\n    encoding = null;\n  }\n\n  if (!Buffer.isBuffer(chunk) && isUint8Array(chunk))\n    chunk = new Buffer(chunk);\n  if (isArrayBuffer(chunk) && typeof Uint8Array !== \'undefined\')\n    chunk = new Buffer(new Uint8Array(chunk));\n  \n  if (Buffer.isBuffer(chunk))\n    encoding = \'buffer\';\n  else if (!encoding)\n    encoding = state.defaultEncoding;\n\n  if (typeof cb !== \'function\')\n    cb = function() {};\n\n  if (state.ended)\n    writeAfterEnd(this, state, cb);\n  else if (validChunk(this, state, chunk, cb))\n    ret = writeOrBuffer(this, state, chunk, encoding, cb);\n\n  return ret;\n};\n\nfunction decodeChunk(state, chunk, encoding) {\n  if (!state.objectMode &&\n      state.decodeStrings !== false &&\n      typeof chunk === \'string\') {\n    chunk = new Buffer(chunk, encoding);\n  }\n  return chunk;\n}\n\n// if we\'re already writing something, then just put this\n// in the queue, and wait our turn.  Otherwise, call _write\n// If we return false, then we need a drain event, so set that flag.\nfunction writeOrBuffer(stream, state, chunk, encoding, cb) {\n  chunk = decodeChunk(state, chunk, encoding);\n  var len = state.objectMode ? 1 : chunk.length;\n\n  state.length += len;\n\n  var ret = state.length < state.highWaterMark;\n  state.needDrain = !ret;\n\n  if (state.writing)\n    state.buffer.push(new WriteReq(chunk, encoding, cb));\n  else\n    doWrite(stream, state, len, chunk, encoding, cb);\n\n  return ret;\n}\n\nfunction doWrite(stream, state, len, chunk, encoding, cb) {\n  state.writelen = len;\n  state.writecb = cb;\n  state.writing = true;\n  state.sync = true;\n  stream._write(chunk, encoding, state.onwrite);\n  state.sync = false;\n}\n\nfunction onwriteError(stream, state, sync, er, cb) {\n  if (sync)\n    setImmediate(function() {\n      cb(er);\n    });\n  else\n    cb(er);\n\n  stream.emit(\'error\', er);\n}\n\nfunction onwriteStateUpdate(state) {\n  state.writing = false;\n  state.writecb = null;\n  state.length -= state.writelen;\n  state.writelen = 0;\n}\n\nfunction onwrite(stream, er) {\n  var state = stream._writableState;\n  var sync = state.sync;\n  var cb = state.writecb;\n\n  onwriteStateUpdate(state);\n\n  if (er)\n    onwriteError(stream, state, sync, er, cb);\n  else {\n    // Check if we\'re actually ready to finish, but don\'t emit yet\n    var finished = needFinish(stream, state);\n\n    if (!finished && !state.bufferProcessing && state.buffer.length)\n      clearBuffer(stream, state);\n\n    if (sync) {\n      setImmediate(function() {\n        afterWrite(stream, state, finished, cb);\n      });\n    } else {\n      afterWrite(stream, state, finished, cb);\n    }\n  }\n}\n\nfunction afterWrite(stream, state, finished, cb) {\n  if (!finished)\n    onwriteDrain(stream, state);\n  cb();\n  if (finished)\n    finishMaybe(stream, state);\n}\n\n// Must force callback to be called on nextTick, so that we don\'t\n// emit \'drain\' before the write() consumer gets the \'false\' return\n// value, and has a chance to attach a \'drain\' listener.\nfunction onwriteDrain(stream, state) {\n  if (state.length === 0 && state.needDrain) {\n    state.needDrain = false;\n    stream.emit(\'drain\');\n  }\n}\n\n\n// if there\'s something in the buffer waiting, then process it\nfunction clearBuffer(stream, state) {\n  state.bufferProcessing = true;\n\n  for (var c = 0; c < state.buffer.length; c++) {\n    var entry = state.buffer[c];\n    var chunk = entry.chunk;\n    var encoding = entry.encoding;\n    var cb = entry.callback;\n    var len = state.objectMode ? 1 : chunk.length;\n\n    doWrite(stream, state, len, chunk, encoding, cb);\n\n    // if we didn\'t call the onwrite immediately, then\n    // it means that we need to wait until it does.\n    // also, that means that the chunk and cb are currently\n    // being processed, so move the buffer counter past them.\n    if (state.writing) {\n      c++;\n      break;\n    }\n  }\n\n  state.bufferProcessing = false;\n  if (c < state.buffer.length)\n    state.buffer = state.buffer.slice(c);\n  else\n    state.buffer.length = 0;\n}\n\nWritable.prototype._write = function(chunk, encoding, cb) {\n  cb(new Error(\'not implemented\'));\n};\n\nWritable.prototype.end = function(chunk, encoding, cb) {\n  var state = this._writableState;\n\n  if (typeof chunk === \'function\') {\n    cb = chunk;\n    chunk = null;\n    encoding = null;\n  } else if (typeof encoding === \'function\') {\n    cb = encoding;\n    encoding = null;\n  }\n\n  if (typeof chunk !== \'undefined\' && chunk !== null)\n    this.write(chunk, encoding);\n\n  // ignore unnecessary end() calls.\n  if (!state.ending && !state.finished)\n    endWritable(this, state, cb);\n};\n\n\nfunction needFinish(stream, state) {\n  return (state.ending &&\n          state.length === 0 &&\n          !state.finished &&\n          !state.writing);\n}\n\nfunction finishMaybe(stream, state) {\n  var need = needFinish(stream, state);\n  if (need) {\n    state.finished = true;\n    stream.emit(\'finish\');\n  }\n  return need;\n}\n\nfunction endWritable(stream, state, cb) {\n  state.ending = true;\n  finishMaybe(stream, state);\n  if (cb) {\n    if (state.finished)\n      setImmediate(cb);\n    else\n      stream.once(\'finish\', cb);\n  }\n  state.ended = true;\n}\n\n},{"./index.js":31,"buffer":24,"inherits":28,"process/browser.js":32}],37:[function(require,module,exports){\n// Copyright Joyent, Inc. and other Node contributors.\n//\n// Permission is hereby granted, free of charge, to any person obtaining a\n// copy of this software and associated documentation files (the\n// "Software"), to deal in the Software without restriction, including\n// without limitation the rights to use, copy, modify, merge, publish,\n// distribute, sublicense, and/or sell copies of the Software, and to permit\n// persons to whom the Software is furnished to do so, subject to the\n// following conditions:\n//\n// The above copyright notice and this permission notice shall be included\n// in all copies or substantial portions of the Software.\n//\n// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS\n// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN\n// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,\n// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR\n// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE\n// USE OR OTHER DEALINGS IN THE SOFTWARE.\n\nvar Buffer = require(\'buffer\').Buffer;\n\nfunction assertEncoding(encoding) {\n  if (encoding && !Buffer.isEncoding(encoding)) {\n    throw new Error(\'Unknown encoding: \' + encoding);\n  }\n}\n\nvar StringDecoder = exports.StringDecoder = function(encoding) {\n  this.encoding = (encoding || \'utf8\').toLowerCase().replace(/[-_]/, \'\');\n  assertEncoding(encoding);\n  switch (this.encoding) {\n    case \'utf8\':\n      // CESU-8 represents each of Surrogate Pair by 3-bytes\n      this.surrogateSize = 3;\n      break;\n    case \'ucs2\':\n    case \'utf16le\':\n      // UTF-16 represents each of Surrogate Pair by 2-bytes\n      this.surrogateSize = 2;\n      this.detectIncompleteChar = utf16DetectIncompleteChar;\n      break;\n    case \'base64\':\n      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.\n      this.surrogateSize = 3;\n      this.detectIncompleteChar = base64DetectIncompleteChar;\n      break;\n    default:\n      this.write = passThroughWrite;\n      return;\n  }\n\n  this.charBuffer = new Buffer(6);\n  this.charReceived = 0;\n  this.charLength = 0;\n};\n\n\nStringDecoder.prototype.write = function(buffer) {\n  var charStr = \'\';\n  var offset = 0;\n\n  // if our last write ended with an incomplete multibyte character\n  while (this.charLength) {\n    // determine how many remaining bytes this buffer has to offer for this char\n    var i = (buffer.length >= this.charLength - this.charReceived) ?\n                this.charLength - this.charReceived :\n                buffer.length;\n\n    // add the new bytes to the char buffer\n    buffer.copy(this.charBuffer, this.charReceived, offset, i);\n    this.charReceived += (i - offset);\n    offset = i;\n\n    if (this.charReceived < this.charLength) {\n      // still not enough chars in this buffer? wait for more ...\n      return \'\';\n    }\n\n    // get the character that was split\n    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);\n\n    // lead surrogate (D800-DBFF) is also the incomplete character\n    var charCode = charStr.charCodeAt(charStr.length - 1);\n    if (charCode >= 0xD800 && charCode <= 0xDBFF) {\n      this.charLength += this.surrogateSize;\n      charStr = \'\';\n      continue;\n    }\n    this.charReceived = this.charLength = 0;\n\n    // if there are no more bytes in this buffer, just emit our char\n    if (i == buffer.length) return charStr;\n\n    // otherwise cut off the characters end from the beginning of this buffer\n    buffer = buffer.slice(i, buffer.length);\n    break;\n  }\n\n  var lenIncomplete = this.detectIncompleteChar(buffer);\n\n  var end = buffer.length;\n  if (this.charLength) {\n    // buffer the incomplete character bytes we got\n    buffer.copy(this.charBuffer, 0, buffer.length - lenIncomplete, end);\n    this.charReceived = lenIncomplete;\n    end -= lenIncomplete;\n  }\n\n  charStr += buffer.toString(this.encoding, 0, end);\n\n  var end = charStr.length - 1;\n  var charCode = charStr.charCodeAt(end);\n  // lead surrogate (D800-DBFF) is also the incomplete character\n  if (charCode >= 0xD800 && charCode <= 0xDBFF) {\n    var size = this.surrogateSize;\n    this.charLength += size;\n    this.charReceived += size;\n    this.charBuffer.copy(this.charBuffer, size, 0, size);\n    this.charBuffer.write(charStr.charAt(charStr.length - 1), this.encoding);\n    return charStr.substring(0, end);\n  }\n\n  // or just emit the charStr\n  return charStr;\n};\n\nStringDecoder.prototype.detectIncompleteChar = function(buffer) {\n  // determine how many bytes we have to check at the end of this buffer\n  var i = (buffer.length >= 3) ? 3 : buffer.length;\n\n  // Figure out if one of the last i bytes of our buffer announces an\n  // incomplete char.\n  for (; i > 0; i--) {\n    var c = buffer[buffer.length - i];\n\n    // See http://en.wikipedia.org/wiki/UTF-8#Description\n\n    // 110XXXXX\n    if (i == 1 && c >> 5 == 0x06) {\n      this.charLength = 2;\n      break;\n    }\n\n    // 1110XXXX\n    if (i <= 2 && c >> 4 == 0x0E) {\n      this.charLength = 3;\n      break;\n    }\n\n    // 11110XXX\n    if (i <= 3 && c >> 3 == 0x1E) {\n      this.charLength = 4;\n      break;\n    }\n  }\n\n  return i;\n};\n\nStringDecoder.prototype.end = function(buffer) {\n  var res = \'\';\n  if (buffer && buffer.length)\n    res = this.write(buffer);\n\n  if (this.charReceived) {\n    var cr = this.charReceived;\n    var buf = this.charBuffer;\n    var enc = this.encoding;\n    res += buf.slice(0, cr).toString(enc);\n  }\n\n  return res;\n};\n\nfunction passThroughWrite(buffer) {\n  return buffer.toString(this.encoding);\n}\n\nfunction utf16DetectIncompleteChar(buffer) {\n  var incomplete = this.charReceived = buffer.length % 2;\n  this.charLength = incomplete ? 2 : 0;\n  return incomplete;\n}\n\nfunction base64DetectIncompleteChar(buffer) {\n  var incomplete = this.charReceived = buffer.length % 3;\n  this.charLength = incomplete ? 3 : 0;\n  return incomplete;\n}\n\n},{"buffer":24}]},{},[1])'],{type:"text/javascript"})));
		worker.onmessage = function( event ) {
		  if("data" in event.data)
		  {
		    var data = event.data.data;
		    console.log("data recieved in main thread", data);
        onDataLoaded( data );
        deferred.resolve( rootObject );
      }
      else if("progress" in event.data)
      {
        console.log("got progress", event.data.progress);
        deferred.notify( {"parsing":event.data.progress} )
      }
		}
		console.log("sending data to worker");
		worker.postMessage( {data:data});
		Q.catch( deferred.promise, function(){
		  worker.terminate()
		});
	
	}
	else
	{
	  var amf = new AMF();
    amf.load( data, onDataLoaded );
  }
  return deferred;
}

AMFParser.prototype.recurse = function(node, newParent, callback)
{
  if(node.children)
  {
    var newModel = callback(node);
    newParent.add( newModel);
    
    for(var i=0;i<node.children.length;i++)
    {
      var child = node.children[i];
        this.recurse( child, newModel, callback );
      }
    }
    return newModel;
  }

AMFParser.prototype.createModelBuffers = function ( modelData ) {
  console.log("creating model buffers",modelData);
  
  var faces = modelData.faceCount;
  var colorSize =3;
  
  var vertices = new Float32Array( faces * 3 * 3 );
	var normals = new Float32Array( faces * 3 * 3 );
	var colors = new Float32Array( faces *3 * colorSize );
	var indices = new Uint32Array( faces * 3  );
	
	vertices.set( modelData._attributes.position );
	normals.set( modelData._attributes.normal );
	indices.set( modelData._attributes.indices );
	colors.set( modelData._attributes.vcolors );

  var geometry = new THREE.BufferGeometry();
	geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	//geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
  geometry.addAttribute( 'index', new THREE.BufferAttribute( indices, 1 ) );
  geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, colorSize ) );
  
  if(this.recomputeNormals)
  {
    //TODO: only do this, if no normals were specified???
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
  }
  
  var vs = require('./vertShader.vert')();
  var fs = require('./fragShader.frag')();
  
  var material = new THREE.RawShaderMaterial( {

					uniforms: {
						time: { type: "f", value: 1.0 }
					},
					vertexShader: vs,
					fragmentShader: fs,
					side: THREE.DoubleSide,
					transparent: true

				} );

  var color = this.defaultColor ;
  var material = new this.defaultMaterialType({color:0XFFFFFF,vertexColors: THREE.VertexColors});
  var mesh = new THREE.Mesh( geometry, material );
  return mesh
}


AMFParser.prototype._generateObject = function( object )
{
    if(this.recomputeNormals)
	  {
		  //TODO: only do this, if no normals were specified???
		  object.geometry.computeFaceNormals();
		  object.geometry.computeVertexNormals();
	  }
	  object.geometry.computeBoundingBox();
	  object.geometry.computeBoundingSphere();

    var color = this.defaultColor ;
	  var meshMaterial = new this.defaultMaterialType(
	  { 
      color: color,
		  //vertexColors: THREE.VertexColors, //TODO: add flags to dertermine if we need vertex or face colors
      vertexColors: THREE.FaceColors,
      specular: this.defaultSpecular,
      shininess: this.defaultShininess,
		  shading: this.defaultShading
	  } );

    object.material = meshMaterial;
    //console.log("finished Object / THREE.Mesh",currentObject)
}


AMFParser.prototype._applyMaterials = function(materials, textures, meshes, facesThatNeedMaterial)
{//since materials are usually defined after objects/ volumes, we need to apply
  //materials to those that need them
  for(var i = 0 ; i<facesThatNeedMaterial.length; i++)
  {
      var curFace = facesThatNeedMaterial[i];
      var mat = materials[curFace.matId];
      curFace.item.color = mat.color;
      curFace.item.vertexColors = [];
      //console.log("curFace",curFace.item);
  }

  /*
  if(Object.keys(this.textures).length>0)
	{
		var materialArray = [];
		for (var textureIndex in textures)
		{
			var texture = this.textures[textureIndex];
			materialArray.push(new THREE.MeshBasicMaterial({
				map: texture,
				color: color,
				vertexColors: THREE.VertexColors
				}));
    }
    currentMaterial = new THREE.MeshFaceMaterial(materialArray);
  }*/
}





if (detectEnv.isModule) module.exports = AMFParser;

},{"./amf.js":3,"./fragShader.frag":4,"./vertShader.vert":20,"composite-detect":false,"jszip":false,"sax":19,"three":false}],"amf-parser":[function(require,module,exports){
module.exports=require('wB/k3U');
},{}],3:[function(require,module,exports){
(function (Buffer){
var detectEnv = require("composite-detect");
if(detectEnv.isModule) var JSZip = require( 'jszip' );
if(detectEnv.isModule) var sax = require( 'sax' );

var AMF = function () {

  this.unit = null;
  this.version = null;

  //various data 
  var unit = null;
  var version = null;

  this.rootObject = {};
  this.rootObject.children = [];
  this.currentObject = {};
  
  this.materialsById = {};
  
  this.meshes = [];
  this.objects = [];
  this.textures = [];
  this.materials = [];
  this.constellations = [];
  this.resultContainer = {};
}

AMF.prototype.load = function( data, callback, progressCallback ){
  
  var self = this;
  function foo( data )
  {
    console.log("done unpacking data");
    if(progressCallback)
    {
      progressCallback({progress:25});
    }
    
    var parser = sax.parser(true,{trim:true}); // set first param to false for html-mode
    self.setupSax( parser );
    console.log("sax parser setup ok");
    
    var l = data.length, lc = 0, c = 0, chunkSize = l;
    var chunk = "" 
  
  parser.onready= function (tag) {
    if( lc<l)
    {
      chunk = data.slice(lc, lc += chunkSize);
      parser.write( chunk ).close();
    }
    else
    {
      if(callback)
      {
        self.resultContainer.meshes = self.meshes;
        self.resultContainer.objects = self.objects;
        self.resultContainer.textures = self.textures;
        self.resultContainer.materials = self.materials;
        self.resultContainer.constellations = self.constellations;
        
        if(progressCallback)
        {
          progressCallback({progress:75});
        }
        
        var colorSize = 3;
        
        for(var z=0;z<self.objects.length;z++)
        {
          var obj = self.objects[z];
          /*          
          var total = obj._attributes["indices"].length;
          var subLng = obj.volumes[0]._attributes["indices"].length;
          var start = total- subLng;
          //var remains = obj._attributes["indices"].splice(start + 1);
          //obj._attributes["indices"] = remains;
          console.log("removing from " + start + " length "+ subLng+" res "+obj._attributes["indices"].length);*/
          var tmpPositions = [];
          var tmpIndices= [];
          var finalPositions = [];
          //obj._attributes["posi"] = [];
          
          if(obj._attributes["vcolors"].length==0)
          {
            for(var c = 0;c<obj._attributes["position"].length;c+=3)
            {
              for(var i=0;i<colorSize;i++)
              {
                obj._attributes["vcolors"].push( i );
              }
            }
          }
          var colIndex=0;
          for(var x=0;x<obj.volumes.length;x++)
          {
            var vol = obj.volumes[x];
            console.log("volume " + x);
            
            for(var c = 0;c<vol._attributes["indices"].length;c++)
            {
              var iIndex = vol._attributes["indices"][c];
              var index = (iIndex*3);
              
              tmpPositions.push( );
              /*vol._attributes["position"].push( obj._attributes["position"][index] );
              vol._attributes["position"].push( obj._attributes["position"][index+1] );
              vol._attributes["position"].push( obj._attributes["position"][index+2] );*/
              
              /*tmpPositions.push( obj._attributes["position"][index] );
              tmpPositions.push( obj._attributes["position"][index+1] );
              tmpPositions.push( obj._attributes["position"][index+2] );*/
            }
                      
            
            //get vertex index, apply color//update existing color
            if(vol.materialId)
            {
              var material = self.materialsById[vol.materialId];
              if(material.color)
              {
                 var color = material.color;
                 if(x == 1) color = [1,0,0,1];
                 
                 for(var c = 0;c<vol._attributes["indices"].length;c++)
                  {
                    var iIndex=vol._attributes["indices"][c];
                    index = (iIndex*colorSize);
                    if(index<0) index=0;
                    obj._attributes["vcolors"][index] = color[0];
                    obj._attributes["vcolors"][index+1] = color[1];
                    obj._attributes["vcolors"][index+2] = color[2];
                    //obj._attributes["vcolors"][index+3] = color[3];
                  }
              }
            }
          }
          //self.generateObject();
          //obj._attributes["position"] = tmpPositions;
          //obj._attributes["position"] = finalPositions;
          //obj._attributes["indices"] = tmpIndices;
        }
        
        
        console.log("DONE PARSING, result:",self.resultContainer); 
        callback( self.resultContainer );
      }
    }
  }
  chunk = data.slice(lc, lc += chunkSize);
  parser.write( chunk ).close();
  }
  console.log("before unpack");
  var data = this.unpack(data, foo);
}

AMF.prototype.unpack = function( data, callback )
{
  try
  {
    var zip = new JSZip(data);
    for(var entryName in zip.files)
    {
      var entry = zip.files[entryName];
      if( entry._data !== null && entry !== undefined) 
      {
        var ab = entry.asArrayBuffer();
        var blob = new Blob([ab]);
        var reader = new FileReader();
        reader.onload = function(e) {
            var txt = e.target.result;
            callback( txt );
        };
        reader.readAsText(blob);
      }
    }
  }
  catch(error){
    callback( this.ensureString(data) );
  }
}

AMF.prototype.ensureString = function (buf) {

	if (typeof buf !== "string"){
		var array_buffer = new Uint8Array(buf);
		var str = '';
		for(var i = 0; i < buf.byteLength; i++) {
			str += String.fromCharCode(array_buffer[i]); // implicitly assumes little-endian
		}
		return str;
	} else {
		return buf;
	}
};


AMF.prototype._generateObject = function( object )
{
    if(this.recomputeNormals)
	  {
		  //TODO: only do this, if no normals were specified???
		  object.geometry.computeFaceNormals();
		  object.geometry.computeVertexNormals();
	  }
	  //object.geometry.computeBoundingBox();
	  //object.geometry.computeBoundingSphere();

    var color = this.defaultColor ;
	  /*var meshMaterial = new this.defaultMaterialType(
	  { 
      color: color,
		  //vertexColors: THREE.VertexColors, //TODO: add flags to dertermine if we need vertex or face colors
      //vertexColors: THREE.FaceColors,
      specular: this.defaultSpecular,
      shininess: this.defaultShininess,
		  shading: this.defaultShading
	  } );

    object.material = meshMaterial;*/
    //console.log("finished Object / THREE.Mesh",currentObject)
}

AMF.prototype.setupSax = function( parser )
{

  var currentTag = null;
  var currentItem = null;//pointer to currently active item/tag etc

  var currentColor = null;
  //
  var currentMaterial = null;
  //
  var currentObject   = null;
  var currentGeometry = null;
  var currentVolume   = null;
  var currentTriangle = null;
  var currentVertex   = null;
  var currentEdge = null;

  var currentTexMap = null;
  var currentTexture = null;

  //logical grouping
  var currentConstellation = null;
  var currentObjectInstance = null;

//TODO: oh ye gad's need to find a cleaner solution
  var facesThatNeedMaterial = [];

  //copy settings to local scope
  var defaultColor = this.defaultColor;
	var defaultVertexNormal = this.defaultVertexNormal;
	var recomputeNormals = this.recomputeNormals;

   //storage / temporary storage
  //map amf object ids to our UUIDS
  var objectsIdMap = {};
  var objects = [];

  var meshes = {};
  var textures = {};
  var materials = {};

  var scope = this;  
  var rootObject = this.rootObject;
  
  parser.onopentag = function (tag) {
    // opened a tag.  node has "name" and "attributes"
    tag.parent = currentTag;
    currentTag = tag;
    if(tag.parent) tag.parent[tag.name] = tag;
  
    switch(tag.name)
    {
      //general
      case 'metadata':
        currentMeta = {};
      break;
      case 'amf':
        scope.unit = tag.attributes['unit'];
        scope.version = tag.attributes['version'];
        currentItem = rootObject;
      break;

      //geometry
      case 'object':
        currentObject = {}//new THREE.Mesh();
        var id = tag.attributes["id"] || null;
        if(id) currentObject._id = id; objectsIdMap[id] = currentObject.uuid;
        //temp storage:
        currentObject._attributes =  {};
        currentObject._attributes["position"] = [];
        currentObject._attributes["normal"] = [];
        currentObject._attributes["color"] = [];
        currentObject._attributes["indices"] = [];
        currentObject._attributes["vcolors"] = [];
        currentObject.volumes = [];
        currentObject.faceCount = 0;

        currentItem = currentObject;
      break;
      case 'volume':
        currentVolume = {};
        currentVolume._attributes =  {};
        currentVolume._attributes["position"] = [];
        currentVolume._attributes["indices"] = [];
        currentVolume._attributes["normal"] = [];
        currentVolume._attributes["color"] = [];
        currentVolume._attributes["indices"] = [];
        currentVolume._attributes["vcolors"] = [];
        currentVolume.faceCount = 0;
        
        
        var materialId = tag.attributes["materialid"] || null;
        if(materialId) currentVolume.materialId = parseInt(materialId);
        currentItem = currentVolume;
      break;
      case 'triangle':
        currentTriangle = {}
        currentObject.faceCount +=1 ;
      break;
      case 'edge':
        currentEdge = {};
      break;
      //materials and textures
      case 'material':
        currentMaterial = {};
        var id = tag.attributes["id"] || null;
        if(id) currentMaterial.id = parseInt(id);

        currentItem = currentMaterial;
      break;
      case 'texture':
        currentTexture = {};
        for( attrName in tag.attributes)
        {
          currentTexture[attrName] = tag.attributes[attrName];
        }
        currentItem = currentTexture;
      break;

      //constellation data
      case 'constellation':
        currentConstellation = {};
        currentConstellation.children=[];
        var id = tag.attributes["id"] || null;
        if(id) currentConstellation._id = id;
      break;
      case 'instance':
        currentObjectInstance = {};
        var id = tag.attributes["objectid"] || null;
        if(id) currentObjectInstance.id = id;
      break;
    }
  };
  parser.onclosetag = function (tag) {
    switch(currentTag.name)
    {
      case "metadata":
        if( currentItem )
        {
          var varName = currentTag.attributes["type"].toLowerCase();
          currentItem[varName]= currentTag.value;
          console.log("currentItem", currentTag, varName);
        }
        currentMeta = null;
      break;

      case "object":
        scope._generateObject( currentObject );
        meshes[currentObject._id] = currentObject;
        scope.objects.push( currentObject );
        scope.meshes.push( currentObject );
        console.log("object done");
        currentObject = null;
      break;

      case "volume"://per volume data (one volume == one three.js mesh)
        currentObject.volumes.push( currentVolume );
        currentVolume = null;
      break;
      
      case "coordinates":
        var vertexCoords = parseVector3(currentTag);
        currentObject._attributes["position"].push( vertexCoords[0],vertexCoords[1],vertexCoords[2] );
      break;

      case "normal":
        var vertexNormal = parseVector3(currentTag,"n", 1.0);
        currentObject._attributes["normal"].push( vertexNormal[0],vertexNormal[1],vertexNormal[2] );
      break;

      case "color":
      //WARNING !! color can be used not only inside objects but also materials etc
       //order(descending): triangle, vertex, volume, object, material
        var color = parseColor(currentTag);

        if(currentObject && (!currentTriangle))  currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] );//vertex level
        //if(currentObject) currentObject["color"]=  color; //object level
        if(currentVolume) currentVolume["color"] = color;
        if(currentTriangle) currentTriangle["color"] = color;
        if(currentMaterial) currentMaterial["color"] = color;
      break;

       case "map":
        for( attrName in currentTag.attributes)
        {
          currentTag[attrName] = currentTag.attributes[attrName];
        }
        var map = parseMapCoords( currentTag );
        //console.log("closing map", currentTag);
      break;

      case "triangle":
        var v1 = parseText( currentTag.v1.value ,"int" , 0);
        var v2 = parseText( currentTag.v2.value ,"int" , 0);
        var v3 = parseText( currentTag.v3.value ,"int" , 0);
        currentObject._attributes["indices"].push( v1, v2, v3 );
        currentVolume._attributes["indices"].push( v1, v2, v3 );

        var colorData = currentObject._attributes["color"];
        if(colorData.length>0)
        {
          var colors = [colorData[v1] ,colorData[v2], colorData[v3]];
        }
        else
        {
          var colors = [defaultColor,defaultColor, defaultColor];
        }
        var normalData = currentObject._attributes["normal"];
        if(normalData.length>0)
        {
          var normals = [normalData[v1],normalData[v2],normalData[v3]];
        }
        else
        {
          var normals = [defaultVertexNormal,defaultVertexNormal, defaultVertexNormal];
        }
        //a, b, c, normal, color, materialIndex
        /*var face = new THREE.Face3( v1, v2, v3 , normals);
        //triangle, vertex, volume, object, material
        //set default
        face.color = defaultColor; 
        if( 'materialId' in currentVolume) facesThatNeedMaterial.push({"matId":currentVolume.materialId,"item": face})
        if('color' in currentObject) face.color = currentObject["color"];  
        if('color' in currentVolume) face.color = currentVolume["color"];  
        if('color' in currentTriangle) face.color = currentTriangle["color"] ;
        
        currentTriangle = null;
        //FIXME:
        //currentObject.geometry.faces.push(face);
        */
        var color = [0,0,0,1];
        if('color' in currentTriangle) {
        color = currentTriangle["color"];
                currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] );
        }

        
      break;

      case "edge":
        console.log("getting edge data");
        //Specifies the 3D tangent of an object edge between two vertices 
        //higher priority than normals data
        var v1 = parseText( currentTag.v1.value , "v", "int" , null);
        var v2 = parseText( currentTag.v2.value , "v", "int" , null);

        var dx1 = parseText( currentTag.dx1.value , "d", "int" , 0);
        var dy1 = parseText( currentTag.dy1.value , "d", "int" , 0);
        var dz1 = parseText( currentTag.dz1.value , "d", "int" , 0);

        var dx2 = parseText( currentTag.dx2.value , "d", "int" , 0);
        var dy2 = parseText( currentTag.dy2.value , "d", "int" , 0);
        var dz2 = parseText( currentTag.dz2.value , "d", "int" , 0);

        console.log("built edge v1", v1,dx1, dy1, dz1 ,"v2",v2,dx2, dy2, dz2);
        currentEdge = null;
      break;

      //materials and textures    
      case "material":
          console.log("getting material data");
          scope.materialsById[currentMaterial.id] = currentMaterial;
          scope.materials.push( currentMaterial );
          currentMaterial = null;
      break;
      case "texture":
          console.log("getting texture data");
          currentTexture.imgData = currentTag.value;
          textures[currentTexture.id] = scope._parseTexture(currentTexture);
          currentTexture = null;
      break;
      //constellation
      case "constellation":
          scope.constellations.push( currentConstellation );
          console.log("done with constellation");
          currentConstellation = null;
      break;
      case "instance":
          var position = parseVector3(currentTag, "delta",0.0);
          var rotation = parseVector3(currentTag, "r", 1.0);

          var objectId= currentObjectInstance.id;
          var meshInstance = meshes[objectId];
				  var meshInstanceData = {instance:meshInstance,pos:position,rot:rotation};
          currentConstellation.children.push( meshInstanceData );
          currentObjectInstance = null;
          //console.log("closing instance",objectId, "posOffset",position,"rotOffset",rotation);
      break;

    }
    currentItem = null;
    if (currentTag && currentTag.parent) {
      var p = currentTag.parent
      delete currentTag.parent
      currentTag = p
    }
  }

  parser.onattribute = function (attr) {
    // an attribute.  attr has "name" and "value"
    //if(currentItem) console.log("currentItem + attr",currentItem, attr)
    if(currentItem) currentItem[attr.name]= attr.value;
  };
  parser.ontext = function (text) {
    if (currentTag) currentTag.value = text;
    //if (currentTag && currentTag.parent) currentTag.parent.value = text;
    //console.log("text", currentTag.parent);
  }

  parser.onerror = function(error)
  { 
      console.log("error in parser")
      //console.log(error);
      //throw error;
      parser.resume();
  }

  /*parser.onend = function () {// parser stream is done, and ready to have more stuff written to it.
    console.log("THE END");
    //scope._generateScene();
    //scope._applyMaterials(materials, textures, meshes,facesThatNeedMaterial);
  };*/
}


AMF.prototype._parseTexture = function ( textureData ){
	var rawImg = textureData.imgData;
  //'data:image/png;base64,'+
  /*Spec says  : 
  The data will be encoded string of bytes in Base64 encoding, as grayscale values.
  Grayscale will be encoded as a string of individual bytes, one per pixel, 
  specifying the grayscale level in the 0-255 range : 
  how to handle grayscale combos?*/
  //Since textures are grayscale, and one per channel (r,g,b), we need to combine all three to get data

  /*rawImg = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB90RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgOLVo0ngAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMjgvMTGdjbKfAAABwklEQVQ4jdXUsWrjQBCA4X+11spikXAEUWdSuUjh5goXx1V5snu4kMLgyoEUgYNDhUHGsiNbCK200hWXFI7iOIEUd9Mu87E7MzsC6PjCcL4S+z/AwXuHQgg8T6GUi+MI2rbDmJqqMnTd26U/CXqeRxD4aO2ilIOUAms7jGkpipr9vqSqqo+BnudxcaEZjRRx7DIeK7SWFIUlSQxpKhkMHLZbemgPFEIQBD6jkeL62mc2u2QyuSIMA/J8z+Pjb+bzNQ8P0DTtedDzFFq7xLHLbHbJzc0PptPv+H5EWWYsl3fALZvNirK05LnCGHMaVOpvzcZjxWRy9Yx9A2J8P2U6hSRJuL/fsFoZhsNjsDc2jiOQUqC1JAwDfD8CYkA/oxFhGKC1REqB44jj/Ndg23ZY21EUljzfU5YZkAIFkFKWGXm+pygs1nbUdXOUL4Gfr5vi+wohBFFk0VoQRQNcN6Msf7Fc3rFYLFksnsiymu22oG3b0zWsKkNR1KSpZD5fA7ckSdLrcprWHA6Gpjm+oeCNbXN+Dmt2O8N6/YS19jz4gp76KYeDYbc79LB3wZdQSjEcKhxHUNcNVVX3nvkp8LPx7+/DP92w3rYV8ocfAAAAAElFTkSuQmCC';*/

  if(detectEnv.isNode)
  {
    function btoa(str) {
      var buffer;
      if (str instanceof Buffer) {
        buffer = str;
      } else {
        buffer = new Buffer(str.toString(), 'binary');
      }
      return buffer.toString('base64');
    }
    rawImg = btoa(rawImg);
  }
  else
  {
    rawImg = btoa(rawImg);
    /*var image = document.createElement( 'img' );
    image.src = rawImg;
    var texture = new THREE.Texture( image );*/
  }
  /*var texture = new THREE.DataTexture( rawImg, parseText(textureData.width,"int",256) , parseText(textureData.height,"int",256), THREE.RGBAFormat );
  texture.needsUpdate = true;*/
	
	var id = textureData.id;
	var type = textureData.type;
	var tiling= textureData.tiled;
  var depth = parseText(textureData.depth,"int",1) ;
	
  console.log("texture data", id, type, tiling,depth );
	return textureData;
}

///

AMF.prototype._applyMaterials = function(materials, textures, meshes, facesThatNeedMaterial)
{//since materials are usually defined after objects/ volumes, we need to apply
  //materials to those that need them
  for(var i = 0 ; i<facesThatNeedMaterial.length; i++)
  {
      var curFace = facesThatNeedMaterial[i];
      var mat = materials[curFace.matId];
      curFace.item.color = mat.color;
      curFace.item.vertexColors = [];
      //console.log("curFace",curFace.item);
  }

  /*
  if(Object.keys(this.textures).length>0)
	{
		var materialArray = [];
		for (var textureIndex in textures)
		{
			var texture = this.textures[textureIndex];
			materialArray.push(new THREE.MeshBasicMaterial({
				map: texture,
				color: color,
				vertexColors: THREE.VertexColors
				}));
    }
    currentMaterial = new THREE.MeshFaceMaterial(materialArray);
  }*/
}





  function parseText( value, toType , defaultValue)
	{
		defaultValue = defaultValue || null;

		if( value !== null && value !== undefined )
		{
			switch(toType)
			{
				case "float":
					value = parseFloat(value);
				break;
				case "int":
					value = parseInt(value);
        break;
				//default:
			}
		}
		else if (defaultValue !== null)
		{
			value = defaultValue;
		}
		return value;
	}

	function parseColor( node , defaultValue)
	{
		var color = defaultValue || null; //var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");

		var r = parseText( node.r.value , "float",1.0);
		var g = parseText( node.g.value , "float", 1.0);
		var b = parseText( node.b.value , "float", 1.0);
	  var a = ("a" in node) ? parseText( node.a.value , "float", 1.0) : 1.0;
    var color = [r,g,b,a];
		return color;
	}

	function parseVector3( node, prefix, defaultValue )
	{
		var coords = null;
    var prefix =  prefix || "" ;
    var defaultValue = defaultValue || 0.0;

    var x = (prefix+"x" in node) ? parseText( node[prefix+"x"].value, "float" , defaultValue) : defaultValue;
    var y = (prefix+"y" in node) ? parseText( node[prefix+"y"].value, "float" , defaultValue) : defaultValue;
    var z = (prefix+"z" in node) ? parseText( node[prefix+"z"].value, "float" , defaultValue) : defaultValue;
    //var coords = new THREE.Vector3(x,y,z);
    var coords = [x,y,z];
		return coords;
	}

  function parseMapCoords( node, prefix, defaultValue)
  {
    //console.log("parsing map coords", node, ("btexid" in node) , node.btexid);
    //get vertex UVs (optional)
    //rtexid, gtexid, btexid
    
    var rtexid = ("rtexid" in node) ? parseText( node["rtexid"], "int" , null) : null;
	  var gtexid = ("gtexid" in node) ? parseText( node["gtexid"], "int" , defaultValue) : null;
		var btexid = ("btexid" in node) ? parseText( node["btexid"], "int" , defaultValue) : null;

    var u1 = ("u1" in node) ? parseText( node["u1"].value, "float" , defaultValue) : null;
	  var u2 = ("u2" in node) ? parseText( node["u2"].value, "float" , defaultValue) : null;
		var u3 = ("u3" in node) ? parseText( node["u3"].value, "float" , defaultValue) : null;

    var v1 = ("v1" in node) ? parseText( node["v1"].value, "float" , defaultValue) : null;
	  var v2 = ("v2" in node) ? parseText( node["v2"].value, "float" , defaultValue) : null;
		var v3 = ("v3" in node) ? parseText( node["v3"].value, "float" , defaultValue) : null;

    //console.log("textures ids", rtexid,gtexid,btexid,"coords", u1,u2,u3,"/", v1,v2,v3);
    //face.materialIndex  = rtexid;
		//face.materialIndex  = 0;

		var uv1 = (u1 !== null && v1 !=null) ? [u1,v1] : null;
		var uv2 = (u2 !== null && v2 !=null) ? [u2,v2] : null; 
	  var uv3 = (u3 !== null && v3 !=null) ? [u3,v3] : null;
		
    var mappingData = {matId:0, uvs:[uv1,uv2,uv3]};
    //currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3]);
    return mappingData;
  }

  function parseExpression( expr)
  {//This is for "maths" expression for materials, colors etc :TODO: implement

  }
  
  


module.exports = AMF;

}).call(this,require("buffer").Buffer)
},{"buffer":5,"composite-detect":false,"jszip":false,"sax":19}],4:[function(require,module,exports){
module.exports = function parse(params){
      var template = "precision mediump float; \n" +
"precision mediump int; \n" +
" \n" +
"varying vec3 vPosition; \n" +
"varying vec4 vColor; \n" +
" \n" +
"void main()	{ \n" +
" \n" +
"	vec4 color = vec4( vColor ); \n" +
"	//color.r += sin( vPosition.x * 10.0 + time ) * 0.5; \n" +
" \n" +
"	gl_FragColor = color; \n" +
" \n" +
"} \n" +
" \n" +
" \n" 
      params = params || {}
      for(var key in params) {
        var matcher = new RegExp("{{"+key+"}}","g")
        template = template.replace(matcher, params[key])
      }
      return template
    };

},{}],5:[function(require,module,exports){
/**
 * The buffer module from node.js, for the browser.
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install buffer`
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
   // Detect if browser supports Typed Arrays. Supported browsers are IE 10+,
   // Firefox 4+, Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+.
  if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined')
    return false

  // Does the browser support adding properties to `Uint8Array` instances? If
  // not, then that's the same as no `Uint8Array` support. We need to be able to
  // add all the node Buffer API methods.
  // Relevant Firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var arr = new Uint8Array(0)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Workaround: node's base64 implementation allows for non-padded strings
  // while base64-js does not.
  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // Assume object is an array
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof Uint8Array === 'function' &&
      subject instanceof Uint8Array) {
    // Speed optimization -- use set if we're copying from a Uint8Array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

// BUFFER INSTANCE METHODS
// =======================

function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  // copy!
  for (var i = 0; i < end - start; i++)
    target[i + target_start] = this[i + start]
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array === 'function') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype

/**
 * Augment the Uint8Array *instance* (not the class!) with Buffer methods
 */
function augment (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0,
      'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":6,"ieee754":7}],6:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var ZERO   = '0'.charCodeAt(0)
	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	module.exports.toByteArray = b64ToByteArray
	module.exports.fromByteArray = uint8ToBase64
}())

},{}],7:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],8:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],9:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],10:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],11:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;
var inherits = require('inherits');
var setImmediate = require('process/browser.js').nextTick;
var Readable = require('./readable.js');
var Writable = require('./writable.js');

inherits(Duplex, Readable);

Duplex.prototype.write = Writable.prototype.write;
Duplex.prototype.end = Writable.prototype.end;
Duplex.prototype._write = Writable.prototype._write;

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  var self = this;
  setImmediate(function () {
    self.end();
  });
}

},{"./readable.js":15,"./writable.js":17,"inherits":9,"process/browser.js":13}],12:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('./readable.js');
Stream.Writable = require('./writable.js');
Stream.Duplex = require('./duplex.js');
Stream.Transform = require('./transform.js');
Stream.PassThrough = require('./passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"./duplex.js":11,"./passthrough.js":14,"./readable.js":15,"./transform.js":16,"./writable.js":17,"events":8,"inherits":9}],13:[function(require,module,exports){
module.exports=require(10)
},{}],14:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./transform.js');
var inherits = require('inherits');
inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./transform.js":16,"inherits":9}],15:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;
Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;
var Stream = require('./index.js');
var Buffer = require('buffer').Buffer;
var setImmediate = require('process/browser.js').nextTick;
var StringDecoder;

var inherits = require('inherits');
inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // In streams that never have any data, and do push(null) right away,
  // the consumer can miss the 'end' event if they do some I/O before
  // consuming the stream.  So, we don't emit('end') until some reading
  // happens.
  this.calledRead = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (typeof chunk === 'string' && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null || chunk === undefined) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      // update the buffer info.
      state.length += state.objectMode ? 1 : chunk.length;
      if (addToFront) {
        state.buffer.unshift(chunk);
      } else {
        state.reading = false;
        state.buffer.push(chunk);
      }

      if (state.needReadable)
        emitReadable(stream);

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || n === null) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  state.calledRead = true;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we happened to read() exactly the remaining amount in the
  // buffer, and the EOF has been seen at this point, then make sure
  // that we emit 'end' on the very next tick.
  if (state.ended && !state.endEmitted && state.length === 0)
    endReadable(this);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode &&
      !er) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // if we've ended and we have some data left, then emit
  // 'readable' now to make sure it gets picked up.
  if (state.length > 0)
    emitReadable(stream);
  else
    endReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (state.emittedReadable)
    return;

  state.emittedReadable = true;
  if (state.sync)
    setImmediate(function() {
      emitReadable_(stream);
    });
  else
    emitReadable_(stream);
}

function emitReadable_(stream) {
  stream.emit('readable');
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    setImmediate(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    setImmediate(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  // check for listeners before emit removes one-time listeners.
  var errListeners = EE.listenerCount(dest, 'error');
  function onerror(er) {
    unpipe();
    if (errListeners === 0 && EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  dest.once('error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    setImmediate(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount && null !== (chunk = src.read())) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      forEach(state.pipes, write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (EE.listenerCount(src, 'data') > 0)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        this.read(0);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      setImmediate(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, function (x) {
      return self.emit.apply(self, ev, x);
    });
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted && state.calledRead) {
    state.ended = true;
    setImmediate(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require("/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"./index.js":12,"/home/mmoissette/dev/projects/coffeescad/parsers/usco-amf-parser/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":10,"buffer":5,"events":8,"inherits":9,"process/browser.js":13,"string_decoder":18}],16:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./duplex.js');
var inherits = require('inherits');
inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  var ts = this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('finish', function() {
    if ('function' === typeof this._flush)
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var rs = stream._readableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./duplex.js":11,"inherits":9}],17:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;
Writable.WritableState = WritableState;

var isUint8Array = typeof Uint8Array !== 'undefined'
  ? function (x) { return x instanceof Uint8Array }
  : function (x) {
    return x && x.constructor && x.constructor.name === 'Uint8Array'
  }
;
var isArrayBuffer = typeof ArrayBuffer !== 'undefined'
  ? function (x) { return x instanceof ArrayBuffer }
  : function (x) {
    return x && x.constructor && x.constructor.name === 'ArrayBuffer'
  }
;

var inherits = require('inherits');
var Stream = require('./index.js');
var setImmediate = require('process/browser.js').nextTick;
var Buffer = require('buffer').Buffer;

inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, becuase any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];
}

function Writable(options) {
  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Stream.Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  setImmediate(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    setImmediate(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (!Buffer.isBuffer(chunk) && isUint8Array(chunk))
    chunk = new Buffer(chunk);
  if (isArrayBuffer(chunk) && typeof Uint8Array !== 'undefined')
    chunk = new Buffer(new Uint8Array(chunk));
  
  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb))
    ret = writeOrBuffer(this, state, chunk, encoding, cb);

  return ret;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  state.needDrain = !ret;

  if (state.writing)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    setImmediate(function() {
      cb(er);
    });
  else
    cb(er);

  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished && !state.bufferProcessing && state.buffer.length)
      clearBuffer(stream, state);

    if (sync) {
      setImmediate(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  cb();
  if (finished)
    finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  for (var c = 0; c < state.buffer.length; c++) {
    var entry = state.buffer[c];
    var chunk = entry.chunk;
    var encoding = entry.encoding;
    var cb = entry.callback;
    var len = state.objectMode ? 1 : chunk.length;

    doWrite(stream, state, len, chunk, encoding, cb);

    // if we didn't call the onwrite immediately, then
    // it means that we need to wait until it does.
    // also, that means that the chunk and cb are currently
    // being processed, so move the buffer counter past them.
    if (state.writing) {
      c++;
      break;
    }
  }

  state.bufferProcessing = false;
  if (c < state.buffer.length)
    state.buffer = state.buffer.slice(c);
  else
    state.buffer.length = 0;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (typeof chunk !== 'undefined' && chunk !== null)
    this.write(chunk, encoding);

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    state.finished = true;
    stream.emit('finish');
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      setImmediate(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./index.js":12,"buffer":5,"inherits":9,"process/browser.js":13}],18:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

function assertEncoding(encoding) {
  if (encoding && !Buffer.isEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  this.charBuffer = new Buffer(6);
  this.charReceived = 0;
  this.charLength = 0;
};


StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  var offset = 0;

  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var i = (buffer.length >= this.charLength - this.charReceived) ?
                this.charLength - this.charReceived :
                buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, offset, i);
    this.charReceived += (i - offset);
    offset = i;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (i == buffer.length) return charStr;

    // otherwise cut off the characters end from the beginning of this buffer
    buffer = buffer.slice(i, buffer.length);
    break;
  }

  var lenIncomplete = this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - lenIncomplete, end);
    this.charReceived = lenIncomplete;
    end -= lenIncomplete;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    this.charBuffer.write(charStr.charAt(charStr.length - 1), this.encoding);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }

  return i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 2;
  this.charLength = incomplete ? 2 : 0;
  return incomplete;
}

function base64DetectIncompleteChar(buffer) {
  var incomplete = this.charReceived = buffer.length % 3;
  this.charLength = incomplete ? 3 : 0;
  return incomplete;
}

},{"buffer":5}],19:[function(require,module,exports){
(function (Buffer){
// wrapper for non-node envs
;(function (sax) {

sax.parser = function (strict, opt) { return new SAXParser(strict, opt) }
sax.SAXParser = SAXParser
sax.SAXStream = SAXStream
sax.createStream = createStream

// When we pass the MAX_BUFFER_LENGTH position, start checking for buffer overruns.
// When we check, schedule the next check for MAX_BUFFER_LENGTH - (max(buffer lengths)),
// since that's the earliest that a buffer overrun could occur.  This way, checks are
// as rare as required, but as often as necessary to ensure never crossing this bound.
// Furthermore, buffers are only tested at most once per write(), so passing a very
// large string into write() might have undesirable effects, but this is manageable by
// the caller, so it is assumed to be safe.  Thus, a call to write() may, in the extreme
// edge case, result in creating at most one complete copy of the string passed in.
// Set to Infinity to have unlimited buffers.
sax.MAX_BUFFER_LENGTH = 64 * 1024

var buffers = [
  "comment", "sgmlDecl", "textNode", "tagName", "doctype",
  "procInstName", "procInstBody", "entity", "attribName",
  "attribValue", "cdata", "script"
]

sax.EVENTS = // for discoverability.
  [ "text"
  , "processinginstruction"
  , "sgmldeclaration"
  , "doctype"
  , "comment"
  , "attribute"
  , "opentag"
  , "closetag"
  , "opencdata"
  , "cdata"
  , "closecdata"
  , "error"
  , "end"
  , "ready"
  , "script"
  , "opennamespace"
  , "closenamespace"
  ]

function SAXParser (strict, opt) {
  if (!(this instanceof SAXParser)) return new SAXParser(strict, opt)

  var parser = this
  clearBuffers(parser)
  parser.q = parser.c = ""
  parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH
  parser.opt = opt || {}
  parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags
  parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase"
  parser.tags = []
  parser.closed = parser.closedRoot = parser.sawRoot = false
  parser.tag = parser.error = null
  parser.strict = !!strict
  parser.noscript = !!(strict || parser.opt.noscript)
  parser.state = S.BEGIN
  parser.ENTITIES = Object.create(sax.ENTITIES)
  parser.attribList = []

  // namespaces form a prototype chain.
  // it always points at the current tag,
  // which protos to its parent tag.
  if (parser.opt.xmlns) parser.ns = Object.create(rootNS)

  // mostly just for error reporting
  parser.trackPosition = parser.opt.position !== false
  if (parser.trackPosition) {
    parser.position = parser.line = parser.column = 0
  }
  emit(parser, "onready")
}

if (!Object.create) Object.create = function (o) {
  function f () { this.__proto__ = o }
  f.prototype = o
  return new f
}

if (!Object.getPrototypeOf) Object.getPrototypeOf = function (o) {
  return o.__proto__
}

if (!Object.keys) Object.keys = function (o) {
  var a = []
  for (var i in o) if (o.hasOwnProperty(i)) a.push(i)
  return a
}

function checkBufferLength (parser) {
  var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10)
    , maxActual = 0
  for (var i = 0, l = buffers.length; i < l; i ++) {
    var len = parser[buffers[i]].length
    if (len > maxAllowed) {
      // Text/cdata nodes can get big, and since they're buffered,
      // we can get here under normal conditions.
      // Avoid issues by emitting the text node now,
      // so at least it won't get any bigger.
      switch (buffers[i]) {
        case "textNode":
          closeText(parser)
        break

        case "cdata":
          emitNode(parser, "oncdata", parser.cdata)
          parser.cdata = ""
        break

        case "script":
          emitNode(parser, "onscript", parser.script)
          parser.script = ""
        break

        default:
          error(parser, "Max buffer length exceeded: "+buffers[i])
      }
    }
    maxActual = Math.max(maxActual, len)
  }
  // schedule the next check for the earliest possible buffer overrun.
  parser.bufferCheckPosition = (sax.MAX_BUFFER_LENGTH - maxActual)
                             + parser.position
}

function clearBuffers (parser) {
  for (var i = 0, l = buffers.length; i < l; i ++) {
    parser[buffers[i]] = ""
  }
}

function flushBuffers (parser) {
  closeText(parser)
  if (parser.cdata !== "") {
    emitNode(parser, "oncdata", parser.cdata)
    parser.cdata = ""
  }
  if (parser.script !== "") {
    emitNode(parser, "onscript", parser.script)
    parser.script = ""
  }
}

SAXParser.prototype =
  { end: function () { end(this) }
  , write: write
  , resume: function () { this.error = null; return this }
  , close: function () { return this.write(null) }
  , flush: function () { flushBuffers(this) }
  }

try {
  var Stream = require("stream").Stream
} catch (ex) {
  var Stream = function () {}
}


var streamWraps = sax.EVENTS.filter(function (ev) {
  return ev !== "error" && ev !== "end"
})

function createStream (strict, opt) {
  return new SAXStream(strict, opt)
}

function SAXStream (strict, opt) {
  if (!(this instanceof SAXStream)) return new SAXStream(strict, opt)

  Stream.apply(this)

  this._parser = new SAXParser(strict, opt)
  this.writable = true
  this.readable = true


  var me = this

  this._parser.onend = function () {
    me.emit("end")
  }

  this._parser.onerror = function (er) {
    me.emit("error", er)

    // if didn't throw, then means error was handled.
    // go ahead and clear error, so we can write again.
    me._parser.error = null
  }

  this._decoder = null;

  streamWraps.forEach(function (ev) {
    Object.defineProperty(me, "on" + ev, {
      get: function () { return me._parser["on" + ev] },
      set: function (h) {
        if (!h) {
          me.removeAllListeners(ev)
          return me._parser["on"+ev] = h
        }
        me.on(ev, h)
      },
      enumerable: true,
      configurable: false
    })
  })
}

SAXStream.prototype = Object.create(Stream.prototype,
  { constructor: { value: SAXStream } })

SAXStream.prototype.write = function (data) {
  if (typeof Buffer === 'function' &&
      typeof Buffer.isBuffer === 'function' &&
      Buffer.isBuffer(data)) {
    if (!this._decoder) {
      var SD = require('string_decoder').StringDecoder
      this._decoder = new SD('utf8')
    }
    data = this._decoder.write(data);
  }

  this._parser.write(data.toString())
  this.emit("data", data)
  return true
}

SAXStream.prototype.end = function (chunk) {
  if (chunk && chunk.length) this.write(chunk)
  this._parser.end()
  return true
}

SAXStream.prototype.on = function (ev, handler) {
  var me = this
  if (!me._parser["on"+ev] && streamWraps.indexOf(ev) !== -1) {
    me._parser["on"+ev] = function () {
      var args = arguments.length === 1 ? [arguments[0]]
               : Array.apply(null, arguments)
      args.splice(0, 0, ev)
      me.emit.apply(me, args)
    }
  }

  return Stream.prototype.on.call(me, ev, handler)
}



// character classes and tokens
var whitespace = "\r\n\t "
  // this really needs to be replaced with character classes.
  // XML allows all manner of ridiculous numbers and digits.
  , number = "0124356789"
  , letter = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
  // (Letter | "_" | ":")
  , quote = "'\""
  , entity = number+letter+"#"
  , attribEnd = whitespace + ">"
  , CDATA = "[CDATA["
  , DOCTYPE = "DOCTYPE"
  , XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace"
  , XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/"
  , rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE }

// turn all the string character sets into character class objects.
whitespace = charClass(whitespace)
number = charClass(number)
letter = charClass(letter)

// http://www.w3.org/TR/REC-xml/#NT-NameStartChar
// This implementation works on strings, a single character at a time
// as such, it cannot ever support astral-plane characters (10000-EFFFF)
// without a significant breaking change to either this  parser, or the
// JavaScript language.  Implementation of an emoji-capable xml parser
// is left as an exercise for the reader.
var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/

var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040\.\d-]/

quote = charClass(quote)
entity = charClass(entity)
attribEnd = charClass(attribEnd)

function charClass (str) {
  return str.split("").reduce(function (s, c) {
    s[c] = true
    return s
  }, {})
}

function isRegExp (c) {
  return Object.prototype.toString.call(c) === '[object RegExp]'
}

function is (charclass, c) {
  return isRegExp(charclass) ? !!c.match(charclass) : charclass[c]
}

function not (charclass, c) {
  return !is(charclass, c)
}

var S = 0
sax.STATE =
{ BEGIN                     : S++
, TEXT                      : S++ // general stuff
, TEXT_ENTITY               : S++ // &amp and such.
, OPEN_WAKA                 : S++ // <
, SGML_DECL                 : S++ // <!BLARG
, SGML_DECL_QUOTED          : S++ // <!BLARG foo "bar
, DOCTYPE                   : S++ // <!DOCTYPE
, DOCTYPE_QUOTED            : S++ // <!DOCTYPE "//blah
, DOCTYPE_DTD               : S++ // <!DOCTYPE "//blah" [ ...
, DOCTYPE_DTD_QUOTED        : S++ // <!DOCTYPE "//blah" [ "foo
, COMMENT_STARTING          : S++ // <!-
, COMMENT                   : S++ // <!--
, COMMENT_ENDING            : S++ // <!-- blah -
, COMMENT_ENDED             : S++ // <!-- blah --
, CDATA                     : S++ // <![CDATA[ something
, CDATA_ENDING              : S++ // ]
, CDATA_ENDING_2            : S++ // ]]
, PROC_INST                 : S++ // <?hi
, PROC_INST_BODY            : S++ // <?hi there
, PROC_INST_ENDING          : S++ // <?hi "there" ?
, OPEN_TAG                  : S++ // <strong
, OPEN_TAG_SLASH            : S++ // <strong /
, ATTRIB                    : S++ // <a
, ATTRIB_NAME               : S++ // <a foo
, ATTRIB_NAME_SAW_WHITE     : S++ // <a foo _
, ATTRIB_VALUE              : S++ // <a foo=
, ATTRIB_VALUE_QUOTED       : S++ // <a foo="bar
, ATTRIB_VALUE_CLOSED       : S++ // <a foo="bar"
, ATTRIB_VALUE_UNQUOTED     : S++ // <a foo=bar
, ATTRIB_VALUE_ENTITY_Q     : S++ // <foo bar="&quot;"
, ATTRIB_VALUE_ENTITY_U     : S++ // <foo bar=&quot;
, CLOSE_TAG                 : S++ // </a
, CLOSE_TAG_SAW_WHITE       : S++ // </a   >
, SCRIPT                    : S++ // <script> ...
, SCRIPT_ENDING             : S++ // <script> ... <
}

sax.ENTITIES =
{ "amp" : "&"
, "gt" : ">"
, "lt" : "<"
, "quot" : "\""
, "apos" : "'"
, "AElig" : 198
, "Aacute" : 193
, "Acirc" : 194
, "Agrave" : 192
, "Aring" : 197
, "Atilde" : 195
, "Auml" : 196
, "Ccedil" : 199
, "ETH" : 208
, "Eacute" : 201
, "Ecirc" : 202
, "Egrave" : 200
, "Euml" : 203
, "Iacute" : 205
, "Icirc" : 206
, "Igrave" : 204
, "Iuml" : 207
, "Ntilde" : 209
, "Oacute" : 211
, "Ocirc" : 212
, "Ograve" : 210
, "Oslash" : 216
, "Otilde" : 213
, "Ouml" : 214
, "THORN" : 222
, "Uacute" : 218
, "Ucirc" : 219
, "Ugrave" : 217
, "Uuml" : 220
, "Yacute" : 221
, "aacute" : 225
, "acirc" : 226
, "aelig" : 230
, "agrave" : 224
, "aring" : 229
, "atilde" : 227
, "auml" : 228
, "ccedil" : 231
, "eacute" : 233
, "ecirc" : 234
, "egrave" : 232
, "eth" : 240
, "euml" : 235
, "iacute" : 237
, "icirc" : 238
, "igrave" : 236
, "iuml" : 239
, "ntilde" : 241
, "oacute" : 243
, "ocirc" : 244
, "ograve" : 242
, "oslash" : 248
, "otilde" : 245
, "ouml" : 246
, "szlig" : 223
, "thorn" : 254
, "uacute" : 250
, "ucirc" : 251
, "ugrave" : 249
, "uuml" : 252
, "yacute" : 253
, "yuml" : 255
, "copy" : 169
, "reg" : 174
, "nbsp" : 160
, "iexcl" : 161
, "cent" : 162
, "pound" : 163
, "curren" : 164
, "yen" : 165
, "brvbar" : 166
, "sect" : 167
, "uml" : 168
, "ordf" : 170
, "laquo" : 171
, "not" : 172
, "shy" : 173
, "macr" : 175
, "deg" : 176
, "plusmn" : 177
, "sup1" : 185
, "sup2" : 178
, "sup3" : 179
, "acute" : 180
, "micro" : 181
, "para" : 182
, "middot" : 183
, "cedil" : 184
, "ordm" : 186
, "raquo" : 187
, "frac14" : 188
, "frac12" : 189
, "frac34" : 190
, "iquest" : 191
, "times" : 215
, "divide" : 247
, "OElig" : 338
, "oelig" : 339
, "Scaron" : 352
, "scaron" : 353
, "Yuml" : 376
, "fnof" : 402
, "circ" : 710
, "tilde" : 732
, "Alpha" : 913
, "Beta" : 914
, "Gamma" : 915
, "Delta" : 916
, "Epsilon" : 917
, "Zeta" : 918
, "Eta" : 919
, "Theta" : 920
, "Iota" : 921
, "Kappa" : 922
, "Lambda" : 923
, "Mu" : 924
, "Nu" : 925
, "Xi" : 926
, "Omicron" : 927
, "Pi" : 928
, "Rho" : 929
, "Sigma" : 931
, "Tau" : 932
, "Upsilon" : 933
, "Phi" : 934
, "Chi" : 935
, "Psi" : 936
, "Omega" : 937
, "alpha" : 945
, "beta" : 946
, "gamma" : 947
, "delta" : 948
, "epsilon" : 949
, "zeta" : 950
, "eta" : 951
, "theta" : 952
, "iota" : 953
, "kappa" : 954
, "lambda" : 955
, "mu" : 956
, "nu" : 957
, "xi" : 958
, "omicron" : 959
, "pi" : 960
, "rho" : 961
, "sigmaf" : 962
, "sigma" : 963
, "tau" : 964
, "upsilon" : 965
, "phi" : 966
, "chi" : 967
, "psi" : 968
, "omega" : 969
, "thetasym" : 977
, "upsih" : 978
, "piv" : 982
, "ensp" : 8194
, "emsp" : 8195
, "thinsp" : 8201
, "zwnj" : 8204
, "zwj" : 8205
, "lrm" : 8206
, "rlm" : 8207
, "ndash" : 8211
, "mdash" : 8212
, "lsquo" : 8216
, "rsquo" : 8217
, "sbquo" : 8218
, "ldquo" : 8220
, "rdquo" : 8221
, "bdquo" : 8222
, "dagger" : 8224
, "Dagger" : 8225
, "bull" : 8226
, "hellip" : 8230
, "permil" : 8240
, "prime" : 8242
, "Prime" : 8243
, "lsaquo" : 8249
, "rsaquo" : 8250
, "oline" : 8254
, "frasl" : 8260
, "euro" : 8364
, "image" : 8465
, "weierp" : 8472
, "real" : 8476
, "trade" : 8482
, "alefsym" : 8501
, "larr" : 8592
, "uarr" : 8593
, "rarr" : 8594
, "darr" : 8595
, "harr" : 8596
, "crarr" : 8629
, "lArr" : 8656
, "uArr" : 8657
, "rArr" : 8658
, "dArr" : 8659
, "hArr" : 8660
, "forall" : 8704
, "part" : 8706
, "exist" : 8707
, "empty" : 8709
, "nabla" : 8711
, "isin" : 8712
, "notin" : 8713
, "ni" : 8715
, "prod" : 8719
, "sum" : 8721
, "minus" : 8722
, "lowast" : 8727
, "radic" : 8730
, "prop" : 8733
, "infin" : 8734
, "ang" : 8736
, "and" : 8743
, "or" : 8744
, "cap" : 8745
, "cup" : 8746
, "int" : 8747
, "there4" : 8756
, "sim" : 8764
, "cong" : 8773
, "asymp" : 8776
, "ne" : 8800
, "equiv" : 8801
, "le" : 8804
, "ge" : 8805
, "sub" : 8834
, "sup" : 8835
, "nsub" : 8836
, "sube" : 8838
, "supe" : 8839
, "oplus" : 8853
, "otimes" : 8855
, "perp" : 8869
, "sdot" : 8901
, "lceil" : 8968
, "rceil" : 8969
, "lfloor" : 8970
, "rfloor" : 8971
, "lang" : 9001
, "rang" : 9002
, "loz" : 9674
, "spades" : 9824
, "clubs" : 9827
, "hearts" : 9829
, "diams" : 9830
}

Object.keys(sax.ENTITIES).forEach(function (key) {
    var e = sax.ENTITIES[key]
    var s = typeof e === 'number' ? String.fromCharCode(e) : e
    sax.ENTITIES[key] = s
})

for (var S in sax.STATE) sax.STATE[sax.STATE[S]] = S

// shorthand
S = sax.STATE

function emit (parser, event, data) {
  parser[event] && parser[event](data)
}

function emitNode (parser, nodeType, data) {
  if (parser.textNode) closeText(parser)
  emit(parser, nodeType, data)
}

function closeText (parser) {
  parser.textNode = textopts(parser.opt, parser.textNode)
  if (parser.textNode) emit(parser, "ontext", parser.textNode)
  parser.textNode = ""
}

function textopts (opt, text) {
  if (opt.trim) text = text.trim()
  if (opt.normalize) text = text.replace(/\s+/g, " ")
  return text
}

function error (parser, er) {
  closeText(parser)
  if (parser.trackPosition) {
    er += "\nLine: "+parser.line+
          "\nColumn: "+parser.column+
          "\nChar: "+parser.c
  }
  er = new Error(er)
  parser.error = er
  emit(parser, "onerror", er)
  return parser
}

function end (parser) {
  if (!parser.closedRoot) strictFail(parser, "Unclosed root tag")
  if ((parser.state !== S.BEGIN) && (parser.state !== S.TEXT)) error(parser, "Unexpected end")
  closeText(parser)
  parser.c = ""
  parser.closed = true
  emit(parser, "onend")
  SAXParser.call(parser, parser.strict, parser.opt)
  return parser
}

function strictFail (parser, message) {
  if (typeof parser !== 'object' || !(parser instanceof SAXParser))
    throw new Error('bad call to strictFail');
  if (parser.strict) error(parser, message)
}

function newTag (parser) {
  if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]()
  var parent = parser.tags[parser.tags.length - 1] || parser
    , tag = parser.tag = { name : parser.tagName, attributes : {} }

  // will be overridden if tag contails an xmlns="foo" or xmlns:foo="bar"
  if (parser.opt.xmlns) tag.ns = parent.ns
  parser.attribList.length = 0
}

function qname (name, attribute) {
  var i = name.indexOf(":")
    , qualName = i < 0 ? [ "", name ] : name.split(":")
    , prefix = qualName[0]
    , local = qualName[1]

  // <x "xmlns"="http://foo">
  if (attribute && name === "xmlns") {
    prefix = "xmlns"
    local = ""
  }

  return { prefix: prefix, local: local }
}

function attrib (parser) {
  if (!parser.strict) parser.attribName = parser.attribName[parser.looseCase]()

  if (parser.attribList.indexOf(parser.attribName) !== -1 ||
      parser.tag.attributes.hasOwnProperty(parser.attribName)) {
    return parser.attribName = parser.attribValue = ""
  }

  if (parser.opt.xmlns) {
    var qn = qname(parser.attribName, true)
      , prefix = qn.prefix
      , local = qn.local

    if (prefix === "xmlns") {
      // namespace binding attribute; push the binding into scope
      if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
        strictFail( parser
                  , "xml: prefix must be bound to " + XML_NAMESPACE + "\n"
                  + "Actual: " + parser.attribValue )
      } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
        strictFail( parser
                  , "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\n"
                  + "Actual: " + parser.attribValue )
      } else {
        var tag = parser.tag
          , parent = parser.tags[parser.tags.length - 1] || parser
        if (tag.ns === parent.ns) {
          tag.ns = Object.create(parent.ns)
        }
        tag.ns[local] = parser.attribValue
      }
    }

    // defer onattribute events until all attributes have been seen
    // so any new bindings can take effect; preserve attribute order
    // so deferred events can be emitted in document order
    parser.attribList.push([parser.attribName, parser.attribValue])
  } else {
    // in non-xmlns mode, we can emit the event right away
    parser.tag.attributes[parser.attribName] = parser.attribValue
    emitNode( parser
            , "onattribute"
            , { name: parser.attribName
              , value: parser.attribValue } )
  }

  parser.attribName = parser.attribValue = ""
}

function openTag (parser, selfClosing) {
  if (parser.opt.xmlns) {
    // emit namespace binding events
    var tag = parser.tag

    // add namespace info to tag
    var qn = qname(parser.tagName)
    tag.prefix = qn.prefix
    tag.local = qn.local
    tag.uri = tag.ns[qn.prefix] || ""

    if (tag.prefix && !tag.uri) {
      strictFail(parser, "Unbound namespace prefix: "
                       + JSON.stringify(parser.tagName))
      tag.uri = qn.prefix
    }

    var parent = parser.tags[parser.tags.length - 1] || parser
    if (tag.ns && parent.ns !== tag.ns) {
      Object.keys(tag.ns).forEach(function (p) {
        emitNode( parser
                , "onopennamespace"
                , { prefix: p , uri: tag.ns[p] } )
      })
    }

    // handle deferred onattribute events
    // Note: do not apply default ns to attributes:
    //   http://www.w3.org/TR/REC-xml-names/#defaulting
    for (var i = 0, l = parser.attribList.length; i < l; i ++) {
      var nv = parser.attribList[i]
      var name = nv[0]
        , value = nv[1]
        , qualName = qname(name, true)
        , prefix = qualName.prefix
        , local = qualName.local
        , uri = prefix == "" ? "" : (tag.ns[prefix] || "")
        , a = { name: name
              , value: value
              , prefix: prefix
              , local: local
              , uri: uri
              }

      // if there's any attributes with an undefined namespace,
      // then fail on them now.
      if (prefix && prefix != "xmlns" && !uri) {
        strictFail(parser, "Unbound namespace prefix: "
                         + JSON.stringify(prefix))
        a.uri = prefix
      }
      parser.tag.attributes[name] = a
      emitNode(parser, "onattribute", a)
    }
    parser.attribList.length = 0
  }

  parser.tag.isSelfClosing = !!selfClosing

  // process the tag
  parser.sawRoot = true
  parser.tags.push(parser.tag)
  emitNode(parser, "onopentag", parser.tag)
  if (!selfClosing) {
    // special case for <script> in non-strict mode.
    if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
      parser.state = S.SCRIPT
    } else {
      parser.state = S.TEXT
    }
    parser.tag = null
    parser.tagName = ""
  }
  parser.attribName = parser.attribValue = ""
  parser.attribList.length = 0
}

function closeTag (parser) {
  if (!parser.tagName) {
    strictFail(parser, "Weird empty close tag.")
    parser.textNode += "</>"
    parser.state = S.TEXT
    return
  }

  if (parser.script) {
    if (parser.tagName !== "script") {
      parser.script += "</" + parser.tagName + ">"
      parser.tagName = ""
      parser.state = S.SCRIPT
      return
    }
    emitNode(parser, "onscript", parser.script)
    parser.script = ""
  }

  // first make sure that the closing tag actually exists.
  // <a><b></c></b></a> will close everything, otherwise.
  var t = parser.tags.length
  var tagName = parser.tagName
  if (!parser.strict) tagName = tagName[parser.looseCase]()
  var closeTo = tagName
  while (t --) {
    var close = parser.tags[t]
    if (close.name !== closeTo) {
      // fail the first time in strict mode
      strictFail(parser, "Unexpected close tag")
    } else break
  }

  // didn't find it.  we already failed for strict, so just abort.
  if (t < 0) {
    strictFail(parser, "Unmatched closing tag: "+parser.tagName)
    parser.textNode += "</" + parser.tagName + ">"
    parser.state = S.TEXT
    return
  }
  parser.tagName = tagName
  var s = parser.tags.length
  while (s --> t) {
    var tag = parser.tag = parser.tags.pop()
    parser.tagName = parser.tag.name
    emitNode(parser, "onclosetag", parser.tagName)

    var x = {}
    for (var i in tag.ns) x[i] = tag.ns[i]

    var parent = parser.tags[parser.tags.length - 1] || parser
    if (parser.opt.xmlns && tag.ns !== parent.ns) {
      // remove namespace bindings introduced by tag
      Object.keys(tag.ns).forEach(function (p) {
        var n = tag.ns[p]
        emitNode(parser, "onclosenamespace", { prefix: p, uri: n })
      })
    }
  }
  if (t === 0) parser.closedRoot = true
  parser.tagName = parser.attribValue = parser.attribName = ""
  parser.attribList.length = 0
  parser.state = S.TEXT
}

function parseEntity (parser) {
  var entity = parser.entity
    , entityLC = entity.toLowerCase()
    , num
    , numStr = ""
  if (parser.ENTITIES[entity])
    return parser.ENTITIES[entity]
  if (parser.ENTITIES[entityLC])
    return parser.ENTITIES[entityLC]
  entity = entityLC
  if (entity.charAt(0) === "#") {
    if (entity.charAt(1) === "x") {
      entity = entity.slice(2)
      num = parseInt(entity, 16)
      numStr = num.toString(16)
    } else {
      entity = entity.slice(1)
      num = parseInt(entity, 10)
      numStr = num.toString(10)
    }
  }
  entity = entity.replace(/^0+/, "")
  if (numStr.toLowerCase() !== entity) {
    strictFail(parser, "Invalid character entity")
    return "&"+parser.entity + ";"
  }
  return String.fromCharCode(num)
}

function write (chunk) {
  var parser = this
  if (this.error) throw this.error
  if (parser.closed) return error(parser,
    "Cannot write after close. Assign an onready handler.")
  if (chunk === null) return end(parser)
  var i = 0, c = ""
  while (parser.c = c = chunk.charAt(i++)) {
    if (parser.trackPosition) {
      parser.position ++
      if (c === "\n") {
        parser.line ++
        parser.column = 0
      } else parser.column ++
    }
    switch (parser.state) {

      case S.BEGIN:
        if (c === "<") {
          parser.state = S.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else if (not(whitespace,c)) {
          // have to process this as a text node.
          // weird, but happens.
          strictFail(parser, "Non-whitespace before first tag.")
          parser.textNode = c
          parser.state = S.TEXT
        }
      continue

      case S.TEXT:
        if (parser.sawRoot && !parser.closedRoot) {
          var starti = i-1
          while (c && c!=="<" && c!=="&") {
            c = chunk.charAt(i++)
            if (c && parser.trackPosition) {
              parser.position ++
              if (c === "\n") {
                parser.line ++
                parser.column = 0
              } else parser.column ++
            }
          }
          parser.textNode += chunk.substring(starti, i-1)
        }
        if (c === "<") {
          parser.state = S.OPEN_WAKA
          parser.startTagPosition = parser.position
        } else {
          if (not(whitespace, c) && (!parser.sawRoot || parser.closedRoot))
            strictFail(parser, "Text data outside of root node.")
          if (c === "&") parser.state = S.TEXT_ENTITY
          else parser.textNode += c
        }
      continue

      case S.SCRIPT:
        // only non-strict
        if (c === "<") {
          parser.state = S.SCRIPT_ENDING
        } else parser.script += c
      continue

      case S.SCRIPT_ENDING:
        if (c === "/") {
          parser.state = S.CLOSE_TAG
        } else {
          parser.script += "<" + c
          parser.state = S.SCRIPT
        }
      continue

      case S.OPEN_WAKA:
        // either a /, ?, !, or text is coming next.
        if (c === "!") {
          parser.state = S.SGML_DECL
          parser.sgmlDecl = ""
        } else if (is(whitespace, c)) {
          // wait for it...
        } else if (is(nameStart,c)) {
          parser.state = S.OPEN_TAG
          parser.tagName = c
        } else if (c === "/") {
          parser.state = S.CLOSE_TAG
          parser.tagName = ""
        } else if (c === "?") {
          parser.state = S.PROC_INST
          parser.procInstName = parser.procInstBody = ""
        } else {
          strictFail(parser, "Unencoded <")
          // if there was some whitespace, then add that in.
          if (parser.startTagPosition + 1 < parser.position) {
            var pad = parser.position - parser.startTagPosition
            c = new Array(pad).join(" ") + c
          }
          parser.textNode += "<" + c
          parser.state = S.TEXT
        }
      continue

      case S.SGML_DECL:
        if ((parser.sgmlDecl+c).toUpperCase() === CDATA) {
          emitNode(parser, "onopencdata")
          parser.state = S.CDATA
          parser.sgmlDecl = ""
          parser.cdata = ""
        } else if (parser.sgmlDecl+c === "--") {
          parser.state = S.COMMENT
          parser.comment = ""
          parser.sgmlDecl = ""
        } else if ((parser.sgmlDecl+c).toUpperCase() === DOCTYPE) {
          parser.state = S.DOCTYPE
          if (parser.doctype || parser.sawRoot) strictFail(parser,
            "Inappropriately located doctype declaration")
          parser.doctype = ""
          parser.sgmlDecl = ""
        } else if (c === ">") {
          emitNode(parser, "onsgmldeclaration", parser.sgmlDecl)
          parser.sgmlDecl = ""
          parser.state = S.TEXT
        } else if (is(quote, c)) {
          parser.state = S.SGML_DECL_QUOTED
          parser.sgmlDecl += c
        } else parser.sgmlDecl += c
      continue

      case S.SGML_DECL_QUOTED:
        if (c === parser.q) {
          parser.state = S.SGML_DECL
          parser.q = ""
        }
        parser.sgmlDecl += c
      continue

      case S.DOCTYPE:
        if (c === ">") {
          parser.state = S.TEXT
          emitNode(parser, "ondoctype", parser.doctype)
          parser.doctype = true // just remember that we saw it.
        } else {
          parser.doctype += c
          if (c === "[") parser.state = S.DOCTYPE_DTD
          else if (is(quote, c)) {
            parser.state = S.DOCTYPE_QUOTED
            parser.q = c
          }
        }
      continue

      case S.DOCTYPE_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.q = ""
          parser.state = S.DOCTYPE
        }
      continue

      case S.DOCTYPE_DTD:
        parser.doctype += c
        if (c === "]") parser.state = S.DOCTYPE
        else if (is(quote,c)) {
          parser.state = S.DOCTYPE_DTD_QUOTED
          parser.q = c
        }
      continue

      case S.DOCTYPE_DTD_QUOTED:
        parser.doctype += c
        if (c === parser.q) {
          parser.state = S.DOCTYPE_DTD
          parser.q = ""
        }
      continue

      case S.COMMENT:
        if (c === "-") parser.state = S.COMMENT_ENDING
        else parser.comment += c
      continue

      case S.COMMENT_ENDING:
        if (c === "-") {
          parser.state = S.COMMENT_ENDED
          parser.comment = textopts(parser.opt, parser.comment)
          if (parser.comment) emitNode(parser, "oncomment", parser.comment)
          parser.comment = ""
        } else {
          parser.comment += "-" + c
          parser.state = S.COMMENT
        }
      continue

      case S.COMMENT_ENDED:
        if (c !== ">") {
          strictFail(parser, "Malformed comment")
          // allow <!-- blah -- bloo --> in non-strict mode,
          // which is a comment of " blah -- bloo "
          parser.comment += "--" + c
          parser.state = S.COMMENT
        } else parser.state = S.TEXT
      continue

      case S.CDATA:
        if (c === "]") parser.state = S.CDATA_ENDING
        else parser.cdata += c
      continue

      case S.CDATA_ENDING:
        if (c === "]") parser.state = S.CDATA_ENDING_2
        else {
          parser.cdata += "]" + c
          parser.state = S.CDATA
        }
      continue

      case S.CDATA_ENDING_2:
        if (c === ">") {
          if (parser.cdata) emitNode(parser, "oncdata", parser.cdata)
          emitNode(parser, "onclosecdata")
          parser.cdata = ""
          parser.state = S.TEXT
        } else if (c === "]") {
          parser.cdata += "]"
        } else {
          parser.cdata += "]]" + c
          parser.state = S.CDATA
        }
      continue

      case S.PROC_INST:
        if (c === "?") parser.state = S.PROC_INST_ENDING
        else if (is(whitespace, c)) parser.state = S.PROC_INST_BODY
        else parser.procInstName += c
      continue

      case S.PROC_INST_BODY:
        if (!parser.procInstBody && is(whitespace, c)) continue
        else if (c === "?") parser.state = S.PROC_INST_ENDING
        else parser.procInstBody += c
      continue

      case S.PROC_INST_ENDING:
        if (c === ">") {
          emitNode(parser, "onprocessinginstruction", {
            name : parser.procInstName,
            body : parser.procInstBody
          })
          parser.procInstName = parser.procInstBody = ""
          parser.state = S.TEXT
        } else {
          parser.procInstBody += "?" + c
          parser.state = S.PROC_INST_BODY
        }
      continue

      case S.OPEN_TAG:
        if (is(nameBody, c)) parser.tagName += c
        else {
          newTag(parser)
          if (c === ">") openTag(parser)
          else if (c === "/") parser.state = S.OPEN_TAG_SLASH
          else {
            if (not(whitespace, c)) strictFail(
              parser, "Invalid character in tag name")
            parser.state = S.ATTRIB
          }
        }
      continue

      case S.OPEN_TAG_SLASH:
        if (c === ">") {
          openTag(parser, true)
          closeTag(parser)
        } else {
          strictFail(parser, "Forward-slash in opening tag not followed by >")
          parser.state = S.ATTRIB
        }
      continue

      case S.ATTRIB:
        // haven't read the attribute name yet.
        if (is(whitespace, c)) continue
        else if (c === ">") openTag(parser)
        else if (c === "/") parser.state = S.OPEN_TAG_SLASH
        else if (is(nameStart, c)) {
          parser.attribName = c
          parser.attribValue = ""
          parser.state = S.ATTRIB_NAME
        } else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_NAME:
        if (c === "=") parser.state = S.ATTRIB_VALUE
        else if (c === ">") {
          strictFail(parser, "Attribute without value")
          parser.attribValue = parser.attribName
          attrib(parser)
          openTag(parser)
        }
        else if (is(whitespace, c)) parser.state = S.ATTRIB_NAME_SAW_WHITE
        else if (is(nameBody, c)) parser.attribName += c
        else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_NAME_SAW_WHITE:
        if (c === "=") parser.state = S.ATTRIB_VALUE
        else if (is(whitespace, c)) continue
        else {
          strictFail(parser, "Attribute without value")
          parser.tag.attributes[parser.attribName] = ""
          parser.attribValue = ""
          emitNode(parser, "onattribute",
                   { name : parser.attribName, value : "" })
          parser.attribName = ""
          if (c === ">") openTag(parser)
          else if (is(nameStart, c)) {
            parser.attribName = c
            parser.state = S.ATTRIB_NAME
          } else {
            strictFail(parser, "Invalid attribute name")
            parser.state = S.ATTRIB
          }
        }
      continue

      case S.ATTRIB_VALUE:
        if (is(whitespace, c)) continue
        else if (is(quote, c)) {
          parser.q = c
          parser.state = S.ATTRIB_VALUE_QUOTED
        } else {
          strictFail(parser, "Unquoted attribute value")
          parser.state = S.ATTRIB_VALUE_UNQUOTED
          parser.attribValue = c
        }
      continue

      case S.ATTRIB_VALUE_QUOTED:
        if (c !== parser.q) {
          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_Q
          else parser.attribValue += c
          continue
        }
        attrib(parser)
        parser.q = ""
        parser.state = S.ATTRIB_VALUE_CLOSED
      continue

      case S.ATTRIB_VALUE_CLOSED:
        if (is(whitespace, c)) {
          parser.state = S.ATTRIB
        } else if (c === ">") openTag(parser)
        else if (c === "/") parser.state = S.OPEN_TAG_SLASH
        else if (is(nameStart, c)) {
          strictFail(parser, "No whitespace between attributes")
          parser.attribName = c
          parser.attribValue = ""
          parser.state = S.ATTRIB_NAME
        } else strictFail(parser, "Invalid attribute name")
      continue

      case S.ATTRIB_VALUE_UNQUOTED:
        if (not(attribEnd,c)) {
          if (c === "&") parser.state = S.ATTRIB_VALUE_ENTITY_U
          else parser.attribValue += c
          continue
        }
        attrib(parser)
        if (c === ">") openTag(parser)
        else parser.state = S.ATTRIB
      continue

      case S.CLOSE_TAG:
        if (!parser.tagName) {
          if (is(whitespace, c)) continue
          else if (not(nameStart, c)) {
            if (parser.script) {
              parser.script += "</" + c
              parser.state = S.SCRIPT
            } else {
              strictFail(parser, "Invalid tagname in closing tag.")
            }
          } else parser.tagName = c
        }
        else if (c === ">") closeTag(parser)
        else if (is(nameBody, c)) parser.tagName += c
        else if (parser.script) {
          parser.script += "</" + parser.tagName
          parser.tagName = ""
          parser.state = S.SCRIPT
        } else {
          if (not(whitespace, c)) strictFail(parser,
            "Invalid tagname in closing tag")
          parser.state = S.CLOSE_TAG_SAW_WHITE
        }
      continue

      case S.CLOSE_TAG_SAW_WHITE:
        if (is(whitespace, c)) continue
        if (c === ">") closeTag(parser)
        else strictFail(parser, "Invalid characters in closing tag")
      continue

      case S.TEXT_ENTITY:
      case S.ATTRIB_VALUE_ENTITY_Q:
      case S.ATTRIB_VALUE_ENTITY_U:
        switch(parser.state) {
          case S.TEXT_ENTITY:
            var returnState = S.TEXT, buffer = "textNode"
          break

          case S.ATTRIB_VALUE_ENTITY_Q:
            var returnState = S.ATTRIB_VALUE_QUOTED, buffer = "attribValue"
          break

          case S.ATTRIB_VALUE_ENTITY_U:
            var returnState = S.ATTRIB_VALUE_UNQUOTED, buffer = "attribValue"
          break
        }
        if (c === ";") {
          parser[buffer] += parseEntity(parser)
          parser.entity = ""
          parser.state = returnState
        }
        else if (is(entity, c)) parser.entity += c
        else {
          strictFail(parser, "Invalid character entity")
          parser[buffer] += "&" + parser.entity + c
          parser.entity = ""
          parser.state = returnState
        }
      continue

      default:
        throw new Error(parser, "Unknown state: " + parser.state)
    }
  } // while
  // cdata blocks can get very big under normal conditions. emit and move on.
  // if (parser.state === S.CDATA && parser.cdata) {
  //   emitNode(parser, "oncdata", parser.cdata)
  //   parser.cdata = ""
  // }
  if (parser.position >= parser.bufferCheckPosition) checkBufferLength(parser)
  return parser
}

})(typeof exports === "undefined" ? sax = {} : exports)

}).call(this,require("buffer").Buffer)
},{"buffer":5,"stream":12,"string_decoder":18}],20:[function(require,module,exports){
module.exports = function parse(params){
      var template = "precision mediump float; \n" +
"precision mediump int; \n" +
" \n" +
"uniform mat4 modelViewMatrix; // optional \n" +
"uniform mat4 projectionMatrix; // optional \n" +
" \n" +
"attribute vec3 position; \n" +
"attribute vec4 color; \n" +
" \n" +
"varying vec3 vPosition; \n" +
"varying vec4 vColor; \n" +
" \n" +
"void main()	{ \n" +
" \n" +
"	vPosition = position; \n" +
"	vColor = color; \n" +
" \n" +
"	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); \n" +
" \n" +
"} \n" +
" \n" 
      params = params || {}
      for(var key in params) {
        var matcher = new RegExp("{{"+key+"}}","g")
        template = template.replace(matcher, params[key])
      }
      return template
    };

},{}]},{},["wB/k3U"])