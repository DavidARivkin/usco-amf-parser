function setupSax( parser )
{

  let unit    = undefined
  let version = undefined

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
  let defaultColor        = this.defaultColor
  let defaultVertexNormal = this.defaultVertexNormal
  let recomputeNormals    = this.recomputeNormals

   //storage / temporary storage
  //map amf object ids to our UUIDS
  let objectsIdMap = {}
  let objects      = []

  let meshes       = {}
  let textures     = {}
  let materials    = {}

  let scope = this  
  let rootObject = this.rootObject


  function createObject(tag){
    obj = {}
    let id = tag.attributes["id"] || null
    if(id){
      obj._id = id 
      objectsIdMap[id] = obj.uuid
    }
    //temp storage:
    obj._attributes =  {}
    obj._attributes["position"] = []
    obj._attributes["normal"]   = []
    obj._attributes["color"]    = []
    obj._attributes["indices"]  = []
    obj._attributes["vcolors"]  = []
    obj.volumes = []
    obj.faceCount = 0
    return obj
  }

  function createVolume(tag){
    let volume = {}

    volume._attributes =  {}
    volume._attributes["position"] = []
    volume._attributes["indices"]  = []
    volume._attributes["normal"]   = []
    volume._attributes["color"]    = []
    volume._attributes["indices"]  = []
    volume._attributes["vcolors"]  = []
    volume.faceCount = 0
    
    
    let materialId = tag.attributes["materialid"] || null
    if(materialId) {
      volume.materialId = parseInt(materialId)
    }
    return volume
  }
  
  
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
        unit    = tag.attributes['unit']
        version = tag.attributes['version']
        currentItem   = rootObject
      break

      //geometry
      case 'object':
        currentItem = currentObject = createObject(tag)
      break
      case 'volume':
        currentItem = currentVolume = createVolume()       
      break
      case 'triangle':
        currentTriangle = {}
        currentObject.faceCount += 1 
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
        //makeObject( currentObject )
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
          textures[currentTexture.id] = parseTexture(currentTexture)
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