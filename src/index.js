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
 * 	var loader = new AMFParser()
 * 	loader.addEventListener( 'load', function ( event ) {
 *
 * 		var geometry = event.content
 * 		scene.add( new THREE.Mesh( geometry ) )
 *
 * 	} )
 * 	loader.load( './models/amf/slotted_disk.amf' )
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
  ** CurrentMesh = new THREE.Mesh()
  grab vertex attributes (position, normal, color)
  ** CurrentGeomtry = new THREE.Geometry()
  grab volumes
    for each Volume
      grab triangles (vertex indices)
      add data to geometry
Problem !! Materials are defined AFTER volumes
BUT volumes can reference materials ...
*/

var detectEnv = require("composite-detect")

let JSZip = require( 'jszip' )
let sax = require( 'sax' )

//var AMF = require("./amf.js")
import assign from 'fast.js/object/assign'

import Rx from 'rx'
import unpack from './unpack'

export const outputs = ["geometry", "materials", "textures"] //to be able to auto determine data type(s) fetched by parser
/* this.defaultMaterialType = THREE.MeshPhongMaterial//THREE.MeshLambertMaterial //
  this.defaultColor = new THREE.Color( "#efefff" ) //#efefff //#00a9ff
  this.defaultShading = THREE.FlatShading
  this.defaultSpecular = null//0xffffff
  this.defaultShininess = null//99

  this.defaultVertexNormal = new THREE.Vector3( 1, 1, 1 )
  this.recomputeNormals = true*/

export default function parse(data, parameters={}){

  const defaults = {
    useWorker: (detectEnv.isBrowser===true)
  }
  parameters = assign({},defaults,parameters)
  const {useWorker} = parameters

  const obs = new Rx.ReplaySubject(1)


  let rootObject = {}
  rootObject.name = "rootScene"//TODO: change storage of data : ie don't put everything under a single object
  //TODO: use these steps:
  /*
    - generate three.buffergeometry from raw data's meshes list
    - generate textures             from raw data's textures list
    - generate materials             from raw data's materials list
    - generate final assembly(ies)
  */


  function parseRawXml(data){
    const parsedData = new Rx.ReplaySubject(1)

    function onTagOpen(tag){  
      //console.log("onTagOpen",tag)    
      parsedData.onNext( {tag, start:true} )
    }

    function onTagClose(tag){
      //console.log("onTagClose",tag)
      parsedData.onNext( {tag, end:true} )
    }

    /*let saxStream =  sax.createStream(true, {trim:true})
    saxStream.write( data )

    //console.log("saxStream",saxStream)
    saxStream.on("error", function (e) {
      // unhandled errors will throw, since this is a proper node
      // event emitter.
      console.error("error!", e)
      // clear the error
      this._parser.error = null
      this._parser.resume()
    })
    saxStream.on("opentag", onTagOpen)*/

    let length = data.length
    let chunkedLength = 0
    let chunkSize     = length
    let chunk         = "" 
    let c = 0

    let parser = sax.parser(true,{trim:true})
    parser.onopentag  = onTagOpen
    parser.onclosetag = onTagClose
    parser.onerror = function(error)
    { 
        console.log("error in parser", error)
        //console.log(error)
        //throw error
        parser.resume()
    } 


    parser.onready= function (tag) {

      if( chunkedLength < length)
      {
        chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
        parser.write( chunk ).close()
      }
    }

    chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
    parser.write( chunk ).close()
  
    //parsedData.subscribe( e=> parser.write( data ) )
    return parsedData.share() //Rx.Observable.from( saxStream )
  }

  function parseRawXml2(){
    return Rx.Observable.create(function (observer) {
      observer.onNext(42)
      observer.onNext(10)
      observer.onNext(90)
      observer.onCompleted()

      // Any cleanup logic might go here
      return function () {
        console.log('disposed')
      }
    })
  }

  function parseRawXml3(data){
    return Rx.Observable.create(function (parsedData) {

      function onTagOpen(tag){  
        //console.log("onTagOpen",tag)    
        parsedData.onNext( {tag, start:true} )
      }

      function onTagClose(tag){
        //console.log("onTagClose",tag)
        parsedData.onNext( {tag, end:true} )
      }

      let length = data.length
      let chunkedLength = 0
      let chunkSize     = length
      let chunk         = "" 
      let c = 0

      let parser = sax.parser(true,{trim:true})
      parser.onopentag  = onTagOpen
      parser.onclosetag = onTagClose
      parser.onerror = function(error)
      { 
          console.log("error in parser", error)
          //console.log(error)
          //throw error
          parser.resume()
      } 


      parser.onready= function (tag) {

        if( chunkedLength < length)
        {
          chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
          parser.write( chunk ).close()
        }
      }

      chunk = data.slice(chunkedLength, chunkedLength += chunkSize)
      parser.write( chunk ).close()


      //parsedData.onCompleted()

      // Any cleanup logic might go here
      return function () {
        console.log('disposed')
      }
    })

   
  }

  return unpack(data)
    //.tap(e=>console.log("unpacked",e))
    .flatMap(parseRawXml3)
   

  if ( useWorker ) {

    let worker = new Worker( "./amf-worker.js" )
  
    worker.onmessage = function( event ) {
      if("data" in event.data)
      {
        let data = event.data.data
        console.log("data recieved in main thread", data)
        onDataLoaded( data )

        obs.onNext(rootObject)
        obs.onCompleted()

      }
      else if("progress" in event.data)
      {
        //console.log("got progress", event.data.progress)
        //deferred.notify( {"parsing":event.data.progress} )
      }
      //const vertices = new Float32Array( event.data.vertices )
      //const normals = new Float32Array( event.data.normals )
      //const geometry = {vertices:vertices,normals:normals}
 
      //obs.onNext({progress: 1, total:vertices.length}) 
      //obs.onNext(geometry)
      //obs.onCompleted()
    }
    worker.onerror = function( event ){
      obs.onError(`filename:${event.filename} lineno: ${event.lineno} error: ${event.message}`)
    }

    worker.postMessage( {data})
    obs.catch(e=>worker.terminate()) 
  }
  else
  {
    //let amf = new AMF()
    //amf.load( data, onDataLoaded )
  }

  return obs
}


function onDataLoaded( data )
{
  if(data.constellations.length<1)
  {
    for(var i=0;i<data.objects.length;i++)
    {
      var modelData = data.objects[i]
      var model = self.createModelBuffers( modelData )
		  rootObject.add( model )
    }
  }
  else
  {
    //TODO:recurse through constellation
    for(var i=0;i<data.constellations[0].children.length;i++)
    {
      var child = data.constellations[0].children[i]
      var modelData = child.instance
      var model = self.createModelBuffers( modelData )
      model.position.fromArray( child.pos )
		  model.rotation.set(child.rot[0],child.rot[1],child.rot[2]) 
		  rootObject.add( model )
    }
  }
  obs.onNext( rootObject )
}
  

function recurse (node, newParent, callback)
{
  if(node.children)
  {
    var newModel = callback(node)
    newParent.add( newModel)
    
    for(var i=0;i<node.children.length;i++)
    {
      var child = node.children[i]
        this.recurse( child, newModel, callback )
      }
  }
    return newModel
}

function createModelBuffers ( modelData ) {
  console.log("creating model buffers",modelData)
  
  var faces = modelData.faceCount
  var colorSize =3
  
  var vertices = new Float32Array( faces * 3 * 3 )
	var normals = new Float32Array( faces * 3 * 3 )
	var colors = new Float32Array( faces *3 * colorSize )
	var indices = new Uint32Array( faces * 3  )
	
	vertices.set( modelData._attributes.position )
	normals.set( modelData._attributes.normal )
	indices.set( modelData._attributes.indices )
	colors.set( modelData._attributes.vcolors )

  var geometry = new THREE.BufferGeometry()
	geometry.addAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) )
	//geometry.addAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) )
  geometry.addAttribute( 'index', new THREE.BufferAttribute( indices, 1 ) )
  geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, colorSize ) )
  
  if(this.recomputeNormals)
  {
    //TODO: only do this, if no normals were specified???
    geometry.computeFaceNormals()
    geometry.computeVertexNormals()
  }
  
  var vs = require('./vertShader.vert')()
  var fs = require('./fragShader.frag')()
  
  var material = new THREE.RawShaderMaterial( {

					uniforms: {
						time: { type: "f", value: 1.0 }
					},
					vertexShader: vs,
					fragmentShader: fs,
					side: THREE.DoubleSide,
					transparent: true

				} )

  var color = this.defaultColor 
  var material = new this.defaultMaterialType({color:0XFFFFFF,vertexColors: THREE.VertexColors})
  var mesh = new THREE.Mesh( geometry, material )
  return mesh
}


function _generateObject( object )
{
    if(this.recomputeNormals)
	  {
		  //TODO: only do this, if no normals were specified???
		  object.geometry.computeFaceNormals()
		  object.geometry.computeVertexNormals()
	  }
	  object.geometry.computeBoundingBox()
	  object.geometry.computeBoundingSphere()

    var color = this.defaultColor 
	  var meshMaterial = new this.defaultMaterialType(
	  { 
      color: color,
		  //vertexColors: THREE.VertexColors, //TODO: add flags to dertermine if we need vertex or face colors
      vertexColors: THREE.FaceColors,
      specular: this.defaultSpecular,
      shininess: this.defaultShininess,
		  shading: this.defaultShading
	  } )

    object.material = meshMaterial
    //console.log("finished Object / THREE.Mesh",currentObject)
}


function _applyMaterials (materials, textures, meshes, facesThatNeedMaterial)
{//since materials are usually defined after objects/ volumes, we need to apply
  //materials to those that need them
  for(var i = 0 ; i<facesThatNeedMaterial.length; i++)
  {
      var curFace = facesThatNeedMaterial[i]
      var mat = materials[curFace.matId]
      curFace.item.color = mat.color
      curFace.item.vertexColors = []
      //console.log("curFace",curFace.item)
  }

  /*
  if(Object.keys(this.textures).length>0)
	{
		var materialArray = []
		for (var textureIndex in textures)
		{
			var texture = this.textures[textureIndex]
			materialArray.push(new THREE.MeshBasicMaterial({
				map: texture,
				color: color,
				vertexColors: THREE.VertexColors
				}))
    }
    currentMaterial = new THREE.MeshFaceMaterial(materialArray)
  }*/
}
