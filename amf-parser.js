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
  useWorker = false;
  var self = this;
  var startTime = new Date();
  var s = Date.now();
	if ( useWorker ) {
	  var worker = new Worker( "./amf-worker.js" );
		worker.onmessage = function( event ) {
		  console.log("data recieved in main thread", event.data.data);
	    var data = event.data.data;
	    //var model = self.createModelBuffers( data );
	    var result = this.recurse( data, rootObject, this.createModelBuffers);
      deferred.resolve( rootObject );
		}
		worker.postMessage( {data:data});
		Q.catch( deferred.promise, function(){
		  worker.terminate()
		});
	
	}
	else
	{
	  var amf = new AMF();
    data = amf.load( data );
    if(data.constellations.length<1)
    {
    
    }
    else
    {
      //TODO:recurse through constellation
      for(var i=0;i<data.constellations[0].children.length;i++)
      {
        var child = data.constellations[0].children[i];
        var modelData = child.instance;
        var model = this.createModelBuffers( modelData );
        //var position = new THREE.Vector3()
        model.position.fromArray( child.pos );
				model.rotation.set(child.rot[0],child.rot[1],child.rot[2]); 
				rootObject.add( model );
      }
    }
    //var model = this.createModelBuffers( data );
    deferred.resolve( rootObject );
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
  
  var foo = modelData//.children[0];
  faces = foo.faceCount;
  
  var vertices = new Float32Array( faces * 3 * 3 );
	var normals = new Float32Array( faces * 3 * 3 );
	var colors = new Float32Array( faces *3 * 4 );
	var indices = new Uint16Array( faces * 3  );
	
	vertices.set( foo._attributes.position );
	normals.set( foo._attributes.normal );
	indices.set( foo._attributes.indices );
	colors.set( foo._attributes.vcolors );

  var geometry = new THREE.BufferGeometry();
	geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
	geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );
  geometry.addAttribute( 'index', new THREE.BufferAttribute( indices, 1 ) );
  geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 4 ) );
  
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
  //var material = new this.defaultMaterialType({color:color});
  var mesh = new THREE.Mesh( geometry, material );
  return mesh
}


AMFParser.prototype.unpack = function( data )
{
  try
  {
    var zip = new JSZip(data);
    for(var entryName in zip.files)
    {
      var entry = zip.files[entryName];
      if( entry._data !== null && entry !== undefined) return entry.asText();
   }
  }
  catch(error){return this.ensureString(data);}
}

AMFParser.prototype.ensureString = function (buf) {

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

AMFParser.prototype._generateScene = function ( ){
  console.log("generating scene");
  // if there is constellation data, don't just add meshes to the scene, but use 
	//the info from constellation to do so (additional transforms)
  return
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

AMFParser.prototype._parseTexture = function ( textureData ){
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
  var texture = new THREE.DataTexture( rawImg, parseText(textureData.width,"int",256) , parseText(textureData.height,"int",256), THREE.RGBAFormat );
  texture.needsUpdate = true;
	
	var id = textureData.id;
	var type = textureData.type;
	var tiling= textureData.tiled;
  var depth = parseText(textureData.depth,"int",1) ;
	
  console.log("texture data", id, type, tiling,depth );
	return texture;
}

///



if (detectEnv.isModule) module.exports = AMFParser;
