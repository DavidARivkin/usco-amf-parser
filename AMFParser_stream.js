/**
 * @author kaosat-dev
 *
 * Description: A THREE loader for AMF files (3d printing, cad, sort of a next gen stl).
 * Features:
 * * supports both zipped and uncompressed amf files
 * * supports almost 100 % of the amf spec : objects, colors, textures, materials , constellations etc
 *
 * Limitations:
 * 	performance / memory usage is really bad for large files
 * 	Still some minor issues with color application ordering (see AMF docs)
 * 	
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

//TODO???: add magic number detection to determine if file is a zip file or not
//see here : http://en.wikipedia.org/wiki/List_of_file_signatures

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

var isNode = 
    typeof global !== "undefined" && 
    {}.toString.call(global) == '[object global]';


if(isNode) THREE = require( 'three' ); 
if(isNode) JSZip = require( 'jszip' );
if(isNode) var sax = require( 'sax' );


THREE.AMFParser = function () {
	this.defaultColor = new THREE.Color( "#cccccc" );
	this.defaultVertexNormal = new THREE.Vector3( 1, 1, 1 );
	this.recomputeNormals = true;
};

THREE.AMFParser.prototype = {

	constructor: THREE.AMFParser

};

THREE.AMFParser.prototype.parse = function(data)
{
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

  var objects = [];
  
  var meshes = [];//temporary storage
  
  var currentTag = null;
  var currentItem = null;//pointer to currently active item/tag etc

  var currentColor = null;
  var currentVertex = null;

  var currentGeometry=null;
  
  var currentVolume = null;


  var currentMaterial = null;
  //storage
  //this.textures = this._parseTextures( root );
	//this.materials = this._parseMaterials( root ); 
  var materials = {};

  //copy settings to local scope
  var defaultColor = this.defaultColor;
	var defaultVertexNormal = this.defaultVertexNormal;
	var recomputeNormals = this.recomputeNormals;
  
  var currentFaceData = null;
  //
  parser.onopentag = function (tag) {
    // opened a tag.  node has "name" and "attributes"
    tag.parent = currentTag;
    //tag.children = [];
    //tag.parent && tag.parent.children.push(tag);
    currentTag = tag;
    if(tag.parent) tag.parent[tag.name] = tag;
  
    switch(tag.name)
    {
      case 'amf':
        unit = tag.attributes['unit'];
        version = tag.attributes['version'];
        currentItem = rootObject;
      break;
      case 'object':
        currentObject = new THREE.Mesh();
        currentObject._id = tag.attributes["id"] || null;
        currentObject.geometry = new THREE.Geometry();//TODO: does this not get auto created ???

        //temp storage:
        currentObject._attributes =  {};
        currentObject._attributes["position"] = [];
        currentObject._attributes["normal"] = [];
        currentObject._attributes["color"] = [];

        currentItem = currentObject;
      break;
      case 'volume':
        //currentVolume = new THREE.Geometry();
      break;
      case 'triangle':
        currentFaceData = {}
        //currentTriangle = 
      break;

      case 'material':
        currentMaterial = {};
        currentItem = currentMaterial;
      break;
      case 'metadata':
        currentMeta = {};
      break;
    }
  };
  parser.onclosetag = function (tag) {
    //console.log("closing tag" ,tag)
    //console.log("parent",currentTag.parent.name)
    if(currentTag.name == "object")
    {
      meshes.push(currentObject);
      rootObject.add(currentObject);
      if(recomputeNormals)
		  {
			  //TODO: only do this, if no normals were specified???
			  currentObject.geometry.computeFaceNormals();
			  currentObject.geometry.computeVertexNormals();
		  }
		  currentObject.geometry.computeBoundingBox();
		  currentObject.geometry.computeBoundingSphere();

      //var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");
      var color = new THREE.Color("#ffffff");

		  //console.log("color", color);
		  var MeshMaterial = new THREE.MeshLambertMaterial(
		  { 	color: color,
			  //vertexColors: THREE.VertexColors,
        vertexColors: THREE.FaceColors,
			  shading: THREE.FlatShading
		  } );
      currentObject.material = MeshMaterial;
      //console.log("finished Object / THREE.Mesh",currentObject)
      currentObject = null;
    }

    //lower level
    if(currentTag.name == "coordinates")
    {
      var x = parseText( currentTag.x.value , "x", "float" , 0.0);
      var y = parseText( currentTag.y.value , "y", "float" , 0.0);
      var z = parseText( currentTag.z.value , "z", "float" , 0.0);
      var vertexCoords = new THREE.Vector3(x,y,z);
      currentObject.geometry.vertices.push(vertexCoords); 
      currentObject._attributes["position"].push( vertexCoords );
    }

    if(currentTag.name == "normal")
    {
      var x = parseText( currentTag.nx.value , "x", "float" , 1.0);
      var y = parseText( currentTag.ny.value , "y", "float" , 1.0);
      var z = parseText( currentTag.nz.value , "z", "float" , 1.0);
      var vertexNormal = new THREE.Vector3(x,y,z);
      currentObject._attributes["normal"].push( vertexNormal );
    }

    if(currentTag.name == "color")
    {
      //WARNING !! color can be used not only inside objects but also materials etc
      var r = parseText( currentTag.r.value , "r", "float" , 0.0);
      var g = parseText( currentTag.g.value , "g", "float" , 0.0);
      var b = parseText( currentTag.b.value , "b", "float" , 0.0);
      //var a = parseText( currentTag.a.value , "a", "float" , 1.0);
      var vertexColor = new THREE.Color().setRGB( r, g , b );

      if(currentMaterial) currentMaterial["color"] = vertexColor;
      if(currentFaceData) currentFaceData["color"] = vertexColor;
      if(currentObject && (!currentFaceData)) currentObject._attributes["color"].push( vertexColor);
    }

    //per volume data (one volume == one three.js mesh)
    if(currentTag.name == "volume")
    {
        //console.log("volume");
    }

    if(currentTag.name == "triangle")
    {
      var v1 = parseText( currentTag.v1.value , "v", "int" , 0);
      var v2 = parseText( currentTag.v2.value , "v", "int" , 0);
      var v3 = parseText( currentTag.v3.value , "v", "int" , 0);

      var colorData = currentObject._attributes["color"];
      if(colorData.length>0)
      {
        var colors = [colorData[v1] ,colorData[v2], colorData[v3]];
        console.log("colors",colors)
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

      var face = new THREE.Face3( v1, v2, v3 , normals, colors);

      //console.log("face color",currentFaceData["color"])
      if('color' in currentFaceData) face.color.setRGB( currentFaceData["color"].r, currentFaceData["color"].g, currentFaceData["color"].b );
      //a, b, c, normal, color, materialIndex
      
      //TODO: fix hack
      currentFaceData = null;
  
      currentObject.geometry.faces.push(face);
    }
    
    if(currentTag.name == "material")
    {
        console.log("material",currentMaterial)
        currentMaterial = null;
     }

    if(currentTag.name == "metadata")
    {
      console.log("currentMeta",currentMeta)
      if( currentItem )
      {
        //console.log("currentItem",typeof (currentItem))
        var varName = currentTag.attributes["type"].toLowerCase();
        currentItem[varName]= currentTag.value;
      }
      currentMeta = null;

      console.log("meta",currentTag.attributes["type"],currentTag.value);
      //var type = currentTag.attributes["type"];
      //currentItem[type] = currentTag.value;
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
  
    if(currentItem) console.log("currentItem + attr",currentItem, attr)
    if(currentItem) currentItem[attr.name]= attr.value;
  };
  parser.ontext = function (text) {
    if (currentTag) currentTag.value = text
  }

  parser.onerror = function(error)
  { 
      console.log("error in parser",error)
  }

  var self = this;
  parser.onend = function () {
    // parser stream is done, and ready to have more stuff written to it.
    console.log("THE END");
    self._generateScene();
  };
  parser.write(data).close();

  console.log("unit",unit,"version",version);
  //console.log("meshes",rootObject);
  var seconds = Math.floor((new Date() - startTime) / 1000);
  console.log("parsing time",seconds + "s");
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
      if( entry._data !== null && entry !== undefined)
      {
        var rawData = entry.asText()
        return rawData;
      }
   }
  }
    catch(error)
  {
     return this.ensureString(data);
  }

  //1F 9D
  //1F A0
  //50 4B 03 04, 50 4B 05 06 (empty archive) or 50 4B 07 08 (spanned archive)

  //TODO: get binary see http://stackoverflow.com/questions/327685/is-there-a-way-to-read-binary-data-in-javascript
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


THREE.AMFParser.prototype._generateScene = function ( ){
  console.log("generating scene");

  // if there is constellation data, don't just add meshes to the scene, but use 
	//the info from constellation to do so (additional transforms)
  return
	var scene = this._parseConstellation( root, meshes );
	if (scene == null)
	{
		scene = new THREE.Object3D(); //storage of actual objects /meshes
		for (var meshIndex in meshes)
		{
			var mesh = meshes[meshIndex];
			scene.add( mesh );
		}
	}
	return scene;

}



THREE.AMFParser.prototype._parseMaterials = function ( node ){
	console.log("gne")
	var materialsData = node.getElementsByTagName("material");
	var materials = {};
	if (materialsData !== undefined)
	{
		for (var j=0; j<materialsData.length; j++)
		{
			var materialData = materialsData[ j ];
			var materialId = materialData.attributes.getNamedItem("id").nodeValue;
			var materialMeta = parseMetaData( materialData )
			var materialColor = parseColor(materialData);
			//console.log("material id", materialId, "color",materialColor );
			materials[materialId] = {color:materialColor}
		}
	}
	return materials;
}


THREE.AMFParser.prototype._parseConstellation = function ( root, meshes ){
	//parse constellation / scene data
	var constellationData = root.getElementsByTagName("constellation"); 
	var scene = null; 
	if (constellationData !== undefined && constellationData.length!==0)
	{
		scene = new THREE.Object3D();
		for (var j=0; j<constellationData.length; j++)
		{
			var constellationData = constellationData[ j ];
			var constellationId = constellationData.attributes.getNamedItem("id").nodeValue;
			
			var instancesData = constellationData.getElementsByTagName("instance");

			if (instancesData !== undefined)
			{
				for (var u=0; u<instancesData.length; u++)
				{
					var instanceData = instancesData[ u ];
					var objectId = instanceData.attributes.getNamedItem("objectid").nodeValue;
			
					var position = parseVector3(instanceData, "delta");
					var rotation = parseVector3(instanceData, "r");
					//console.log("target object",objectId, "position",position, "rotatation", rotation)
					
					var meshInstance = meshes[objectId].clone();
					meshInstance.position.add(position);
					
					meshInstance.rotation.set(rotation.x,rotation.y,rotation.z); 
					
					//we add current mesh to scene
					scene.add(meshInstance);
				}
			}
		}
	}
	return scene;
}



function parseMetaData( node )
	{
		var metadataList = node.getElementsByTagName("metadata");
		var result = {};
		for (var i=0; i<metadataList.length;i++)
		{
			var current = metadataList[i];
			if (current.parentNode == node)
			{
				var name = current.attributes.getNamedItem("type").nodeValue;
				var value = current.textContent;
				result[name] = value;
			}
		}
		return result;
	}

  function parseText( value , name, toType , defaultValue)
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
		var colorNode = node.getElementsByTagName("color")[0];//var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");
		var color = defaultValue || null;
		
		if (colorNode !== null && colorNode !== undefined)
		{
			if (colorNode.parentNode == node)
			{
			var r = parseTagText( node , "r", "float");
			var g = parseTagText( node , "g", "float");
			var b = parseTagText( node , "b", "float");
			var color = new THREE.Color().setRGB( r, g, b );
			}
		}	
		return color;
	}

	function parseVector3( node, prefix )
	{
		var coords = null;
		
		var x = parseText( node , prefix+"x", "float") || 0;
		var y = parseText( node , prefix+"y", "float") || 0;
		var z = parseText( node , prefix+"z", "float") || 0;
		var coords = new THREE.Vector3(x,y,z);
		return coords;
	}

	function parseCoords( node )
	{
		var coordinatesNode = node.getElementsByTagName("coordinates")[0];
		var coords = null;
		
		if (coordinatesNode !== null && coordinatesNode !== undefined)
		{
			if (coordinatesNode.parentNode == node)
			{
			var x = parseTagText( node , "x", "float");
			var y = parseTagText( node , "y", "float");
			var z = parseTagText( node , "z", "float");
			var coords = new THREE.Vector3(x,y,z);
			}
		}	
		return coords;
	}
	
	function parseNormals( node, defaultValue )
	{
		//get vertex normal data (optional)
		var normalsNode = node.getElementsByTagName("normal")[0];
		var normals = defaultValue || null;;
		
		if (normalsNode !== null && normalsNode !== undefined)
		{
			if (normalsNode.parentNode == node)
			{
			var x = parseTagText( node , "nx", "float");
			var y = parseTagText( node , "ny", "float");
			var z = parseTagText( node , "nz", "float");
			var normals = new THREE.Vector3(x,y,z);
			}
		}	
		return normals;
	}

if (isNode) module.exports = THREE.AMFParser;
