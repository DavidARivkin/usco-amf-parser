let detectEnv = require("composite-detect")
if(detectEnv.isModule) let JSZip = require( 'jszip' )
if(detectEnv.isModule) let sax = require( 'sax' )

let AMF = function () {

  this.unit = null
  this.version = null

  //letious data 
  let unit = null
  let version = null

  this.rootObject = {}
  this.rootObject.children = []
  this.currentObject = {}
  
  this.materialsById = {}
  
  this.meshes = []
  this.objects = []
  this.textures = []
  this.materials = []
  this.constellations = []
  this.resultContainer = {}
}

AMF.prototype.load = function( data, callback, progressCallback ){
  
  let self = this
  function foo( data )
  {
    console.log("done unpacking data")
    if(progressCallback)
    {
      progressCallback({progress:25})
    }
    
    let parser = sax.parser(true,{trim:true}) // set first param to false for html-mode
    self.setupSax( parser )
    console.log("sax parser setup ok")
    
    let l = data.length, lc = 0, c = 0, chunkSize = l
    let chunk = "" 
  
  parser.onready= function (tag) {
    if( lc<l)
    {
      chunk = data.slice(lc, lc += chunkSize)
      parser.write( chunk ).close()
    }
    else
    {
      if(callback)
      {
        self.resultContainer.meshes = self.meshes
        self.resultContainer.objects = self.objects
        self.resultContainer.textures = self.textures
        self.resultContainer.materials = self.materials
        self.resultContainer.constellations = self.constellations
        
        if(progressCallback)
        {
          progressCallback({progress:75})
        }
        
        let colorSize = 3
        
        for(let z=0;z<self.objects.length;z++)
        {
          let obj = self.objects[z]
          /*          
          let total = obj._attributes["indices"].length
          let subLng = obj.volumes[0]._attributes["indices"].length
          let start = total- subLng
          //let remains = obj._attributes["indices"].splice(start + 1)
          //obj._attributes["indices"] = remains
          console.log("removing from " + start + " length "+ subLng+" res "+obj._attributes["indices"].length)*/
          let tmpPositions = []
          let tmpIndices= []
          let finalPositions = []
          //obj._attributes["posi"] = []
          
          if(obj._attributes["vcolors"].length==0)
          {
            for(let c = 0;c<obj._attributes["position"].length;c+=3)
            {
              for(let i=0;i<colorSize;i++)
              {
                obj._attributes["vcolors"].push( i )
              }
            }
          }
          let colIndex=0
          for(let x=0;x<obj.volumes.length;x++)
          {
            let vol = obj.volumes[x]
            console.log("volume " + x)
            
            for(let c = 0;c<vol._attributes["indices"].length;c++)
            {
              let iIndex = vol._attributes["indices"][c]
              let index = (iIndex*3)
              
              tmpPositions.push( )
              /*vol._attributes["position"].push( obj._attributes["position"][index] )
              vol._attributes["position"].push( obj._attributes["position"][index+1] )
              vol._attributes["position"].push( obj._attributes["position"][index+2] )*/
              
              /*tmpPositions.push( obj._attributes["position"][index] )
              tmpPositions.push( obj._attributes["position"][index+1] )
              tmpPositions.push( obj._attributes["position"][index+2] )*/
            }
                      
            
            //get vertex index, apply color//update existing color
            if(vol.materialId)
            {
              let material = self.materialsById[vol.materialId]
              if(material.color)
              {
                 let color = material.color
                 if(x == 1) color = [1,0,0,1]
                 
                 for(let c = 0;c<vol._attributes["indices"].length;c++)
                  {
                    let iIndex=vol._attributes["indices"][c]
                    index = (iIndex*colorSize)
                    if(index<0) index=0
                    obj._attributes["vcolors"][index] = color[0]
                    obj._attributes["vcolors"][index+1] = color[1]
                    obj._attributes["vcolors"][index+2] = color[2]
                    //obj._attributes["vcolors"][index+3] = color[3]
                  }
              }
            }
          }
          //self.generateObject()
          //obj._attributes["position"] = tmpPositions
          //obj._attributes["position"] = finalPositions
          //obj._attributes["indices"] = tmpIndices
        }
        
        
        console.log("DONE PARSING, result:",self.resultContainer) 
        callback( self.resultContainer )
      }
    }
  }
  chunk = data.slice(lc, lc += chunkSize)
  parser.write( chunk ).close()
  }
  console.log("before unpack")
  let data = this.unpack(data, foo)
}




AMF.prototype._generateObject = function( object )
{
    if(this.recomputeNormals)
	  {
		  //TODO: only do this, if no normals were specified???
		  object.geometry.computeFaceNormals()
		  object.geometry.computeVertexNormals()
	  }
	  //object.geometry.computeBoundingBox()
	  //object.geometry.computeBoundingSphere()

    let color = this.defaultColor 
	  /*let meshMaterial = new this.defaultMaterialType(
	  { 
      color: color,
		  //vertexColors: THREE.VertexColors, //TODO: add flags to dertermine if we need vertex or face colors
      //vertexColors: THREE.FaceColors,
      specular: this.defaultSpecular,
      shininess: this.defaultShininess,
		  shading: this.defaultShading
	  } )

    object.material = meshMaterial*/
    //console.log("finished Object / THREE.Mesh",currentObject)
}

AMF.prototype.setupSax = function( parser )
{

  let currentTag = null
  let currentItem = null//pointer to currently active item/tag etc

  let currentColor = null
  //
  let currentMaterial = null
  //
  let currentObject   = null
  let currentGeometry = null
  let currentVolume   = null
  let currentTriangle = null
  let currentVertex   = null
  let currentEdge = null

  let currentTexMap = null
  let currentTexture = null

  //logical grouping
  let currentConstellation = null
  let currentObjectInstance = null

//TODO: oh ye gad's need to find a cleaner solution
  let facesThatNeedMaterial = []

  //copy settings to local scope
  let defaultColor = this.defaultColor
	let defaultVertexNormal = this.defaultVertexNormal
	let recomputeNormals = this.recomputeNormals

   //storage / temporary storage
  //map amf object ids to our UUIDS
  let objectsIdMap = {}
  let objects = []

  let meshes = {}
  let textures = {}
  let materials = {}

  let scope = this  
  let rootObject = this.rootObject
  
  parser.onopentag = function (tag) {
    // opened a tag.  node has "name" and "attributes"
    tag.parent = currentTag
    currentTag = tag
    if(tag.parent) tag.parent[tag.name] = tag
  
    switch(tag.name)
    {
      //general
      case 'metadata':
        currentMeta = {}
      break
      case 'amf':
        scope.unit = tag.attributes['unit']
        scope.version = tag.attributes['version']
        currentItem = rootObject
      break

      //geometry
      case 'object':
        currentObject = {}//new THREE.Mesh()
        let id = tag.attributes["id"] || null
        if(id) currentObject._id = id objectsIdMap[id] = currentObject.uuid
        //temp storage:
        currentObject._attributes =  {}
        currentObject._attributes["position"] = []
        currentObject._attributes["normal"] = []
        currentObject._attributes["color"] = []
        currentObject._attributes["indices"] = []
        currentObject._attributes["vcolors"] = []
        currentObject.volumes = []
        currentObject.faceCount = 0

        currentItem = currentObject
      break
      case 'volume':
        currentVolume = {}
        currentVolume._attributes =  {}
        currentVolume._attributes["position"] = []
        currentVolume._attributes["indices"] = []
        currentVolume._attributes["normal"] = []
        currentVolume._attributes["color"] = []
        currentVolume._attributes["indices"] = []
        currentVolume._attributes["vcolors"] = []
        currentVolume.faceCount = 0
        
        
        let materialId = tag.attributes["materialid"] || null
        if(materialId) currentVolume.materialId = parseInt(materialId)
        currentItem = currentVolume
      break
      case 'triangle':
        currentTriangle = {}
        currentObject.faceCount +=1 
      break
      case 'edge':
        currentEdge = {}
      break
      //materials and textures
      case 'material':
        currentMaterial = {}
        let id = tag.attributes["id"] || null
        if(id) currentMaterial.id = parseInt(id)

        currentItem = currentMaterial
      break
      case 'texture':
        currentTexture = {}
        for( attrName in tag.attributes)
        {
          currentTexture[attrName] = tag.attributes[attrName]
        }
        currentItem = currentTexture
      break

      //constellation data
      case 'constellation':
        currentConstellation = {}
        currentConstellation.children=[]
        let id = tag.attributes["id"] || null
        if(id) currentConstellation._id = id
      break
      case 'instance':
        currentObjectInstance = {}
        let id = tag.attributes["objectid"] || null
        if(id) currentObjectInstance.id = id
      break
    }
  }
  parser.onclosetag = function (tag) {
    switch(currentTag.name)
    {
      case "metadata":
        if( currentItem )
        {
          let letName = currentTag.attributes["type"].toLowerCase()
          currentItem[letName]= currentTag.value
          console.log("currentItem", currentTag, letName)
        }
        currentMeta = null
      break

      case "object":
        scope._generateObject( currentObject )
        meshes[currentObject._id] = currentObject
        scope.objects.push( currentObject )
        scope.meshes.push( currentObject )
        console.log("object done")
        currentObject = null
      break

      case "volume"://per volume data (one volume == one three.js mesh)
        currentObject.volumes.push( currentVolume )
        currentVolume = null
      break
      
      case "coordinates":
        let vertexCoords = parseVector3(currentTag)
        currentObject._attributes["position"].push( vertexCoords[0],vertexCoords[1],vertexCoords[2] )
      break

      case "normal":
        let vertexNormal = parseVector3(currentTag,"n", 1.0)
        currentObject._attributes["normal"].push( vertexNormal[0],vertexNormal[1],vertexNormal[2] )
      break

      case "color":
      //WARNING !! color can be used not only inside objects but also materials etc
       //order(descending): triangle, vertex, volume, object, material
        let color = parseColor(currentTag)

        if(currentObject && (!currentTriangle))  currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] )//vertex level
        //if(currentObject) currentObject["color"]=  color //object level
        if(currentVolume) currentVolume["color"] = color
        if(currentTriangle) currentTriangle["color"] = color
        if(currentMaterial) currentMaterial["color"] = color
      break

       case "map":
        for( attrName in currentTag.attributes)
        {
          currentTag[attrName] = currentTag.attributes[attrName]
        }
        let map = parseMapCoords( currentTag )
        //console.log("closing map", currentTag)
      break

      case "triangle":
        let v1 = parseText( currentTag.v1.value ,"int" , 0)
        let v2 = parseText( currentTag.v2.value ,"int" , 0)
        let v3 = parseText( currentTag.v3.value ,"int" , 0)
        currentObject._attributes["indices"].push( v1, v2, v3 )
        currentVolume._attributes["indices"].push( v1, v2, v3 )

        let colorData = currentObject._attributes["color"]
        if(colorData.length>0)
        {
          let colors = [colorData[v1] ,colorData[v2], colorData[v3]]
        }
        else
        {
          let colors = [defaultColor,defaultColor, defaultColor]
        }
        let normalData = currentObject._attributes["normal"]
        if(normalData.length>0)
        {
          let normals = [normalData[v1],normalData[v2],normalData[v3]]
        }
        else
        {
          let normals = [defaultVertexNormal,defaultVertexNormal, defaultVertexNormal]
        }
        //a, b, c, normal, color, materialIndex
        /*let face = new THREE.Face3( v1, v2, v3 , normals)
        //triangle, vertex, volume, object, material
        //set default
        face.color = defaultColor 
        if( 'materialId' in currentVolume) facesThatNeedMaterial.push({"matId":currentVolume.materialId,"item": face})
        if('color' in currentObject) face.color = currentObject["color"]  
        if('color' in currentVolume) face.color = currentVolume["color"]  
        if('color' in currentTriangle) face.color = currentTriangle["color"] 
        
        currentTriangle = null
        //FIXME:
        //currentObject.geometry.faces.push(face)
        */
        let color = [0,0,0,1]
        if('color' in currentTriangle) {
        color = currentTriangle["color"]
                currentObject._attributes["vcolors"].push( color[0],color[1],color[2],color[3] )
        }

        
      break

      case "edge":
        console.log("getting edge data")
        //Specifies the 3D tangent of an object edge between two vertices 
        //higher priority than normals data
        let v1 = parseText( currentTag.v1.value , "v", "int" , null)
        let v2 = parseText( currentTag.v2.value , "v", "int" , null)

        let dx1 = parseText( currentTag.dx1.value , "d", "int" , 0)
        let dy1 = parseText( currentTag.dy1.value , "d", "int" , 0)
        let dz1 = parseText( currentTag.dz1.value , "d", "int" , 0)

        let dx2 = parseText( currentTag.dx2.value , "d", "int" , 0)
        let dy2 = parseText( currentTag.dy2.value , "d", "int" , 0)
        let dz2 = parseText( currentTag.dz2.value , "d", "int" , 0)

        console.log("built edge v1", v1,dx1, dy1, dz1 ,"v2",v2,dx2, dy2, dz2)
        currentEdge = null
      break

      //materials and textures    
      case "material":
          console.log("getting material data")
          scope.materialsById[currentMaterial.id] = currentMaterial
          scope.materials.push( currentMaterial )
          currentMaterial = null
      break
      case "texture":
          console.log("getting texture data")
          currentTexture.imgData = currentTag.value
          textures[currentTexture.id] = scope._parseTexture(currentTexture)
          currentTexture = null
      break
      //constellation
      case "constellation":
          scope.constellations.push( currentConstellation )
          console.log("done with constellation")
          currentConstellation = null
      break
      case "instance":
          let position = parseVector3(currentTag, "delta",0.0)
          let rotation = parseVector3(currentTag, "r", 1.0)

          let objectId= currentObjectInstance.id
          let meshInstance = meshes[objectId]
				  let meshInstanceData = {instance:meshInstance,pos:position,rot:rotation}
          currentConstellation.children.push( meshInstanceData )
          currentObjectInstance = null
          //console.log("closing instance",objectId, "posOffset",position,"rotOffset",rotation)
      break

    }
    currentItem = null
    if (currentTag && currentTag.parent) {
      let p = currentTag.parent
      delete currentTag.parent
      currentTag = p
    }
  }

  parser.onattribute = function (attr) {
    // an attribute.  attr has "name" and "value"
    //if(currentItem) console.log("currentItem + attr",currentItem, attr)
    if(currentItem) currentItem[attr.name]= attr.value
  }
  parser.ontext = function (text) {
    if (currentTag) currentTag.value = text
    //if (currentTag && currentTag.parent) currentTag.parent.value = text
    //console.log("text", currentTag.parent)
  }

  parser.onerror = function(error)
  { 
      console.log("error in parser")
      //console.log(error)
      //throw error
      parser.resume()
  }

  /*parser.onend = function () {// parser stream is done, and ready to have more stuff written to it.
    console.log("THE END")
    //scope._generateScene()
    //scope._applyMaterials(materials, textures, meshes,facesThatNeedMaterial)
  }*/
}




///

AMF.prototype._applyMaterials = function(materials, textures, meshes, facesThatNeedMaterial)
{//since materials are usually defined after objects/ volumes, we need to apply
  //materials to those that need them
  for(let i = 0 ; i<facesThatNeedMaterial.length; i++)
  {
      let curFace = facesThatNeedMaterial[i]
      let mat = materials[curFace.matId]
      curFace.item.color = mat.color
      curFace.item.vertexColors = []
      //console.log("curFace",curFace.item)
  }

  /*
  if(Object.keys(this.textures).length>0)
	{
		let materialArray = []
		for (let textureIndex in textures)
		{
			let texture = this.textures[textureIndex]
			materialArray.push(new THREE.MeshBasicMaterial({
				map: texture,
				color: color,
				vertexColors: THREE.VertexColors
				}))
    }
    currentMaterial = new THREE.MeshFaceMaterial(materialArray)
  }*/
}

module.exports = AMF
