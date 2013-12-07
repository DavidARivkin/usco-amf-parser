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
*/

var isNode = 
    typeof global !== "undefined" && 
    {}.toString.call(global) == '[object global]';


if(isNode) THREE = require( 'three' ); 
if(isNode) JSZip = require( 'jszip' );

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

  var data = this.unpack(data);
  var rootObject = new THREE.Object3D();//TODO: change storage of data : ie don't put everything under a single object
  rootObject.name = "rootScene";


  var sax = require("sax"),
  strict = true, // set to false for html-mode
  parser = sax.parser(strict,{trim:true});

  //various data 
  var unit = null;
  var version = null;

  var objects = [];
  
  var meshes = [];//temporary storage
	
	//this.textures = this._parseTextures( root );
	//this.materials = this._parseMaterials( root ); 
  
  var currentTag = null;
  var currentItem = null;//pointer to currently active item/tag etc

  var currentColor = null;
  var currentVertex = null;

  var currentGeometry=null;
  
  var currentVolume = null;
  ///

  parser.onerror = function (e) {
    // an error happened.
    console.log("parser error")
  };
  parser.ontext = function (t) {
    // got some text.  t is the string of text.
    //console.log("text",t)
  };
  parser.onclosetag = function (tag) {
    //console.log("closing tag" ,tag)
    //console.log("parent",currentTag.parent.name)
    if(currentTag.name == "object")
    {
      meshes.push(currentObject);
      rootObject.add(currentObject);
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
      var r = parseText( currentTag.r.value , "r", "float" , 0.0);
      var g = parseText( currentTag.g.value , "g", "float" , 0.0);
      var b = parseText( currentTag.b.value , "b", "float" , 0.0);
      var a = parseText( currentTag.a.value , "a", "float" , 1.0);
      var vertexColor = new THREE.Color().setRGB( r, g , b );
      currentObject._attributes["color"].push( vertexColor);
    }

    if(currentTag.name == "metadata")
    {
      //console.log("meta",currentTag.attributes["type"],currentTag.value);

      var type = currentTag.attributes["type"];
      currentItem[type] = currentTag.value;
      //need to have a generic "current item "?
      
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

      //TODO: handle default values 
      var colorData = currentObject._attributes["color"];
      var colors = [(colorData[v1] || this.defaultColor),colorData[v2],colorData[v3]];

      var normalData = currentObject._attributes["normal"];
      var normals = [normalData[v1],normalData[v2],normalData[v3]];

      var face = new THREE.Face3( v1, v2, v3 , normals, colors);
    
      //console.log("face",face);
      //a, b, c, normal, color, materialIndex
      currentObject.geometry.faces.push(face);
    }

    if (currentTag && currentTag.parent) {
      var p = currentTag.parent
      delete currentTag.parent
      currentTag = p
    }

  }
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
    }
  
  };
  parser.onattribute = function (attr) {
    // an attribute.  attr has "name" and "value"
    //console.log("attribute",attr)
  };
  parser.ontext = function (text) {
    //if (currentTag) currentTag.children.push(text)
    if (currentTag) currentTag.value = text
    if (currentTag && currentTag.parent)
    {
    }
  }


  parser.onend = function () {
    // parser stream is done, and ready to have more stuff written to it.
    //console.log("THE END")
  };
  parser.write(data).close();

  console.log("unit",unit,"version",version);
  //console.log("meshes",rootObject);
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


THREE.AMFParser.prototype.createVertex = function(data)
{
	
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


THREE.AMFParser.prototype._parseObjects = function ( root ){

	var objectsData = root.getElementsByTagName("object");
	
	var meshes = {};//temporary storage
	
	this.textures = this._parseTextures( root );
	this.materials = this._parseMaterials( root ); 
	
	for (var i=0; i< objectsData.length ; i++)
	{
		var objectData = objectsData[i];
		
		var objectId = objectData.attributes.getNamedItem("id").nodeValue;
		//console.log("object id", objectId);
		
		var geometry = this._parseGeometries(objectData);
		var volumes = this._parseVolumes(objectData, geometry);
		///////////post process
		var currentGeometry = geometry["geom"];
		var volumeColor = new THREE.Color("#ffffff");
		var color = volumeColor !== null ? volumeColor : new THREE.Color("#ffffff");

		//console.log("color", color);
		var currentMaterial = new THREE.MeshLambertMaterial(
		{ 	color: color,
			vertexColors: THREE.VertexColors,
			shading: THREE.FlatShading
		} );
		
		//TODO: do this better
		if(Object.keys(this.textures).length>0)
		{
			var materialArray = [];
			for (var textureIndex in this.textures)
			{
				var texture = this.textures[textureIndex];
				materialArray.push(new THREE.MeshBasicMaterial({
					map: texture,
					color: color,
					vertexColors: THREE.VertexColors
					}));
			}
			console.log("bleh");
			currentMaterial = new THREE.MeshFaceMaterial(materialArray);
		}
		
		//currentMaterial = new THREE.MeshNormalMaterial();
		var currentMesh = new THREE.Mesh(currentGeometry, currentMaterial);
	
		if(this.recomputeNormals)
		{
			//TODO: only do this, if no normals were specified???
			currentGeometry.computeFaceNormals();
			currentGeometry.computeVertexNormals();
		}
		currentGeometry.computeBoundingBox();
		currentGeometry.computeBoundingSphere();
		
		//add additional data to mesh
		var metadata = parseMetaData( objectData );
		//console.log("meta", metadata);
		//add meta data to mesh
		if('name' in metadata)
		{
			currentMesh.name = metadata.name;
		}
		
		meshes[objectId] = currentMesh
		//cleanup
		geometry = null;
	}
	
	
	return this._generateScene(root, meshes);
}


THREE.AMFParser.prototype._parseGeometries = function (object){
	//get geometry data
	
	var attributes = {};
	
	attributes["position"] = [];
	attributes["normal"] = [];
	attributes["color"] = [];
	 
	var objectsHash = {}; //temporary storage of instances helper for amf
		var currentGeometry = new THREE.Geometry();		

		var meshData = object.getElementsByTagName("mesh")[0]; 
		
		//get vertices data
		var verticesData = meshData.getElementsByTagName("vertices"); 
		for (var j=0;j<verticesData.length;j++)
		{
			var vertice = verticesData[j];
			var vertexList = vertice.getElementsByTagName("vertex");
			for (var u=0; u<vertexList.length;u++)
			{
				var vertexData = vertexList[u];
				//get vertex data
				var vertexCoords = parseCoords( vertexData );
				var vertexNormals = parseNormals( vertexData , this.defaultVertexNormal);
				var vertexColor = parseColor( vertexData , this.defaultColor);
				
				attributes["position"].push(vertexCoords);
				attributes["normal"].push(vertexNormals);
				attributes["color"].push(vertexColor);
				
				currentGeometry.vertices.push(vertexCoords);
			}

			//get edges data , if any
			/* meh, kinda ugly spec to say the least
			var edgesList = vertice.getElementsByTagName("edge");
			for (var u=0; u<edgesList.length;u++)
			{
				var edgeData = edgesList[u];
			}*/
			
		}
	
	return {"geom":currentGeometry,"attributes":attributes};
}


THREE.AMFParser.prototype._parseVolumes = function (meshData, geometryData){
	//get volumes data
	var currentGeometry = geometryData["geom"]
	var volumesList = meshData.getElementsByTagName("volume");
	//console.log("    volumes:",volumesList.length);
	
	for(var i=0; i<volumesList.length;i++)
	{
		var volumeData = volumesList[i];//meshData.getElementsByTagName("volume")[0]; 
	
		//var colorData = meshData.getElementsByTagName("color");
		var volumeColor = parseColor(volumeData);
		
		var materialId = volumeData.attributes.getNamedItem("materialid")
		var materialColor = null;
		if (materialId !== undefined && materialId !== null)
		{
			materialId=materialId.nodeValue;
			var materialColor = this.materials[materialId].color;
			//console.log("volumeMaterial",materialId,"color",materialColor);
		}
		
		
		var trianglesList = volumeData.getElementsByTagName("triangle"); 
		for (var j=0; j<trianglesList.length; j++)
		{
			var triangle = trianglesList[j];
	
			//parse indices
			var v1 = parseTagText( triangle , "v1", "int");
			var v2 = parseTagText( triangle , "v2", "int");
			var v3 = parseTagText( triangle , "v3", "int");
			
			var face = new THREE.Face3( v1, v2, v3 ) 
			currentGeometry.faces.push( face );
			//console.log("v1,v2,v3,",v1,v2,v3);
			
			var colors = geometryData["attributes"]["color"];
			var vertexColors = [colors[v1],colors[v2],colors[v3]];
			
			//add vertex indices to current geometry
			//THREE.Face3 = function ( a, b, c, normal, color, materialIndex )
			//var faceColor = colorData
			
	
			var faceColor = parseColor(triangle);
			
			
			//TODO: fix ordering of color priorities
			//triangle/face coloring
			if (faceColor !== null)
			{
				//console.log("faceColor", faceColor);
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = faceColor;
				}
			}
			else if (volumeColor!=null)
			{
				//console.log("volume color", volumeColor);
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = volumeColor;
				}
			}//here object color
			else if (materialColor != null)
			{
				for( var v = 0; v < 3; v++ )  
				{
				    face.vertexColors[ v ] = materialColor;
				}
			}
			else
			{
				//console.log("vertexColors", vertexColors);
				face.vertexColors = vertexColors;
			}
			//normals
			var bla = geometryData["attributes"]["normal"];
			var vertexNormals = [bla[v1],bla[v2],bla[v3]];
			face.vertexNormals = vertexNormals;
			//console.log(vertexNormals);
			
			
			//get vertex UVs (optional)
			var mapping = triangle.getElementsByTagName("map")[0];
			if (mapping !== null && mapping !== undefined)
			{
				var rtexid = mapping.attributes.getNamedItem("rtexid").nodeValue;
				var gtexid = mapping.attributes.getNamedItem("gtexid").nodeValue;
				var btexid = mapping.attributes.getNamedItem("btexid").nodeValue;
				//console.log("textures", rtexid,gtexid,btexid);
				
				face.materialIndex  = rtexid;
				face.materialIndex  = 0;
				
				var u1 = mapping.getElementsByTagName("u1")[0].textContent;
				u1 = parseFloat(u1);
				var u2 = mapping.getElementsByTagName("u2")[0].textContent;
				u2 = parseFloat(u2);
				var u3 = mapping.getElementsByTagName("u3")[0].textContent;
				u3 = parseFloat(u3);
				
				var v1 = mapping.getElementsByTagName("v1")[0].textContent;
				v1 = parseFloat(v1);
				var v2 = mapping.getElementsByTagName("v2")[0].textContent;
				v2 = parseFloat(v2);
				var v3 = mapping.getElementsByTagName("v3")[0].textContent;
				v3 = parseFloat(v3);
				
				var uv1 = new THREE.Vector2(u1,v1);
				var uv2 = new THREE.Vector2(u2,v2);
				var uv3 = new THREE.Vector2(u3,v3);
				currentGeometry.faceVertexUvs[ 0 ].push( [uv1,uv2,uv3]);
				//currentGeometry.faceVertexUvs[ 0 ].push( [new THREE.Vector2(1,1),new THREE.Vector2(0,1),new THREE.Vector2(1,0)]);
				//this.threeMaterials = []
				//for (var i=0; i< textures.length;i++)
			}
		}
	}
}


THREE.AMFParser.prototype._parseTextures = function ( node ){
	//get textures data
	var texturesData = node.getElementsByTagName("texture");
	var textures = {};
	if (texturesData !== undefined)
	{
		for (var j=0; j<texturesData.length; j++)
		{
			var textureData = texturesData[ j ];
			var rawImg = textureData.textContent;
			//cannot use imageLoader as it implies a seperate url
			//var loader = new THREE.ImageLoader();
			//loader.load( url, onLoad, onProgress, onError )
			var image = document.createElement( 'img' );
			rawImg = 'data:image/png;base64,'+btoa(rawImg);
			//console.log(rawImg);
			
			//
			rawImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAAB90RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgOLVo0ngAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDUvMjgvMTGdjbKfAAABwklEQVQ4jdXUsWrjQBCA4X+11spikXAEUWdSuUjh5goXx1V5snu4kMLgyoEUgYNDhUHGsiNbCK200hWXFI7iOIEUd9Mu87E7MzsC6PjCcL4S+z/AwXuHQgg8T6GUi+MI2rbDmJqqMnTd26U/CXqeRxD4aO2ilIOUAms7jGkpipr9vqSqqo+BnudxcaEZjRRx7DIeK7SWFIUlSQxpKhkMHLZbemgPFEIQBD6jkeL62mc2u2QyuSIMA/J8z+Pjb+bzNQ8P0DTtedDzFFq7xLHLbHbJzc0PptPv+H5EWWYsl3fALZvNirK05LnCGHMaVOpvzcZjxWRy9Yx9A2J8P2U6hSRJuL/fsFoZhsNjsDc2jiOQUqC1JAwDfD8CYkA/oxFhGKC1REqB44jj/Ndg23ZY21EUljzfU5YZkAIFkFKWGXm+pygs1nbUdXOUL4Gfr5vi+wohBFFk0VoQRQNcN6Msf7Fc3rFYLFksnsiymu22oG3b0zWsKkNR1KSpZD5fA7ckSdLrcprWHA6Gpjm+oeCNbXN+Dmt2O8N6/YS19jz4gp76KYeDYbc79LB3wZdQSjEcKhxHUNcNVVX3nvkp8LPx7+/DP92w3rYV8ocfAAAAAElFTkSuQmCC';
			
			image.src = rawImg;
			var texture = new THREE.Texture( image );
			texture.sourceFile = '';
			texture.needsUpdate = true;

			//console.log("loaded texture");
			var textureId = textureData.attributes.getNamedItem("id").nodeValue;
			var textureType = textureData.attributes.getNamedItem("type").nodeValue;
			var textureTiling= textureData.attributes.getNamedItem("tiled").nodeValue
			textures[textureId] = texture;
		}
	}
	return textures;
}

THREE.AMFParser.prototype._parseMaterials = function ( node ){
	
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

THREE.AMFParser.prototype._generateScene = function(root, meshes){
	
	// if there is constellation data, don't just add meshes to the scene, but use 
	//the info from constellation to do so (additional transforms)
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

	function parseTagText_old( node , name, toType , defaultValue)
	{
		defaultValue = defaultValue || null;
		
		var value = node.getElementsByTagName(name)[0]
		

		if( value !== null && value !== undefined )
		{
			value=value.textContent;
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
