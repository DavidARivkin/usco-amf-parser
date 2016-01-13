import assert from 'assert'
//import fs from 'fs' //does not work with babel + brfs
const fs = require('fs')

//these two are needed by the parser
//import Rx from 'rx'
//let Rx = require('rx')
import assign from 'fast.js/object/assign'
import parse, {outputs} from '../src/index' 
//import parse, {outputs}'../lib/stl-parser'


describe("STL parser", function() {
  //console.log("Parser outputs", outputs, parse)

  it("should handle errors gracefully", done => {
    let data = {foo:"42"}
    let obs = parse(data) //we get an observable back

    obs.forEach(undefined, function(error){
      assert.equal(error.message,"First argument to DataView constructor must be an ArrayBuffer")
      done()
    })
  })

  //STREAMING parser
  it("can parse uncompressed amf files with vertex normals (streaming)", done => {
    this.timeout(5000)
    let data = fs.readFileSync("specs/data/Sphere20Face.amf",'binary')
    let obs  = parse(data)
   

    obs.forEach(function(parsed){
      //assert.equal(parsed.vertices.length/3,864) //we divide by three because each entry is 3 long
      assert.equal(parsed.children[0].vertices.length, 12)
      assert.equal(parsed.children[0].faces.length, 20)

      done()
    })

  })

  /*it("can parse uncompressed amf files with vertex colors (streaming)", function() {
    this.timeout(5000)
    let data = fs.readFileSync("specs/data/VertColors.amf",'binary')
    let obs  = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 8)
    assert.equal(obs.children[0].geometry.faces.length, 12)
  })

  it("can parse uncompressed amf files with face colors (streaming)", function() {
    this.timeout(5000)
    let data = fs.readFileSync("specs/data/FaceColors.amf",'binary')
    let obs  = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 8)
    assert.equal(obs.children[0].geometry.faces.length, 12)
    assert.equal(obs.children[0].geometry.faces[0].color,  new THREE.Color().setRGB(0,0,0) )
  })

  it("can parse compressed amf files with multiple materials (streaming)", function() {
    data = fs.readFileSync("specs/data/hackaday_dual_color.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 2112)
    assert.equal(obs.children[0].geometry.faces.length, 1520)
    assert.equal(obs.children[0].geometry.faces[0].color,  new THREE.Color().setRGB(0.48, 0.71, 0.27 ) )
  })
 
  it("can parse uncompressed amf files with constellations (streaming)", function() {
    data = fs.readFileSync("specs/data/Constellation.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children.length, 2)
    assert.equal(obs.children[0].geometry.vertices.length, 8)
    assert.equal(obs.children[0].geometry.faces.length, 12)

    //check constellation specific results : translations, rotations etc
    assert.equal(obs.children[0].position.y, 5)
    assert.equal(obs.children[0].rotation.z, 90)

    assert.equal(obs.children[1].position.x, -10)
    assert.equal(obs.children[1].position.y, 10)
    assert.equal(obs.children[1].rotation.z, 180)
  })

  it("can parse uncompressed, larger amf files  (streaming)", function() {
    data = fs.readFileSync("specs/data/Rook.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 1843)
    assert.equal(obs.children[0].geometry.faces.length, 3682)
  })

  it("can parse compressed amf files(streaming)", function() {
    data = fs.readFileSync("specs/data/stapel_dual.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 564)
  })*/


  /*
  it("can parse compressed amf files", function() {
    data = fs.readFileSync("specs/data/stapel_dual.amf",'binary')
    obs = parse(data)
    assert.equal(obs instanceof THREE.Object3D).toBe(true)
    assert.equal(obs.children[0].geometry.vertices.length, 564)
  })

  it("can parse uncompressed amf files", function() {
    data = fs.readFileSync("specs/data/Rook.amf",'binary')
    obs = parse(data)
    assert.equal(obs instanceof THREE.Object3D).toBe(true)
    assert.equal(obs.children[0].name, "Default")
    assert.equal(obs.children[0].geometry.vertices.length, 1843)
  })
  */

/*
  //crashes node with normal parser: now it takes about 30 secs
  it("can parse very large amf files(streaming)", function(){
    data = fs.readFileSync("specs/data/RoboIce-dual.amf",'binary')
    obs = parse(data)
    //assert.equal(obs.children[0].name, "Default")
    assert.equal(obs.children[0].geometry.vertices.length, 144590)
  })
*/

  /*
  //TODO: incompletes after this point
  it("can parse uncompressed amf files with edges (streaming)", function() {
    //TODO: find correct way to test texture parsing
    data = fs.readFileSync("specs/data/CurveEdgeTest.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 12)
    assert.equal(obs.children[0].geometry.faces.length, 12)
  })

  
  it("can parse uncompressed amf files with textures (streaming)", function() {
    //TODO: find correct way to test texture parsing
    data = fs.readFileSync("specs/data/Amf_Cube.amf",'binary')
    obs = parse(data)
    assert.equal(obs.children[0].geometry.vertices.length, 8)
    assert.equal(obs.children[0].geometry.faces.length, 12)
  })

*/

})


 


  

