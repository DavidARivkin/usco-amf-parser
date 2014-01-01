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
 * 	var loader = new THREE.AMFParser();
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

if(detectEnv.isModule) JSZip = require( 'jszip' );
if(detectEnv.isModule) var sax = require( 'sax' );


THREE.AMFParser = function () {
  this.outputs = ["geometry", "materials", "textures"]; //to be able to auto determine data type(s) fetched by parser

  this.defaultMaterialType = THREE.MeshLambertMaterial; //THREE.MeshPhongMaterial;
	this.defaultColor = new THREE.Color( "#efefff" ); //#efefff //#00a9ff
  this.defaultShading = THREE.FlatShading;
  this.defaultSpecular = null;//0xffffff;
  this.defaultShininess = null;//99;

	this.defaultVertexNormal = new THREE.Vector3( 1, 1, 1 );
	this.recomputeNormals = true;
};

THREE.AMFParser.prototype = {
	constructor: THREE.AMFParser
};

THREE.AMFParser.prototype.parse = function(data, parameters)
{
  var parameters = parameters || {};
  var useWorker  = parameters.useWorker || false;
  var useBuffers = parameters.useBuffers || false;

  /*if( root.nodeName !== "amf")
	{
		throw("Unvalid AMF document, should have a root node called 'amf'");
	}*/
  var startTime = new Date();

  var data = this.unpack(data);
  var rootObject = new THREE.Object3D();//TODO: change storage of data : ie don't put everything under a single object
  rootObject.name = "rootScene";

  strict = true, // set to false for html-mode
  parser = sax.parser(strict,{trim:true});

  //various data 
  var unit = null;
  var version = null;

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

  /*if ( useWorker ) {
    var worker = new Worker( "AMFWorker.js" );
  }*/

  //////////////
  var scope = this;  
  
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
        unit = tag.attributes['unit'];
        version = tag.attributes['version'];
        currentItem = rootObject;
      break;

      //geometry
      case 'object':
        currentObject = new THREE.Mesh();
        var id = tag.attributes["id"] || null;
        if(id) currentObject._id = id; objectsIdMap[id] = currentObject.uuid;

        currentObject.geometry = new THREE.Geometry();//TODO: does this not get auto created ???
        //temp storage:
        currentObject._attributes =  {};
        currentObject._attributes["position"] = [];
        currentObject._attributes["normal"] = [];
        currentObject._attributes["color"] = [];

        currentItem = currentObject;
      break;
      case 'volume':
        currentVolume = {};
        var materialId = tag.attributes["materialid"] || null;
        if(materialId) currentVolume.materialId = materialId;
      break;
      case 'triangle':
        currentTriangle = {}
      break;
      case 'edge':
        currentEdge = {};
      break;

      //materials and textures
      case 'material':
        currentMaterial = {};
        var id = tag.attributes["id"] || null;
        if(id) currentMaterial.id = id;

        currentItem = currentMaterial;
      break;
      case 'texture':
        currentTexture = {};
        for( attrName in tag.attributes)
        {
          currentTexture[attrName] = tag.attributes[attrName];
        }
        currentItem = currentTexture;
        console.log("currentTexture",currentTexture);
      break;

      //constellation data
      case 'constellation':
        currentConstellation = new THREE.Object3D();
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
          currentItem[varName]= currentTag.value;  //console.log("currentItem", currentTag, currentTag.parent)
        }
        currentMeta = null;
      break;

      case "object":
        scope._generateObject( currentObject );
        meshes[currentObject._id] = currentObject;
        rootObject.add(currentObject);
        currentObject = null;
      break;

      case "coordinates":
        var vertexCoords = parseVector3(currentTag);

        currentObject.geometry.vertices.push(vertexCoords); 
        currentObject._attributes["position"].push( vertexCoords );
      break;

      case "normal":
        var vertexNormal = parseVector3(currentTag,"n", 1.0);
        currentObject._attributes["normal"].push( vertexNormal );
      break;

      case "color":
      //WARNING !! color can be used not only inside objects but also materials etc
       //order(descending): triangle, vertex, volume, object, material
        var color = parseColor(currentTag);

        if(currentObject && (!currentTriangle)) currentObject._attributes["color"].push( color); //vertex level
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

      
      case "volume"://per volume data (one volume == one three.js mesh)
        currentVolume = null;
      break;

      case "triangle":
        var v1 = parseText( currentTag.v1.value , "v", "int" , 0);
        var v2 = parseText( currentTag.v2.value , "v", "int" , 0);
        var v3 = parseText( currentTag.v3.value , "v", "int" , 0);

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
        var face = new THREE.Face3( v1, v2, v3 , normals);

        //triangle, vertex, volume, object, material
        //set default
        face.color = defaultColor; 
        if( 'materialId' in currentVolume) facesThatNeedMaterial.push({"matId":currentVolume.materialId,"item": face})
        if('color' in currentObject) face.color = currentObject["color"];  
        if('color' in currentVolume) face.color = currentVolume["color"];  
        if('color' in currentTriangle) face.color = currentTriangle["color"] ;
        
        currentTriangle = null;
        currentObject.geometry.faces.push(face);
      break;

      case "edge":
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
          materials[currentMaterial.id] = currentMaterial;
          currentMaterial = null;
      break;
      case "texture":
          currentTexture.imgData = currentTag.value;
          textures[currentTexture.id] = scope._parseTexture(currentTexture);
          currentTexture = null;
      break;
      //constellation
      case "constellation":
          rootObject = currentConstellation;//FIXME: this is a hack
          currentConstellation = null;
      break;
      case "instance":
          var position = parseVector3(currentTag, "delta",0.0);
          var rotation = parseVector3(currentTag, "r", 1.0);

          var objectId= currentObjectInstance.id;
          var meshInstance = meshes[objectId].clone();
			    meshInstance.position.add(position);
				  meshInstance.rotation.set(rotation.x,rotation.y,rotation.z); 
        
          currentConstellation.add(meshInstance);
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
      console.log("error in parser",error);
      throw error;
  }

  parser.onend = function () {// parser stream is done, and ready to have more stuff written to it.
    console.log("THE END");
    //scope._generateScene();
    scope._applyMaterials(materials, textures, meshes,facesThatNeedMaterial);
  };
  parser.write(data).close();

  console.log("unit",unit,"version",version,"objectsIdMap",objectsIdMap);
  //console.log("materials",materials);
  //console.log("meshes",rootObject);
  var seconds = Math.floor((new Date() - startTime) / 1000);
  console.log("parsing time",seconds + "s");

  //TODO:should return multiple datas (parts == model/mesh)
  //return {materials:{}, parts:"",}

  return rootObject;
}

THREE.AMFParser.prototype.unpack = function( data )
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

THREE.AMFParser.prototype.ensureString = function (buf) {

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

THREE.AMFParser.prototype._generateObject = function( object )
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

THREE.AMFParser.prototype._generateScene = function ( ){
  console.log("generating scene");
  // if there is constellation data, don't just add meshes to the scene, but use 
	//the info from constellation to do so (additional transforms)
  return
}

THREE.AMFParser.prototype._applyMaterials = function(materials, textures, meshes, facesThatNeedMaterial)
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

THREE.AMFParser.prototype._parseTexture = function ( textureData ){
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
		var color = new THREE.Color().setRGB( r, g, b );

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
    var coords = new THREE.Vector3(x,y,z);

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

		var uv1 = (u1 !== null && v1 !=null) ? new THREE.Vector2(u1,v1) : null;
		var uv2 = (u2 !== null && v2 !=null) ? new THREE.Vector2(u2,v2) : null; 
	  var uv3 = (u3 !== null && v3 !=null) ? new THREE.Vector2(u3,v3) : null;
		
    var mappingData = {matId:0, uvs:[uv1,uv2,uv3]};
    //currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3]);
    return mappingData;
  }

  function parseExpression( expr)
  {//This is for "maths" expression for materials, colors etc :TODO: implement

  }

if (detectEnv.isModule) module.exports = THREE.AMFParser;
