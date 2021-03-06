THREE = require("three");
AMFParser = require("../amf-parser");
fs = require("fs");

describe("AMF parser tests", function() {
  //var parser = new AMFParser();
  var sParser = new AMFParser();

  /*
  it("can parse compressed amf files", function() {
    data = fs.readFileSync("specs/data/stapel_dual.amf",'binary')
    parsedAmf = parser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(564);
  });

  it("can parse uncompressed amf files", function() {
    data = fs.readFileSync("specs/data/Rook.amf",'binary')
    parsedAmf = parser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].name).toEqual("Default");
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(1843);
  });
  */

  //STREAMING parser

  it("can parse uncompressed amf files with vertex normals (streaming)", function() {
    data = fs.readFileSync("specs/data/Sphere20Face.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(12);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(20);
  });

  it("can parse uncompressed amf files with vertex colors (streaming)", function() {
    data = fs.readFileSync("specs/data/VertColors.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
  });

  it("can parse uncompressed amf files with face colors (streaming)", function() {
    data = fs.readFileSync("specs/data/FaceColors.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
    expect(parsedAmf.children[0].geometry.faces[0].color).toEqual( new THREE.Color().setRGB(0,0,0) );
  });

  it("can parse compressed amf files with multiple materials (streaming)", function() {
    data = fs.readFileSync("specs/data/hackaday_dual_color.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(2112);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(1520);
    expect(parsedAmf.children[0].geometry.faces[0].color).toEqual( new THREE.Color().setRGB(0.48, 0.71, 0.27 ) );
  });
 
  it("can parse uncompressed amf files with constellations (streaming)", function() {
    data = fs.readFileSync("specs/data/Constellation.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children.length).toEqual(2);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);

    //check constellation specific results : translations, rotations etc
    expect(parsedAmf.children[0].position.y).toEqual(5);
    expect(parsedAmf.children[0].rotation.z).toEqual(90);

    expect(parsedAmf.children[1].position.x).toEqual(-10);
    expect(parsedAmf.children[1].position.y).toEqual(10);
    expect(parsedAmf.children[1].rotation.z).toEqual(180);
  });

  it("can parse uncompressed, larger amf files  (streaming)", function() {
    data = fs.readFileSync("specs/data/Rook.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(1843);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(3682);
  });

    it("can parse compressed amf files(streaming)", function() {
    data = fs.readFileSync("specs/data/stapel_dual.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(564);
  });
/*
  //crashes node with normal parser: now it takes about 30 secs
  it("can parse very large amf files(streaming)", function(){
    data = fs.readFileSync("specs/data/RoboIce-dual.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    //expect(parsedAmf.children[0].name).toEqual("Default");
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(144590);
  });
*/

  /*
  //TODO: incompletes after this point
  it("can parse uncompressed amf files with edges (streaming)", function() {
    //TODO: find correct way to test texture parsing
    data = fs.readFileSync("specs/data/CurveEdgeTest.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(12);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
  });

  
  it("can parse uncompressed amf files with textures (streaming)", function() {
    //TODO: find correct way to test texture parsing
    data = fs.readFileSync("specs/data/Amf_Cube.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
  });

*/
  

});
