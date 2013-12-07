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

  it("can parse basic + vertex colors uncompressed amf files(streaming)", function() {
    data = fs.readFileSync("specs/data/VertColors.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
  });*/

   it("can parse basic + vertex normals uncompressed amf files(streaming)", function() {
    data = fs.readFileSync("specs/data/Sphere20Face.amf",'binary')
    parsedAmf = sParser.parse(data);
    expect(parsedAmf instanceof THREE.Object3D).toBe(true);
    expect(parsedAmf.children[0].geometry.vertices.length).toEqual(8);
  });

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
