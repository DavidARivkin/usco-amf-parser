AMFParser = require("../AMFParser");
THREE = require("three");
fs = require("fs");

describe("AMF parser tests", function() {
  var parser = new AMFParser();

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


});
