AMFParser = require("../AMFParser");
AMFStreamingParser = require("../AMFParser_stream");
THREE = require("three");
fs = require("fs");

describe("AMF parser tests", function() {
  var parser = new AMFParser();
  var sParser = new AMFStreamingParser();

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
  
  it("can parse uncompressed amf files with vertex colors (streaming)", function() {
    data = fs.readFileSync("specs/data/VertColors.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
  });

  it("can parse uncompressed amf files with vertex normals (streaming)", function() {
    data = fs.readFileSync("specs/data/Sphere20Face.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(12);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(20);
  });

  it("can parse uncompressed amf files with face colors (streaming)", function() {
    data = fs.readFileSync("specs/data/FaceColors.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
  });

  /*
  it("can parse uncompressed amf files with textures (streaming)", function() {
    //TODO: find correct way to test texture parsing
    data = fs.readFileSync("specs/data/Amf_Cube.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
    expect(parsedAmf.children[0].geometry.faces.length).toEqual(12);
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

    expect(parsedAmf.children[0].position.x).toEqual(-10);
    expect(parsedAmf.children[0].position.y).toEqual(10);
    expect(parsedAmf.children[0].rotation.z).toEqual(180);
  });
  */
  

 /*
  
  it("can parse compressed amf files(streaming)", function() {
    data = fs.readFileSync("specs/data/stapel_dual.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(564);
  });
  
  crashed node ! with normal parser
  it("can parse very large amf files(streaming)", function(){
    data = fs.readFileSync("specs/data/RoboIce-dual.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].name).toEqual("Default");
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(1843);
  });*/
  
});
