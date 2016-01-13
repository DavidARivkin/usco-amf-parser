let JSZip = require( 'jszip' )
let sax = require( 'sax' )

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
    
    let parser = sax.parser(true,{trim:true}) // set first param to false for html-mode
    self.setupSax( parser )
    console.log("sax parser setup ok")
    
    let l = data.length, chunkedLength = 0, c = 0, chunkSize = l
    let chunk = "" 
  
  parser.onready= function (tag) {
    if( chunkedLength<l)
    {
      chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
      parser.write( chunk ).close()
    }
    else
    {
      //format all data, and spit it out
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
          
          //set defaults for missing attributes
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
    chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
    parser.write( chunk ).close()
  }
  console.log("before unpack")
  let data = this.unpack(data, foo)
}



function makeObject(object){
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

function applyMaterials (materials, textures, meshes, facesThatNeedMaterial)
{
  //since materials are usually defined after objects/ volumes, we need to apply
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
